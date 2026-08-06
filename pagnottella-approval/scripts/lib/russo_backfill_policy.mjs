export const PAGNOTTELLA_PUBLISHED_AT = new Date('2026-07-29T14:50:37.000Z');
export const AUDITED_LEGACY_MAX_CREATED_AT = new Date('2026-07-30T07:41:32.003Z');
export const EXPECTED_LEGACY_COUNT = 1051;

const PAGNOTTELLA_FIELDS = ['supplierName', 'deliveryAddress', 'company', 'costCenter'];
const RUSSO_FIELDS = ['orderType', 'posate'];

function asDate(value) {
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  return null;
}

export function classifyLegacyOrder(data = {}) {
  if (typeof data.supplierId === 'string' && data.supplierId.trim()) {
    return { status: 'excluded', reason: 'supplier-present' };
  }
  const createdAt = asDate(data.createdAt);
  if (!createdAt) return { status: 'ambiguous', reason: 'missing-created-at' };
  if (createdAt > AUDITED_LEGACY_MAX_CREATED_AT) {
    return { status: 'ambiguous', reason: 'outside-audited-window' };
  }
  if (PAGNOTTELLA_FIELDS.some(field => field in data)) {
    return { status: 'ambiguous', reason: 'pagnottella-schema-signal' };
  }
  const predatesPagnottella = createdAt < PAGNOTTELLA_PUBLISHED_AT;
  const hasRussoSchema = RUSSO_FIELDS.some(field => field in data);
  if (!predatesPagnottella && !hasRussoSchema) {
    return { status: 'ambiguous', reason: 'insufficient-russo-evidence' };
  }
  return {
    status: 'certain-russo',
    reason: predatesPagnottella ? 'predates-pagnottella' : 'russo-schema-in-audited-window'
  };
}

