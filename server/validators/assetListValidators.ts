import { AssetStatus, Prisma } from '@prisma/client';
import { isValidUuid, VALID_ASSET_STATUSES } from './assetValidators.ts';

export type SortOrder = 'asc' | 'desc';

export const ALLOWED_SORT_FIELDS = [
  'assetNumber',
  'serialNumber',
  'model',
  'status',
  'department',
  'costCenter',
  'label',
  'createdAt',
  'updatedAt',
  'type',
  'location',
  'deviceHealth',
  'acOwner',
  'currentUser',
] as const;

export type AllowedSortField = (typeof ALLOWED_SORT_FIELDS)[number];

export const ALLOWED_FILTER_FIELDS = [
  'status',
  'model',
  'assetNumber',
  'serialNumber',
  'label',
  'department',
  'costCenter',
  'typeId',
  'locationId',
  'deviceHealthId',
  'acOwnerId',
  'currentUserId',
  'createdAt',
  'updatedAt',
] as const;

export type AllowedFilterField = (typeof ALLOWED_FILTER_FIELDS)[number];

export type FilterOperator =
  | 'equals'
  | 'contains'
  | 'in'
  | 'empty'
  | 'notEmpty'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte';

export interface FilterRule {
  field: AllowedFilterField;
  operator: FilterOperator;
  value?: any;
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  rules: (FilterRule | FilterGroup)[];
}

export interface ParsedListAssetsQuery {
  page: number;
  pageSize: number;
  sortBy: AllowedSortField;
  sortOrder: SortOrder;
  q?: string;
  filters?: FilterGroup;
}

export interface ValidationSuccess<T> {
  valid: true;
  data: T;
}

