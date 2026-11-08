import type { AssetDetails, AssetAuditEventRecord } from '../types/asset.ts';
import type { AssetTransferRecord } from '../types/transfer.ts';

export type MutationType = 'create' | 'complete' | 'cancel';

export interface AuthoritativeRefreshResult {
  ok: boolean;
  error?: string;
  isNetworkError?: boolean;
  statusCode?: number;
  partialFailure?: boolean;
  assetData?: AssetDetails;
  historyData?: {
    records: AssetAuditEventRecord[];
    total: number;
  };
  transfersData?: {
    records: AssetTransferRecord[];
    activePending: AssetTransferRecord | null;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  details: {
    assetOk: boolean;
    assetStatus?: number;
    historyOk: boolean;
    historyStatus?: number;
    transfersOk: boolean;
    transfersStatus?: number;
  };
}

export interface PostMutationFeedbackState {
  mutationConfirmed: boolean;
  mutationType: MutationType;
  refreshOk: boolean;
  refreshNotVerified: boolean;
  title: string;
  message: string;
  isTransferStateUnverified: boolean;
  canRetryRefresh: boolean;
  partialFailure?: boolean;
}

/**
 * Executes a strictly read-only (GET only) authoritative refresh of:
 * 1. Asset Details (/api/assets/:id)
 * 2. Recent Audit History (/api/assets/:id/history)
 * 3. Transfer History (/api/assets/:id/transfers)
 *
 * Truthfully identifies complete success, complete failure, network errors,
 * non-2xx HTTP responses, and partial read failures.
 */
export async function executeAuthoritativeRefresh(
  assetId: string,
  fetchImpl: typeof fetch = fetch
): Promise<AuthoritativeRefreshResult> {
  let assetRes: Response | undefined;
  let historyRes: Response | undefined;
  let transferRes: Response | undefined;

  try {
    [assetRes, historyRes, transferRes] = await Promise.all([
      fetchImpl(`/api/assets/${assetId}`, { credentials: 'include' }),
      fetchImpl(`/api/assets/${assetId}/history?page=1&limit=5`, { credentials: 'include' }),
      fetchImpl(`/api/assets/${assetId}/transfers?page=1&limit=10`, { credentials: 'include' }),
    ]);
  } catch (err: any) {
    return {
      ok: false,
      isNetworkError: true,
      error: 'Network connection error: Server or PostgreSQL database is unreachable.',
      details: {
        assetOk: false,
        historyOk: false,
        transfersOk: false,
      },
    };
  }

  const assetOk = assetRes.ok;
  const historyOk = historyRes.ok;
  const transfersOk = transferRes.ok;

  const details = {
    assetOk,
    assetStatus: assetRes.status,
    historyOk,
    historyStatus: historyRes.status,
    transfersOk,
    transfersStatus: transferRes.status,
  };

  // 1. Primary Asset Record failure
  if (!assetOk) {
    let errorMsg = `Failed to reload asset from server (HTTP ${assetRes.status}).`;
    if (assetRes.status === 404) {
      errorMsg = `Asset with UUID '${assetId}' was not found in the database registry (404).`;
    } else if (assetRes.status === 400) {
      errorMsg = 'Invalid asset identifier format. Expected standard RFC 4122 UUID (400).';
    } else if (assetRes.status === 401) {
      errorMsg = 'Administrative session required or expired (401 Unauthorized). Please sign in.';
    }

    return {
      ok: false,
      isNetworkError: false,
      statusCode: assetRes.status,
      error: errorMsg,
      details,
    };
  }

  // Parse Asset Data
  let assetData: AssetDetails | undefined;
  try {
    const assetJson = await assetRes.json();
    assetData = assetJson.data;
  } catch {
    return {
      ok: false,
      error: 'Malformed JSON response when parsing asset data from server.',
      statusCode: assetRes.status,
      details,
    };
  }

  // Parse History Data if history request succeeded
  let historyData: { records: AssetAuditEventRecord[]; total: number } | undefined;
  if (historyOk) {
    try {
      const historyJson = await historyRes.json();
      historyData = {
        records: historyJson.data || [],
        total: historyJson.pagination?.total ?? (historyJson.data || []).length,
      };
    } catch {
      // Ignored here, will be caught by partialFailure check below
    }
  }

  // Parse Transfers Data if transfers request succeeded
  let transfersData:
    | {
        records: AssetTransferRecord[];
        activePending: AssetTransferRecord | null;
        pagination?: { page: number; limit: number; total: number; totalPages: number };
      }
    | undefined;

  if (transfersOk) {
    try {
      const transferJson = await transferRes.json();
      const records: AssetTransferRecord[] = transferJson.data || [];
      const activePending: AssetTransferRecord | null =
        transferJson.activePending !== undefined
          ? transferJson.activePending
          : records.find((t) => t.status === 'PENDING') || null;

      transfersData = {
        records,
        activePending,
        pagination: transferJson.pagination,
      };
    } catch {
      // Ignored here, will be caught by partialFailure check below
    }
  }

  // 2. Check for Partial Read Failures (History or Transfers failed)
  if (!historyOk || !transfersOk || !historyData || !transfersData) {
    const failedParts: string[] = [];
    if (!historyOk || !historyData) {
      failedParts.push(`audit history (HTTP ${historyRes.status})`);
    }
    if (!transfersOk || !transfersData) {
      failedParts.push(`transfer records (HTTP ${transferRes.status})`);
    }

    return {
      ok: false,
      partialFailure: true,
      error: `Partial refresh failure: Asset specification was loaded, but ${failedParts.join(' and ')} failed to refresh.`,
      statusCode: !transfersOk ? transferRes.status : historyRes.status,
      assetData,
      historyData,
      transfersData,
      details,
    };
  }

  // 3. Complete Success
  return {
    ok: true,
    assetData,
    historyData,
    transfersData,
    details,
  };
}

/**
 * Produces structured feedback following a confirmed mutation POST and follow-up GET refresh.
 * Guarantees that if the POST was confirmed, the user sees "Saved on server; refresh not verified"
 * whenever the follow-up GET refresh encounters an error or partial failure.
 */
export function evaluatePostMutationRefresh(
  mutationType: MutationType,
  refreshResult: AuthoritativeRefreshResult
): PostMutationFeedbackState {
  const mutationLabel =
    mutationType === 'create'
      ? 'Transfer initiation'
      : mutationType === 'complete'
      ? 'Transfer completion'
      : 'Transfer cancellation';

  if (refreshResult.ok) {
    return {
      mutationConfirmed: true,
      mutationType,
      refreshOk: true,
      refreshNotVerified: false,
      title: 'OPERATION CONFIRMED & STATE VERIFIED',
      message: `${mutationLabel} was confirmed on the server and authoritative records were successfully refreshed.`,
      isTransferStateUnverified: false,
      canRetryRefresh: false,
      partialFailure: false,
    };
  }

  const cause = refreshResult.error || 'The server or network encountered an unexpected error.';

  return {
    mutationConfirmed: true,
    mutationType,
    refreshOk: false,
    refreshNotVerified: true,
    title: 'Saved on server; refresh not verified',
    message: `${mutationLabel} was successfully committed and saved on the server, but reloading the updated state could not be verified (${cause}). Your changes were safely recorded on the server, but displayed records may be pending refresh.`,
    // If transfers failed or whole refresh failed, pending state is unknown -> guard enabled
    isTransferStateUnverified: !refreshResult.details.transfersOk || !refreshResult.ok,
    canRetryRefresh: true,
    partialFailure: !!refreshResult.partialFailure,
  };
}

/**
 * Guard for the "Initiate Transfer" button.
 * Enforces a conservative unavailable/retry state when transfer state is unverified.
 */
export function shouldDisableInitiateTransfer(params: {
  previewMode?: boolean;
  activePendingTransfer?: AssetTransferRecord | null;
  transfers?: AssetTransferRecord[];
  isTransferStateUnverified?: boolean;
  isRefreshing?: boolean;
}): { disabled: boolean; reason?: string } {
  if (params.previewMode) {
    return { disabled: true, reason: 'Transfer creation is disabled in Preview Inspection Mode.' };
  }

  if (params.isRefreshing) {
    return { disabled: true, reason: 'Refreshing asset and transfer state...' };
  }

  if (params.isTransferStateUnverified) {
    return {
      disabled: true,
      reason:
        'Transfer state unverified following recent server mutation. Please retry refresh before initiating a new transfer.',
    };
  }

  if (params.activePendingTransfer) {
    return { disabled: true, reason: 'A pending transfer is already active for this asset.' };
  }

  if (params.transfers && params.transfers.some((t) => t.status === 'PENDING')) {
    return { disabled: true, reason: 'A pending transfer is already active for this asset.' };
  }

  return { disabled: false };
}
