import type {
  AssetTypeLookup,
  LocationLookup,
  DeviceHealthLookup,
  PersonLookup,
} from '../types/asset.ts';

export type CatalogKey = 'types' | 'locations' | 'health' | 'people';

export interface LookupFailure {
  catalogKey: CatalogKey;
  catalogName: string;
  status: number;
  reason: string;
}

export interface LookupCatalogsState {
  assetTypes: AssetTypeLookup[];
  locations: LocationLookup[];
  deviceHealth: DeviceHealthLookup[];
  people: PersonLookup[];
}

export interface LookupFetchResult {
  data: LookupCatalogsState;
  failures: LookupFailure[];
  summaryMessage: string | null;
  isAllFailed: boolean;
  isPartialFailure: boolean;
}

export const INITIAL_LOOKUP_STATE: LookupCatalogsState = {
  assetTypes: [],
  locations: [],
  deviceHealth: [],
  people: [],
};

const CATALOG_CONFIG: Array<{
  key: CatalogKey;
  name: string;
  endpoint: string;
}> = [
  { key: 'types', name: 'Asset Types', endpoint: '/api/lookups/asset-types' },
  { key: 'locations', name: 'Locations', endpoint: '/api/lookups/locations' },
  { key: 'health', name: 'Device Health', endpoint: '/api/lookups/device-health' },
  { key: 'people', name: 'People Directory', endpoint: '/api/people?limit=100' },
];

/**
 * Fetches the 4 reference catalogs from authenticated backend endpoints.
 * - Granularly isolates failures without claiming PostgreSQL is down when 401 or 403 occur.
 * - Preserves previously loaded options if subsequent re-fetches encounter transient failures.
 * - Supports dependency-injected fetch for deterministic testing.
 */
export async function fetchCatalogs(
  currentState: LookupCatalogsState = INITIAL_LOOKUP_STATE,
  fetchFn: typeof fetch = fetch
): Promise<LookupFetchResult> {
  const nextData: LookupCatalogsState = {
    assetTypes: [...currentState.assetTypes],
    locations: [...currentState.locations],
    deviceHealth: [...currentState.deviceHealth],
    people: [...currentState.people],
  };

  const failures: LookupFailure[] = [];

  await Promise.all(
    CATALOG_CONFIG.map(async ({ key, name, endpoint }) => {
      try {
        const res = await fetchFn(endpoint, { credentials: 'include' });

        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          const list = Array.isArray(json.data) ? json.data : [];

          if (key === 'types') nextData.assetTypes = list;
          else if (key === 'locations') nextData.locations = list;
          else if (key === 'health') nextData.deviceHealth = list;
          else if (key === 'people') nextData.people = list;
          return;
        }

        // Handle specific HTTP error status codes truthfully
        let reason: string;
        if (res.status === 401) {
          reason = 'Authentication session required (401 Unauthorized)';
        } else if (res.status === 403) {
          reason = 'Security validation failed (403 Forbidden)';
        } else {
          reason = `Server error (HTTP ${res.status})`;
        }

        failures.push({
          catalogKey: key,
          catalogName: name,
          status: res.status,
          reason,
        });
      } catch {
        failures.push({
          catalogKey: key,
          catalogName: name,
          status: 0,
          reason: 'Network connection unreachable',
        });
      }
    })
  );

  const isAllFailed = failures.length === CATALOG_CONFIG.length;
  const isPartialFailure = failures.length > 0 && !isAllFailed;

  let summaryMessage: string | null = null;

  if (isAllFailed) {
    const isAll401 = failures.every((f) => f.status === 401);
    const isAll403 = failures.every((f) => f.status === 403);

    if (isAll401) {
      summaryMessage =
        'Authentication required: Administrative session is unauthenticated or expired (401 Unauthorized). Please sign in to access reference catalogs.';
    } else if (isAll403) {
      summaryMessage =
        'Security verification failed: Access forbidden while loading reference catalogs (403 Forbidden).';
    } else {
      summaryMessage =
        'Reference catalogs unavailable: Server or database error while fetching reference data.';
    }
  } else if (isPartialFailure) {
    const failedNames = failures.map((f) => `${f.catalogName} (${f.reason})`).join(', ');
    const loadedKeys: CatalogKey[] = CATALOG_CONFIG.filter(
      (c) => !failures.some((f) => f.catalogKey === c.key)
    ).map((c) => c.key);

    const successNames = loadedKeys
      .map((k) => {
        if (k === 'types') return 'Asset Types';
        if (k === 'locations') return 'Locations';
        if (k === 'health') return 'Device Health';
        return 'People Directory';
      })
      .join(', ');

    summaryMessage = `Partial Catalog Warning: Could not load ${failedNames}. Retaining available catalogs: ${successNames}.`;
  }

  return {
    data: nextData,
    failures,
    summaryMessage,
    isAllFailed,
    isPartialFailure,
  };
}