export interface ValidationFailure {
  valid: false;
  error: string;
  field?: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

const MAX_FILTER_DEPTH = 2;
const MAX_TOTAL_RULES = 20;

/**
 * Validates a single filter rule against field and operator compatibility.
 */
function validateRule(rule: unknown): ValidationResult<FilterRule> {
  if (!rule || typeof rule !== 'object') {
    return { valid: false, error: 'Filter rule must be an object.' };
  }

  const raw = rule as Record<string, unknown>;
  const field = raw.field;
  const operator = raw.operator;

  if (typeof field !== 'string' || !ALLOWED_FILTER_FIELDS.includes(field as AllowedFilterField)) {
    return {
      valid: false,
      error: `Unsupported or unknown filter field '${field}'. Allowed: ${ALLOWED_FILTER_FIELDS.join(', ')}`,
      field: typeof field === 'string' ? field : undefined,
    };
  }

  const typedField = field as AllowedFilterField;

  if (
    typeof operator !== 'string' ||
    !['equals', 'contains', 'in', 'empty', 'notEmpty', 'gt', 'lt', 'gte', 'lte'].includes(operator)
  ) {
    return {
      valid: false,
      error: `Invalid operator '${operator}' for field '${field}'.`,
      field,
    };
  }

  const typedOperator = operator as FilterOperator;

  // Field-operator compatibility checks
  if (typedField === 'status') {
    if (!['equals', 'in', 'empty', 'notEmpty'].includes(typedOperator)) {
      return {
        valid: false,
        error: `Operator '${typedOperator}' is not supported for field 'status'. Allowed: equals, in, empty, notEmpty.`,
        field,
      };
    }
    if (typedOperator === 'equals') {
      if (typeof raw.value !== 'string' || !VALID_ASSET_STATUSES.includes(raw.value as AssetStatus)) {
        return {
          valid: false,
          error: `Status value '${raw.value}' must be one of: ${VALID_ASSET_STATUSES.join(', ')}.`,
          field,
        };
      }
    } else if (typedOperator === 'in') {
      if (
        !Array.isArray(raw.value) ||
        raw.value.length === 0 ||
        raw.value.some((v) => typeof v !== 'string' || !VALID_ASSET_STATUSES.includes(v as AssetStatus))
      ) {
        return {
          valid: false,
          error: `Status 'in' operator requires a non-empty array of valid status values.`,
          field,
        };
      }
    }
  } else if (
    ['typeId', 'locationId', 'deviceHealthId', 'acOwnerId', 'currentUserId'].includes(typedField)
  ) {
    if (!['equals', 'in', 'empty', 'notEmpty'].includes(typedOperator)) {
      return {
        valid: false,
        error: `Operator '${typedOperator}' is not supported for UUID reference field '${field}'.`,
        field,
      };
    }
    if (typedOperator === 'equals') {
      if (typeof raw.value !== 'string' || !isValidUuid(raw.value)) {
        return {
          valid: false,
          error: `Field '${field}' with 'equals' operator requires a valid UUID value.`,
          field,
        };
      }
    } else if (typedOperator === 'in') {
      if (
        !Array.isArray(raw.value) ||
        raw.value.length === 0 ||
        raw.value.some((v) => typeof v !== 'string' || !isValidUuid(v))
      ) {
        return {
          valid: false,
          error: `Field '${field}' with 'in' operator requires a non-empty array of valid UUIDs.`,
          field,
        };
      }
    }
  } else if (['createdAt', 'updatedAt'].includes(typedField)) {
    if (!['equals', 'gt', 'lt', 'gte', 'lte'].includes(typedOperator)) {
      return {
        valid: false,
        error: `Operator '${typedOperator}' is not supported for date field '${field}'.`,
        field,
      };
    }
    if (typeof raw.value !== 'string' || isNaN(Date.parse(raw.value))) {
      return {
        valid: false,
        error: `Date field '${field}' requires a valid ISO date string.`,
        field,
      };
    }
  } else {
    // Text fields: model, assetNumber, serialNumber, label, department, costCenter
    if (!['equals', 'contains', 'empty', 'notEmpty'].includes(typedOperator)) {
      return {
        valid: false,
        error: `Operator '${typedOperator}' is not supported for text field '${field}'.`,
        field,
      };
    }
    if (['equals', 'contains'].includes(typedOperator)) {
      if (typeof raw.value !== 'string' || raw.value.trim().length === 0) {
        return {
          valid: false,
          error: `Field '${field}' with '${typedOperator}' operator requires a non-empty string value.`,
          field,
        };
      }
    }
  }

  return {
    valid: true,
    data: {
      field: typedField,
      operator: typedOperator,
      value: raw.value !== undefined ? raw.value : undefined,
    },
  };
}

/**
 * Validates a recursive filter group with strict depth and count bounds.
 */
function validateGroup(
  group: unknown,
  depth = 1,
  counter = { count: 0 }
): ValidationResult<FilterGroup> {
  if (depth > MAX_FILTER_DEPTH) {
    return {
      valid: false,
      error: `Filter nesting depth exceeds maximum allowed limit of ${MAX_FILTER_DEPTH}.`,
    };
  }

  if (!group || typeof group !== 'object') {
    return { valid: false, error: 'Filter group must be an object.' };
  }

  const raw = group as Record<string, unknown>;
  const operator = raw.operator;

  if (operator !== 'AND' && operator !== 'OR') {
    return {
      valid: false,
      error: "Filter group operator must be 'AND' or 'OR'.",
    };
  }

  if (!Array.isArray(raw.rules)) {
    return {
      valid: false,
      error: "Filter group 'rules' must be an array.",
    };
  }

  const validatedRules: (FilterRule | FilterGroup)[] = [];

  for (const item of raw.rules) {
    counter.count++;
    if (counter.count > MAX_TOTAL_RULES) {
      return {
        valid: false,
        error: `Total number of filter rules exceeds maximum limit of ${MAX_TOTAL_RULES}.`,
      };
    }

    if (item && typeof item === 'object' && 'operator' in item && ('AND' === item.operator || 'OR' === item.operator)) {
      // Child group
      const childRes = validateGroup(item, depth + 1, counter);
      if (!childRes.valid) {
        return childRes;
      }
      validatedRules.push(childRes.data);
    } else {
      // Rule item
      const ruleRes = validateRule(item);
      if (!ruleRes.valid) {
        return ruleRes;
      }
      validatedRules.push(ruleRes.data);
    }
  }

  return {
    valid: true,
    data: {
      operator: operator as 'AND' | 'OR',
      rules: validatedRules,
    },
  };
}

/**
 * Validates all query parameters for GET /api/assets.
 */
export function validateListAssetsQuery(query: Record<string, unknown>): ValidationResult<ParsedListAssetsQuery> {
  // 1. Pagination: page
  let page = 1;
  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const parsedPage = Number(query.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return {
        valid: false,
        error: "Query parameter 'page' must be a positive integer (>= 1).",
        field: 'page',
      };
    }
    page = parsedPage;
  }

