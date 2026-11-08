import type { AssetDetails, AssetAuditEventRecord } from '../types/asset.ts';
import type { AssetTransferRecord } from '../types/transfer.ts';
import type { PhysicalVerificationRecord } from '../types/verification.ts';

export type MutationType = 'create' | 'complete' | 'cancel' | 'verification';

export interface VerificationHistoryFetchResult {
  ok: boolean;
  status?: number;
  isNetworkError?: boolean;
  error?: string;
  data?: PhysicalVerificationRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthoritativeRefreshOptions {
  includeVerifications?: boolean;
  verificationsPage?: number;
  verificationsLimit?: number;
}

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
  verificationsData?: {
    records: PhysicalVerificationRecord[];
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
    verificationsOk?: boolean;
    verificationsStatus?: number;
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
 * Executes a strictly read-only (GET only) fetch of Physical Verification History:
 * GET /api/assets/:id/verifications
 *
 * Truthfully identifies complete success, non-2xx HTTP responses, malformed responses,
 * and network connection errors.
 */
export async function fetchVerificationHistory(
  assetId: string,
  page: number = 1,
  limit: number = 10,
  fetchImpl: typeof fetch = fetch
): Promise<VerificationHistoryFetchResult> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/assets/${assetId}/verifications?page=${page}&limit=${limit}`, {
      credentials: 'include',
    });
  } catch (err: any) {
    return {
      ok: false,
      isNetworkError: true,
      error: 'Network connection error: Failed to reach server when fetching physical verification history.',
    };
  }

  if (!res.ok) {
    let errorMsg = `Failed to load verification history from server (HTTP ${res.status}).`;
    if (res.status === 404) {
      errorMsg = `Asset '${assetId}' not found in database (404).`;
    } else if (res.status === 401) {
      errorMsg = 'Administrative session expired (401 Unauthorized). Please sign in.';
    } else if (res.status === 500) {
      errorMsg = 'Internal server error encountered while querying verification records (500).';
    }
    return {
      ok: false,
      status: res.status,
      isNetworkError: false,
      error: errorMsg,
    };
  }

  try {
    const json = await res.json();
    return {
      ok: true,
      status: res.status,
      data: json.data || [],
      pagination: json.pagination,
    };
  } catch {
    return {
      ok: false,
      status: res.status,
      error: 'Malformed JSON response when parsing physical verification records from server.',
    };
  }
}

/**
 * Executes a strictly read-only (GET only) authoritative refresh of:
 * 1. Asset Details (/api/assets/:id)
 * 2. Recent Audit History (/api/assets/:id/history)
 * 3. Transfer History (/api/assets/:id/transfers)
 * 4. (Optional / P11) Physical Verification History (/api/assets/:id/verifications)
 *
 * Truthfully identifies complete success, complete failure, network errors,
 * non-2xx HTTP responses, and partial read failures across all queried endpoints.
 */
export async function executeAuthoritativeRefresh(
  assetId: string,
  fetchImpl: typeof fetch = fetch,
  options?: AuthoritativeRefreshOptions
): Promise<AuthoritativeRefreshResult> {
  let assetRes: Response | undefined;
  let historyRes: Response | undefined;
  let transferRes: Response | undefined;
  let verificationsRes: Response | undefined;

  const includeVerifications = !!options?.includeVerifications;
  const vPage = options?.verificationsPage || 1;
  const vLimit = options?.verificationsLimit || 10;

  try {
    const promises: Promise<Response>[] = [
      fetchImpl(`/api/assets/${assetId}`, { credentials: 'include' }),
      fetchImpl(`/api/assets/${assetId}/history?page=1&limit=5`, { credentials: 'include' }),
      fetchImpl(`/api/assets/${assetId}/transfers?page=1&limit=10`, { credentials: 'include' }),
    ];

    if (includeVerifications) {
      promises.push(
        fetchImpl(`/api/assets/${assetId}/verifications?page=${vPage}&limit=${vLimit}`, {
          credentials: 'include',
        })
      );
    }

    const responses = await Promise.all(promises);
    assetRes = responses[0];
    historyRes = responses[1];
    transferRes = responses[2];
    if (includeVerifications) {
      verificationsRes = responses[3];
    }
  } catch (err: any) {
    return {
      ok: false,
      isNetworkError: true,
      error: 'Network connection error: Server or PostgreSQL database is unreachable.',
      details: {
        assetOk: false,
        historyOk: false,
        transfersOk: false,
        verificationsOk: includeVerifications ? false : undefined,
      },
    };
  }

  const assetOk = assetRes.ok;
  const historyOk = historyRes.ok;
  const transfersOk = transferRes.ok;
  const verificationsOk = includeVerifications ? !!verificationsRes?.ok : undefined;

  const details = {
    assetOk,
    assetStatus: assetRes.status,
    historyOk,
    historyStatus: historyRes.status,
    transfersOk,
    transfersStatus: transferRes.status,
    verificationsOk,
    verificationsStatus: verificationsRes?.status,
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

  // Parse Verifications Data if verifications request was included and succeeded
  let verificationsData:
    | {
        records: PhysicalVerificationRecord[];
        pagination?: { page: number; limit: number; total: number; totalPages: number };
      }
    | undefined;

  if (includeVerifications && verificationsRes && verificationsOk) {
    try {
      const verificationsJson = await verificationsRes.json();
      verificationsData = {
        records: verificationsJson.data || [],
        pagination: verificationsJson.pagination,
      };
    } catch {
      // Ignored here, caught by partial failure check below
    }
  }

  // 2. Check for Partial Read Failures
  const hasHistoryFailure = !historyOk || !historyData;
  const hasTransfersFailure = !transfersOk || !transfersData;
  const hasVerificationsFailure = includeVerifications && (!verificationsOk || !verificationsData);

  if (hasHistoryFailure || hasTransfersFailure || hasVerificationsFailure) {
    const failedParts: string[] = [];
    let failureStatusCode: number | undefined;

    if (hasHistoryFailure) {
      failedParts.push(`audit history (HTTP ${historyRes.status})`);
      failureStatusCode = failureStatusCode || historyRes.status;
    }
    if (hasTransfersFailure) {
      failedParts.push(`transfer records (HTTP ${transferRes.status})`);
      failureStatusCode = failureStatusCode || transferRes.status;
    }
    if (hasVerificationsFailure && verificationsRes) {
      failedParts.push(`physical verification records (HTTP ${verificationsRes.status})`);
      failureStatusCode = failureStatusCode || verificationsRes.status;
    }

    return {
      ok: false,
      partialFailure: true,
      error: `Partial refresh failure: Asset specification was loaded, but ${failedParts.join(' and ')} failed to refresh.`,
      statusCode: failureStatusCode,
      assetData,
      historyData,
      transfersData,
      verificationsData,
      details,
    };
  }

  // 3. Complete Success
  return {
    ok: true,
    assetData,
    historyData,
    transfersData,
    verificationsData,
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
      : mutationType === 'cancel'
      ? 'Transfer cancellation'
      : 'Physical verification';

  if (refreshResult.ok) {
    const successTitle =
      mutationType === 'verification'
        ? 'VERIFICATION RECORDED & STATE VERIFIED'
        : 'OPERATION CONFIRMED & STATE VERIFIED';

    const successMessage =
      mutationType === 'verification'
        ? 'Physical verification was confirmed on the server and authoritative records were successfully refreshed.'
        : `${mutationLabel} was confirmed on the server and authoritative records were successfully refreshed.`;

    return {
      mutationConfirmed: true,
      mutationType,
      refreshOk: true,
      refreshNotVerified: false,
      title: successTitle,
      message: successMessage,
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
    // If transfers failed or whole refresh failed on transfer mutations, pending state is unknown -> guard enabled
    // Physical verification does not mutate transfer state, so transfer button is not locked
    isTransferStateUnverified:
      mutationType === 'verification'
        ? false
        : !refreshResult.details.transfersOk || !refreshResult.ok,
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
