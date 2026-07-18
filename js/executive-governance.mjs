export const EXECUTIVE_SECTIONS = Object.freeze([
  Object.freeze({ sectionId: 'ioe-product-portfolio', label: 'IoE Product Portfolio' }),
  Object.freeze({ sectionId: 'customer-engagements', label: 'Customer Engagements' }),
  Object.freeze({ sectionId: 'investors-strategy', label: 'Investors & Strategy' }),
]);

const ROLES = new Set(['admin', 'executive', 'pm', 'engineering', 'sales', 'bd', 'product']);
const ALL_SECTION_IDS = EXECUTIVE_SECTIONS.map(item => item.sectionId);
const VIEW = {
  admin: new Set(ALL_SECTION_IDS),
  executive: new Set(ALL_SECTION_IDS),
  pm: new Set(['ioe-product-portfolio']),
  engineering: new Set(['ioe-product-portfolio']),
  sales: new Set(ALL_SECTION_IDS),
  bd: new Set(ALL_SECTION_IDS),
  product: new Set(ALL_SECTION_IDS),
};
const UPDATE = {
  admin: VIEW.admin,
  executive: VIEW.executive,
  pm: new Set(['ioe-product-portfolio']),
  engineering: new Set(['ioe-product-portfolio']),
  sales: new Set(['customer-engagements']),
  bd: new Set(['customer-engagements']),
  product: new Set(['customer-engagements']),
};
const RAG_SEVERITY = Object.freeze({ green: 0, yellow: 1, red: 2 });
const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeExecutiveRole(value, { allowVipBridge = false } = {}) {
  const role = String(value || '').trim().toLowerCase();
  if (allowVipBridge && role === 'vip') return 'executive';
  return ROLES.has(role) ? role : '';
}

export function canViewExecutiveSection(role, sectionId) {
  return VIEW[normalizeExecutiveRole(role)]?.has(String(sectionId || '')) === true;
}

export function canUpdateExecutiveSection(role, sectionId) {
  return UPDATE[normalizeExecutiveRole(role)]?.has(String(sectionId || '')) === true;
}

export function canChangeExecutiveStructure(role) {
  return ['admin', 'executive'].includes(normalizeExecutiveRole(role));
}

export function canApproveExecutiveRequest(role) {
  return normalizeExecutiveRole(role) === 'executive';
}

export function calculateVisibleExecutiveRag(items, role) {
  const visibleRags = (Array.isArray(items) ? items : [])
    .filter(item => canViewExecutiveSection(role, item?.sectionId))
    .map(item => String(item?.rag || '').trim().toLowerCase())
    .filter(rag => Object.hasOwn(RAG_SEVERITY, rag));

  if (!visibleRags.length) return null;
  return visibleRags.reduce(
    (worst, rag) => RAG_SEVERITY[rag] > RAG_SEVERITY[worst] ? rag : worst,
    visibleRags[0],
  );
}

export function getExecutiveUpdateFreshness(lastUpdatedAt, now = Date.now()) {
  const updatedAt = typeof lastUpdatedAt === 'number'
    ? lastUpdatedAt
    : Date.parse(String(lastUpdatedAt || ''));
  const currentTime = typeof now === 'number' ? now : Date.parse(String(now || ''));
  if (!Number.isFinite(updatedAt) || !Number.isFinite(currentTime)) return 'overdue';

  const elapsedDays = Math.max(0, (currentTime - updatedAt) / DAY_MS);
  if (elapsedDays > 45) return 'overdue';
  if (elapsedDays > 31) return 'due';
  return 'current';
}

export function validateExecutiveItemUpdate({ originalRag, rag, statusText } = {}) {
  const normalizedOriginalRag = String(originalRag || '').trim().toLowerCase();
  const normalizedRag = String(rag || '').trim().toLowerCase();
  const normalizedStatusText = String(statusText || '').trim();

  if (!Object.hasOwn(RAG_SEVERITY, normalizedRag)) {
    throw new Error('RAG must be green, yellow, or red.');
  }
  if (normalizedRag !== normalizedOriginalRag && !normalizedStatusText) {
    throw new Error('A status update is required when RAG changes.');
  }
  return { rag: normalizedRag, statusText: normalizedStatusText };
}
