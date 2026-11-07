import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROVED_NAVIGATION_ITEMS } from '../src/types/navigation.ts';

test('P05 Navigation: contains EXACTLY the six approved primary navigation items', () => {
  assert.equal(APPROVED_NAVIGATION_ITEMS.length, 6, 'There must be exactly 6 navigation items');

  const approvedIds = APPROVED_NAVIGATION_ITEMS.map((item) => item.id);
  const expectedIds = ['dashboard', 'assets', 'new-asset', 'import', 'attention', 'settings'];

  assert.deepEqual(approvedIds, expectedIds);
});

test('P05 Navigation: all 6 navigation items have valid labels, paths, and phase targets', () => {
  const expectedRoutes: Record<string, { label: string; path: string; phase: string }> = {
    dashboard: { label: 'Dashboard', path: '/', phase: 'Phase P09' },
    assets: { label: 'All Assets', path: '/assets', phase: 'Phase P07 & P08' },
    'new-asset': { label: 'New Asset', path: '/assets/new', phase: 'Phase P06' },
    import: { label: 'Import Assets', path: '/import', phase: 'Phase P12' },
    attention: { label: 'Needs Attention', path: '/attention', phase: 'Phase P13' },
    settings: { label: 'Settings & Backup', path: '/settings', phase: 'Phase P14 & P15' },
  };

  for (const item of APPROVED_NAVIGATION_ITEMS) {
    const expected = expectedRoutes[item.id];
    assert.ok(expected, `Item ${item.id} must be mapped`);
    assert.equal(item.label, expected.label);
    assert.equal(item.path, expected.path);
    assert.equal(item.targetPhase, expected.phase);
    assert.ok(item.description && item.description.length > 10);
  }
});

test('P05 Navigation: does not contain unauthorized items from visual screenshots', () => {
  const unapprovedNames = ['employees', 'reports', 'user-management', 'analytics'];
  const currentIds = APPROVED_NAVIGATION_ITEMS.map((item) => item.id.toLowerCase());

  for (const name of unapprovedNames) {
    assert.ok(
      !currentIds.includes(name),
      `Navigation must NOT include unapproved screenshot item: ${name}`
    );
  }
});
