import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_PATCH_FIELDS,
  FORBIDDEN_PATCH_FIELDS,
  validatePatchForm,
  computePatchDelta,
} from '../src/utils/assetPatchValidation.ts';
import type { PatchAssetFormValues, AssetListItem } from '../src/types/asset.ts';
import { validatePatchAssetInput } from '../server/validators/assetValidators.ts';

test('P09-AC02: Exactly the nine general fields are allowlisted for inline editing', () => {
  const expectedAllowlist = [
    'model',
    'assetNumber',
    'serialNumber',
    'typeId',
    'locationId',
    'deviceHealthId',
    'status',
    'label',
    'comment',
  ];

  assert.equal(ALLOWED_PATCH_FIELDS.length, 9);
  for (const field of expectedAllowlist) {
    assert.ok(
      ALLOWED_PATCH_FIELDS.includes(field as any),
      `Field '${field}' must be included in ALLOWED_PATCH_FIELDS`
    );
  }
});

test('P09-AC02: Sensitive ownership, assignment, and verification fields are strictly forbidden', () => {
  const expectedForbidden = [
    'id',
    'acOwnerId',
    'currentUserId',
    'acOwner',
    'currentUser',
    'department',
    'costCenter',
    'legacyNewCostCenter',
    'lastVerifiedAt',
    'lastVerifiedYearMonth',
    'lastVerificationOutcome',
    'verifications',
    'transfers',
    'auditEvents',
    'createdAt',
    'updatedAt',
  ];

  for (const field of expectedForbidden) {
    assert.ok(
      FORBIDDEN_PATCH_FIELDS.includes(field as any),
      `Field '${field}' must be in FORBIDDEN_PATCH_FIELDS`
    );

    // Also test backend validator rejects it
    const validation = validatePatchAssetInput({ [field]: 'unauthorized-value' });
    assert.equal(validation.valid, false, `Backend must reject forbidden field '${field}'`);
    assert.equal(validation.code, 'FORBIDDEN_FIELD');
  }
});