  // 2. Pagination: pageSize
  let pageSize = 25;
  if (query.pageSize !== undefined && query.pageSize !== null && query.pageSize !== '') {
    const parsedSize = Number(query.pageSize);
    if (!Number.isInteger(parsedSize) || parsedSize < 1 || parsedSize > 100) {
      return {
        valid: false,
        error: "Query parameter 'pageSize' must be an integer between 1 and 100.",
        field: 'pageSize',
      };
    }
    pageSize = parsedSize;
  }

  // 3. Sorting: sortBy
  let sortBy: AllowedSortField = 'updatedAt';
  if (query.sortBy !== undefined && query.sortBy !== null && query.sortBy !== '') {
    if (typeof query.sortBy !== 'string' || !ALLOWED_SORT_FIELDS.includes(query.sortBy as AllowedSortField)) {
      return {
        valid: false,
        error: `Query parameter 'sortBy' must be one of: ${ALLOWED_SORT_FIELDS.join(', ')}.`,
        field: 'sortBy',
      };
    }
    sortBy = query.sortBy as AllowedSortField;
  }

  // 4. Sorting: sortOrder
  let sortOrder: SortOrder = 'desc';
  if (query.sortOrder !== undefined && query.sortOrder !== null && query.sortOrder !== '') {
    const orderStr = String(query.sortOrder).toLowerCase();
    if (orderStr !== 'asc' && orderStr !== 'desc') {
      return {
        valid: false,
        error: "Query parameter 'sortOrder' must be 'asc' or 'desc'.",
        field: 'sortOrder',
      };
    }
    sortOrder = orderStr;
  }

  // 5. Global search: q
  let q: string | undefined;
  if (query.q !== undefined && query.q !== null && query.q !== '') {
    if (typeof query.q !== 'string') {
      return {
        valid: false,
        error: "Search parameter 'q' must be a string.",
        field: 'q',
      };
    }
    const trimmed = query.q.trim();
    if (trimmed.length > 100) {
      return {
        valid: false,
        error: "Search parameter 'q' must not exceed 100 characters.",
        field: 'q',
      };
    }
    if (trimmed.length > 0) {
      q = trimmed;
    }
  }

  // 6. Structured filter composition: filters
  let filters: FilterGroup | undefined;

  // 6a. Direct top-level quick filters (convenience shortcuts mapped to rules)
  const quickRules: FilterRule[] = [];

  if (query.status) {
    const rawStatus = String(query.status);
    const statuses = rawStatus.split(',').map((s) => s.trim());
    const validStatuses = statuses.filter((s) => VALID_ASSET_STATUSES.includes(s as AssetStatus));
    if (validStatuses.length === 0) {
      return {
        valid: false,
        error: `Status filter must be one or more valid statuses: ${VALID_ASSET_STATUSES.join(', ')}`,
        field: 'status',
      };
    }
    if (validStatuses.length === 1) {
      quickRules.push({ field: 'status', operator: 'equals', value: validStatuses[0] });
    } else {
      quickRules.push({ field: 'status', operator: 'in', value: validStatuses });
    }
  }

