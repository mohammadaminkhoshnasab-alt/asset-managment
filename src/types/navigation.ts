export type NavigationRoute =
  | 'dashboard'
  | 'assets'
  | 'new-asset'
  | 'import'
  | 'attention'
  | 'settings';

export interface NavItemConfig {
  id: NavigationRoute;
  label: string;
  path: string;
  targetPhase: string;
  description: string;
  badge?: string;
}

export const APPROVED_NAVIGATION_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/',
    targetPhase: 'Phase P09',
    description: 'Hardware fleet overview, lifecycle metrics, and operational audit summary.',
  },
  {
    id: 'assets',
    label: 'All Assets',
    path: '/assets',
    targetPhase: 'Phase P07 & P08',
    description: 'Comprehensive IT equipment registry, search filters, and status management.',
  },
  {
    id: 'new-asset',
    label: 'New Asset',
    path: '/assets/new',
    targetPhase: 'Phase P06',
    description: 'Register single hardware equipment with model specifications and serial numbers.',
  },
  {
    id: 'import',
    label: 'Import Assets',
    path: '/import',
    targetPhase: 'Phase P12',
    description: 'Batch spreadsheet ingestion, column mapping, and duplicate detection.',
    badge: 'XLSX',
  },
  {
    id: 'attention',
    label: 'Needs Attention',
    path: '/attention',
    targetPhase: 'Phase P13',
    description: 'Flagged discrepancy resolution, overdue audits, and missing inventory follow-ups.',
  },
  {
    id: 'settings',
    label: 'Settings & Backup',
    path: '/settings',
    targetPhase: 'Phase P14 & P15',
    description: 'System thresholds, lookup options, data export, and database backup tools.',
  },
];