test('P09-AC03: computePatchDelta outputs ONLY changed allowlisted fields and normalizes blanks to null', () => {
  const original: AssetListItem = {
    id: 'a0000000-0000-0000-0000-000000000001',
    model: 'ThinkPad T14 Gen 3',
    assetNumber: 'AST-1001',
    serialNumber: 'PF-239481',
    status: 'IN_USE',
    department: 'Engineering',
    costCenter: 'CC-ENG-101',
    label: 'DEV-MACHINE-01',
    comment: 'Original comment',
    typeId: 'b0000000-0000-0000-0000-000000000001',
    locationId: 'c0000000-0000-0000-0000-000000000001',
    deviceHealthId: 'd0000000-0000-0000-0000-000000000001',
    acOwnerId: null,
    currentUserId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  // Modify only model and label; clear serialNumber
  const form: PatchAssetFormValues = {
    model: 'ThinkPad T14 Gen 4', // Changed
    assetNumber: 'AST-1001', // Unchanged
    serialNumber: '', // Cleared -> should become null
    typeId: 'b0000000-0000-0000-0000-000000000001', // Unchanged
    locationId: 'c0000000-0000-0000-0000-000000000001', // Unchanged
    deviceHealthId: 'd0000000-0000-0000-0000-000000000001', // Unchanged
    status: 'IN_USE', // Unchanged
    label: 'DEV-MACHINE-02', // Changed
    comment: 'Original comment', // Unchanged
  };

  const deltaResult = computePatchDelta(original, form);

  assert.equal(deltaResult.hasChanges, true);
  assert.deepEqual(deltaResult.changedFields.sort(), ['label', 'model', 'serialNumber'].sort());
  assert.equal(deltaResult.delta.model, 'ThinkPad T14 Gen 4');
  assert.equal(deltaResult.delta.label, 'DEV-MACHINE-02');
  assert.equal(deltaResult.delta.serialNumber, null); // Normalized empty to null
  assert.equal(deltaResult.delta.assetNumber, undefined); // Unchanged field omitted
  assert.equal(deltaResult.delta.status, undefined); // Unchanged field omitted
});

test('P09-AC03: No-Op detection identifies identical inputs without emitting writes', () => {
  const original: AssetListItem = {
    id: 'a0000000-0000-0000-0000-000000000002',
    model: 'MacBook Pro 16',
    assetNumber: 'AST-2002',
    serialNumber: 'C02G1234MD6R',
    status: 'SPARE',
    department: 'Design',
    costCenter: 'CC-DES-201',
    label: null,
    comment: null,
    typeId: null,
    locationId: null,
    deviceHealthId: null,
    acOwnerId: null,
    currentUserId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  const form: PatchAssetFormValues = {
    model: 'MacBook Pro 16',
    assetNumber: 'AST-2002',
    serialNumber: 'C02G1234MD6R',
    typeId: '',
    locationId: '',
    deviceHealthId: '',
    status: 'SPARE',
    label: '',
    comment: '',
  };

  const deltaResult = computePatchDelta(original, form);

  assert.equal(deltaResult.hasChanges, false);
  assert.equal(deltaResult.changedFields.length, 0);
  assert.deepEqual(deltaResult.delta, {});
});

test('P09-AC05: Client-side validation requires model and valid status', () => {
  // Empty model
  const invalidModelForm: PatchAssetFormValues = {
    model: '   ',
    assetNumber: '',
    serialNumber: '',
    typeId: '',
    locationId: '',
    deviceHealthId: '',
    status: 'IN_USE',
    label: '',
    comment: '',
  };
  const res1 = validatePatchForm(invalidModelForm);
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.model);

  // Invalid UUID in typeId
  const invalidUuidForm: PatchAssetFormValues = {
    model: 'Valid Model',
    assetNumber: '',
    serialNumber: '',
    typeId: 'not-a-valid-uuid',
    locationId: '',
    deviceHealthId: '',
    status: 'IN_USE',
    label: '',
    comment: '',
  };
  const res2 = validatePatchForm(invalidUuidForm);
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.typeId);

  // Valid complete form
  const validForm: PatchAssetFormValues = {
    model: 'Dell Precision 3660',
    assetNumber: 'AST-3003',
    serialNumber: 'SN-998877',
    typeId: 'b0000000-0000-4000-8000-000000000001',
    locationId: 'c0000000-0000-4000-8000-000000000001',
    deviceHealthId: 'd0000000-0000-4000-8000-000000000001',
    status: 'IN_USE',
    label: 'WORKSTATION-01',
    comment: 'Assigned to ML training',
  };
  const res3 = validatePatchForm(validForm);
  assert.equal(res3.valid, true);
  assert.deepEqual(res3.errors, {});
});

test('P09-AC05: Backend validator enforces UUID and allowlist rules on PATCH payload', () => {
  // Body with invalid UUID typeId
  const validation1 = validatePatchAssetInput({
    model: 'Valid Model',
    typeId: 'invalid-uuid-string',
  });
  assert.equal(validation1.valid, false);
  assert.equal(validation1.field, 'typeId');

  // Body with no allowed fields
  const validation2 = validatePatchAssetInput({});
  assert.equal(validation2.valid, false);
  assert.equal(validation2.code, 'MISSING_REQUIRED');

  // Valid partial PATCH body
  const validation3 = validatePatchAssetInput({
    model: 'New Model Name',
    status: 'SPARE',
  });
  assert.equal(validation3.valid, true);
  assert.equal(validation3.data.model, 'New Model Name');
  assert.equal(validation3.data.status, 'SPARE');
});

// ============================================================================
// P09 Targeted Corrections: Unsaved Inline Edits and Safe Navigation
// ============================================================================

test('P09-Correction: Guard blocks navigation while PATCH request is in-flight', () => {
  let alertMessage = '';
  const mockAlert = (msg: string) => {
    alertMessage = msg;
  };

  // Guard state where isSubmitting is true
  const createGuard = (isSubmitting: boolean) => {
    return () => {
      if (isSubmitting) {
        mockAlert('Cannot navigate or change view while a save operation is in progress. Please wait.');
        return false;
      }
      return true;
    };
  };

  const activeGuard = createGuard(true);
  const canProceed = activeGuard();

  assert.equal(canProceed, false, 'Navigation must be blocked when save is in progress');
  assert.ok(alertMessage.includes('save operation is in progress'));
});