  if (query.typeId) {
    const tid = String(query.typeId).trim();
    if (!isValidUuid(tid)) {
      return { valid: false, error: "Parameter 'typeId' must be a valid UUID.", field: 'typeId' };
    }
    quickRules.push({ field: 'typeId', operator: 'equals', value: tid });
  }

  if (query.locationId) {
    const lid = String(query.locationId).trim();
    if (!isValidUuid(lid)) {
      return { valid: false, error: "Parameter 'locationId' must be a valid UUID.", field: 'locationId' };
    }
    quickRules.push({ field: 'locationId', operator: 'equals', value: lid });
  }

  if (query.deviceHealthId) {
    const dhid = String(query.deviceHealthId).trim();
    if (!isValidUuid(dhid)) {
      return { valid: false, error: "Parameter 'deviceHealthId' must be a valid UUID.", field: 'deviceHealthId' };
    }
    quickRules.push({ field: 'deviceHealthId', operator: 'equals', value: dhid });
  }

  if (query.department) {
    const dept = String(query.department).trim();
    if (dept.length > 0) {
      quickRules.push({ field: 'department', operator: 'contains', value: dept });
    }
  }

  if (query.costCenter) {
    const cc = String(query.costCenter).trim();
    if (cc.length > 0) {
      quickRules.push({ field: 'costCenter', operator: 'contains', value: cc });
    }
  }

  // 6b. JSON-encoded structured filters parameter
  if (query.filters !== undefined && query.filters !== null && query.filters !== '') {
    let rawGroup: unknown;
    if (typeof query.filters === 'string') {
      try {
        rawGroup = JSON.parse(query.filters);
      } catch {
        return {
          valid: false,
          error: "Malformed JSON in 'filters' query parameter.",
          field: 'filters',
        };
      }
    } else if (typeof query.filters === 'object') {
      rawGroup = query.filters;
    } else {
      return {
        valid: false,
        error: "'filters' parameter must be a JSON object or string.",
        field: 'filters',
      };
    }

    const groupResult = validateGroup(rawGroup);
    if (!groupResult.valid) {
      return groupResult;
    }
    filters = groupResult.data;
  }

  // Combine quick rules with structured filters if both present
  if (quickRules.length > 0) {
    if (filters) {
      filters = {
        operator: 'AND',
        rules: [...quickRules, filters],
      };
    } else {
      filters = {
        operator: 'AND',
        rules: quickRules,
      };
    }
  }

  return {
    valid: true,
    data: {
      page,
      pageSize,
      sortBy,
      sortOrder,
      q,
      filters,
    },
  };
}

/**
 * Builds a Prisma `where` clause from validated `q` and `filters`.
 * Uses pure Prisma query composition and parameterization; no raw SQL.
 */
export function buildPrismaWhereClause(
  q?: string,
  filters?: FilterGroup
): Prisma.AssetWhereInput {
  const andClauses: Prisma.AssetWhereInput[] = [];

  // 1. Global search clause across searchable text fields
  if (q && q.trim().length > 0) {
    const term = q.trim();
    andClauses.push({
      OR: [
        { model: { contains: term, mode: 'insensitive' } },
        { assetNumber: { contains: term, mode: 'insensitive' } },
        { serialNumber: { contains: term, mode: 'insensitive' } },
        { label: { contains: term, mode: 'insensitive' } },
        { department: { contains: term, mode: 'insensitive' } },
        { costCenter: { contains: term, mode: 'insensitive' } },
      ],
    });
  }

  // 2. Advanced filter composition
  if (filters && filters.rules.length > 0) {
    const filterWhere = buildGroupWhere(filters);
    if (filterWhere) {
      andClauses.push(filterWhere);
    }
  }

  if (andClauses.length === 0) {
    return {};
  }

  if (andClauses.length === 1) {
    return andClauses[0];
  }

  return { AND: andClauses };
}

function buildRuleWhere(rule: FilterRule): Prisma.AssetWhereInput | null {
  const { field, operator, value } = rule;

  switch (field) {
    case 'status': {
      if (operator === 'equals') return { status: value as AssetStatus };
      if (operator === 'in') return { status: { in: value as AssetStatus[] } };
      if (operator === 'empty') return { status: 'UNKNOWN' };
      if (operator === 'notEmpty') return { NOT: { status: 'UNKNOWN' } };
      return null;
    }

    case 'typeId':
    case 'locationId':
    case 'deviceHealthId':
    case 'acOwnerId':
    case 'currentUserId': {
      if (operator === 'equals') return { [field]: value };
      if (operator === 'in') return { [field]: { in: value } };
      if (operator === 'empty') return { [field]: null };
      if (operator === 'notEmpty') return { NOT: { [field]: null } };
      return null;
    }

    case 'createdAt':
    case 'updatedAt': {
      const dateVal = new Date(value);
      if (operator === 'equals') return { [field]: dateVal };
      if (operator === 'gte') return { [field]: { gte: dateVal } };
      if (operator === 'lte') return { [field]: { lte: dateVal } };
      if (operator === 'gt') return { [field]: { gt: dateVal } };
      if (operator === 'lt') return { [field]: { lt: dateVal } };
      return null;
    }

    case 'model':
    case 'assetNumber':
    case 'serialNumber':
    case 'label':
    case 'department':
    case 'costCenter': {
      if (operator === 'equals') {
        return { [field]: { equals: String(value).trim(), mode: 'insensitive' } };
      }
      if (operator === 'contains') {
        return { [field]: { contains: String(value).trim(), mode: 'insensitive' } };
      }
      if (operator === 'empty') {
        return {
          OR: [{ [field]: null }, { [field]: '' }],
        };
      }
      if (operator === 'notEmpty') {
        return {
          AND: [
            { NOT: { [field]: null } },
            { NOT: { [field]: '' } },
          ],
        };
      }
      return null;
    }

    default:
      return null;
  }
}

function buildGroupWhere(group: FilterGroup): Prisma.AssetWhereInput | null {
  const childWheres: Prisma.AssetWhereInput[] = [];

  for (const item of group.rules) {
    if ('operator' in item && ('AND' === item.operator || 'OR' === item.operator)) {
      const sub = buildGroupWhere(item as FilterGroup);
      if (sub && Object.keys(sub).length > 0) {
        childWheres.push(sub);
      }
    } else {
      const ruleWhere = buildRuleWhere(item as FilterRule);
      if (ruleWhere && Object.keys(ruleWhere).length > 0) {
        childWheres.push(ruleWhere);
      }
    }
  }

  if (childWheres.length === 0) {
    return null;
  }

  if (group.operator === 'OR') {
    return { OR: childWheres };
  }

  return { AND: childWheres };
}

/**
 * Builds Prisma `orderBy` array with deterministic tie-breaker.
 */
export function buildPrismaOrderBy(
  sortBy: AllowedSortField,
  sortOrder: SortOrder
): Prisma.AssetOrderByWithRelationInput[] {
  let primarySort: Prisma.AssetOrderByWithRelationInput;

  switch (sortBy) {
    case 'type':
      primarySort = { type: { name: sortOrder } };
      break;
    case 'location':
      primarySort = { location: { name: sortOrder } };
      break;
    case 'deviceHealth':
      primarySort = { deviceHealth: { name: sortOrder } };
      break;
    case 'acOwner':
      primarySort = { acOwner: { fullName: sortOrder } };
      break;
    case 'currentUser':
      primarySort = { currentUser: { fullName: sortOrder } };
      break;
    default:
      primarySort = { [sortBy]: sortOrder };
      break;
  }

  // Always append deterministic secondary tie-breaker
  return [primarySort, { id: 'asc' }];
}