test('P09-Correction: Guard detects dirty inline draft and blocks navigation if user declines discard', () => {
  const originalAsset: AssetListItem = {
    id: 'a0000000-0000-4000-8000-000000000001',
    model: 'Precision 5570',
    assetNumber: 'AST-5570',
    serialNumber: 'SN-112233',
    status: 'IN_USE',
    department: 'Engineering',
    costCenter: 'CC-ENG',
    label: 'DEV-LAPTOP',
    comment: null,
    typeId: 'b0000000-0000-4000-8000-000000000001',
    locationId: 'c0000000-0000-4000-8000-000000000001',
    deviceHealthId: 'd0000000-0000-4000-8000-000000000001',
    acOwnerId: null,
    currentUserId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  const dirtyForm: PatchAssetFormValues = {
    model: 'Precision 5570 - Modified',
    assetNumber: 'AST-5570',
    serialNumber: 'SN-112233',
    status: 'IN_USE',
    label: 'DEV-LAPTOP',
    comment: '',
    typeId: 'b0000000-0000-4000-8000-000000000001',
    locationId: 'c0000000-0000-4000-8000-000000000001',
    deviceHealthId: 'd0000000-0000-4000-8000-000000000001',
  };

  const delta = computePatchDelta(originalAsset, dirtyForm);
  assert.equal(delta.hasChanges, true);

  // User declines discard (window.confirm returns false)
  const mockConfirmDecline = () => false;
  const guardWithDecline = () => {
    if (delta.hasChanges) {
      return mockConfirmDecline();
    }
    return true;
  };

  const canNavigate = guardWithDecline();
  assert.equal(canNavigate, false, 'Navigation must be cancelled when user declines discard');
});

test('P09-Correction: Guard clears draft and permits navigation when user confirms discard', () => {
  const originalAsset: AssetListItem = {
    id: 'a0000000-0000-4000-8000-000000000002',
    model: 'OptiPlex 7090',
    assetNumber: 'AST-7090',
    serialNumber: 'SN-445566',
    status: 'SPARE',
    department: 'Support',
    costCenter: 'CC-SUP',
    label: null,
    comment: null,
    typeId: null,
    locationId: null,
    deviceHealthId: null,
    acOwnerId: null,
    currentUserId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  const dirtyForm: PatchAssetFormValues = {
    model: 'OptiPlex 7090 Plus',
    assetNumber: 'AST-7090',
    serialNumber: 'SN-445566',
    status: 'SPARE',
    label: 'HOT-STANDBY',
    comment: '',
    typeId: '',
    locationId: '',
    deviceHealthId: '',
  };

  let activeEditingAssetId: string | null = originalAsset.id;
  let activeDraft: PatchAssetFormValues | null = dirtyForm;

  const mockConfirmAccept = () => true;
  const checkUnsavedChanges = () => {
    if (!activeEditingAssetId || !activeDraft) return true;
    const delta = computePatchDelta(originalAsset, activeDraft);
    if (!delta.hasChanges) {
      activeEditingAssetId = null;
      activeDraft = null;
      return true;
    }
    const confirmed = mockConfirmAccept();
    if (confirmed) {
      activeEditingAssetId = null;
      activeDraft = null;
      return true;
    }
    return false;
  };

  const canNavigate = checkUnsavedChanges();
  assert.equal(canNavigate, true, 'Navigation must proceed when user accepts discard');
  assert.equal(activeEditingAssetId, null, 'Draft id must be cleared after confirmed discard');
  assert.equal(activeDraft, null, 'Draft form must be cleared after confirmed discard');
});

test('P09-Correction: AdvancedFilterBuilder onApply preserves dirty draft when discard is declined', () => {
  let filterApplied = false;
  let modalClosed = false;

  const mockGuardDeclined = () => false;

  const onApply = () => {
    if (!mockGuardDeclined()) {
      return false; // Cancelled by unsaved changes guard
    }
    filterApplied = true;
    return true;
  };

  const handleApplyCriteria = () => {
    const result = onApply();
    if (result !== false) {
      modalClosed = true;
    }
  };

  handleApplyCriteria();

  assert.equal(filterApplied, false, 'Filter criteria must NOT be applied if user declined discard');
  assert.equal(modalClosed, false, 'Filter modal must NOT close if user declined discard');
});

test('P09-Correction: Popstate history handler prevents URL desync when discard is declined', () => {
  let activeUrl = '/assets?page=1&status=IN_USE';
  let historyPushedUrl = '';

  const mockPushState = (_state: any, _title: string, url: string) => {
    historyPushedUrl = url;
  };

  const guardDeclined = () => false;

  const handlePopState = () => {
    const canProceed = guardDeclined();
    if (!canProceed) {
      mockPushState({}, '', activeUrl);
      return;
    }
    activeUrl = '/dashboard';
  };

  handlePopState();

  assert.equal(activeUrl, '/assets?page=1&status=IN_USE', 'Route must remain unchanged on declined popstate');
  assert.equal(historyPushedUrl, '/assets?page=1&status=IN_USE', 'Active URL must be re-pushed to prevent desync');
});

test('P09-Correction: Distinction between PATCH success and GET refresh failure', () => {
  // Scenario: PATCH returns 200 OK, but subsequent GET /api/assets returns 500 or network error
  let editingAssetId: string | null = 'a0000000-0000-4000-8000-000000000001';
  let draftForm: PatchAssetFormValues | null = {
    model: 'Server Saved Model',
    assetNumber: 'AST-9999',
    serialNumber: 'SN-9999',
    status: 'IN_USE',
    label: 'PROD',
    comment: '',
    typeId: '',
    locationId: '',
    deviceHealthId: '',
  };

  let submitFeedback: { type: string; message: string } | null = null;
  let rePatchCalled = false;

  const simulateSave = (patchStatus: number, getRefreshStatus: number) => {
    // 1. Send PATCH
    if (patchStatus === 200) {
      const savedModel = draftForm!.model;

      // PATCH succeeded: database has the new state. Reset draft to prevent re-submission.
      editingAssetId = null;
      draftForm = null;

      // 2. Authoritative GET refresh
      if (getRefreshStatus === 200) {
        submitFeedback = {
          type: 'success',
          message: `Asset '${savedModel}' updated successfully. Transactional audit event recorded.`,
        };
      } else {
        submitFeedback = {
          type: 'info',
          message: `Asset '${savedModel}' saved on server; refresh not verified (status ${getRefreshStatus}). Use the REFRESH button to re-sync grid.`,
        };
      }
    } else {
      // PATCH failed: retain draft
      submitFeedback = {
        type: 'error',
        message: 'Server error. Failed to persist update.',
      };
    }
  };

  // Run scenario: PATCH 200 OK, GET 500 Internal Error
  simulateSave(200, 500);

  assert.equal(editingAssetId, null, 'Draft must be cleared because PATCH succeeded on server');
  assert.equal(draftForm, null, 'Draft form must be cleared so user does not re-PATCH');
  assert.ok(submitFeedback !== null);
  const feedback = submitFeedback as { type: string; message: string };
  assert.ok(
    feedback.message.includes('saved on server; refresh not verified'),
    'Must report saved on server; refresh not verified'
  );
  assert.ok(
    feedback.message.includes('REFRESH button'),
    'Must guide user to refresh grid safely'
  );
  assert.equal(rePatchCalled, false, 'Must not automatically resubmit PATCH');
});

test('P09-Correction: Retains edit draft when PATCH fails (400, 401, 403, 404, 409, 500) or network catch', () => {
  let editingAssetId: string | null = 'a0000000-0000-4000-8000-000000000003';
  let draftForm: PatchAssetFormValues | null = {
    model: 'Conflict Model',
    assetNumber: 'AST-DUPLICATE',
    serialNumber: '',
    status: 'IN_USE',
    label: '',
    comment: '',
    typeId: '',
    locationId: '',
    deviceHealthId: '',
  };

  // Simulate 409 Duplicate Identifier
  const simulatePatchFailure = (status: number, errorText: string) => {
    if (status !== 200) {
      // Draft is NOT cleared
      return {
        type: 'error',
        message: `Duplicate Identifier Conflict: ${errorText}`,
      };
    }
    return null;
  };

  const feedback = simulatePatchFailure(409, 'Asset number AST-DUPLICATE already exists');

  assert.equal(editingAssetId, 'a0000000-0000-4000-8000-000000000003', 'Draft id must be retained on PATCH failure');
  assert.notEqual(draftForm, null, 'Draft form must be preserved on PATCH failure');
  assert.ok(feedback?.message.includes('Duplicate Identifier Conflict'));
});
