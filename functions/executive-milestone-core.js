'use strict';

const ROLES = new Set(['admin', 'executive', 'pm', 'engineering', 'sales', 'bd', 'product']);
const SECTION_IDS = ['ioe-product-portfolio', 'customer-engagements', 'investors-strategy'];
const QUARTER_KEYS = ['q1', 'q2', 'q3', 'q4'];
const CHANGE_TYPES = new Set(['add', 'rename', 'move-section', 'move-quarter', 'reorder', 'delete']);
const RAGS = new Set(['green', 'yellow', 'red']);
const RAG_TO_HEALTH = { green: 'on-track', yellow: 'at-risk', red: 'delayed' };
const VIEW = {
  admin: new Set(SECTION_IDS),
  executive: new Set(SECTION_IDS),
  pm: new Set(['ioe-product-portfolio']),
  engineering: new Set(['ioe-product-portfolio']),
  sales: new Set(SECTION_IDS),
  bd: new Set(SECTION_IDS),
  product: new Set(SECTION_IDS),
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

function fail(message, code = 'failed-precondition') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createExecutiveLegacyItemId(sectionId, quarterKey, index, text) {
  const seed = [sectionId, quarterKey, Number(index) || 0, String(text || '').trim()].join('|');
  let hash = 2166136261;
  for (let position = 0; position < seed.length; position += 1) {
    hash ^= seed.charCodeAt(position);
    hash = Math.imul(hash, 16777619);
  }
  return `exec-${(hash >>> 0).toString(36)}`;
}

function normalizedVersion(value) {
  const version = Number.parseInt(value, 10);
  return Number.isFinite(version) && version >= 0 ? version : 0;
}

function normalizedQuarter(value) {
  const quarterKey = String(value || '').trim().toLowerCase();
  if (!QUARTER_KEYS.includes(quarterKey)) fail('A valid quarter is required.', 'invalid-argument');
  return quarterKey;
}

function normalizedSection(value) {
  const sectionId = String(value || '').trim();
  if (!SECTION_IDS.includes(sectionId)) fail('A valid Executive section is required.', 'invalid-argument');
  return sectionId;
}

function normalizedIndex(value, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return max;
  return Math.max(0, Math.min(max, parsed));
}

function timelineOf(week) {
  const timeline = week?.strategyLayer?.executiveMilestoneTimeline;
  if (!timeline || !Array.isArray(timeline.rows)) {
    fail('Executive milestone timeline is unavailable.', 'not-found');
  }
  return timeline;
}

function cellsOf(row) {
  if (Array.isArray(row.cells)) {
    return Object.fromEntries(QUARTER_KEYS.map((key, index) => [key, Array.isArray(row.cells[index]) ? row.cells[index] : []]));
  }
  return row.cells || {};
}

function ensureFirestoreSafeCells(row) {
  if (Array.isArray(row.cells)) row.cells = cellsOf(row);
  if (!row.cells || typeof row.cells !== 'object') row.cells = {};
  for (const key of QUARTER_KEYS) {
    if (!Array.isArray(row.cells[key])) row.cells[key] = [];
  }
  return row.cells;
}

function sectionRow(week, sectionId) {
  const rows = timelineOf(week).rows;
  const rowIndex = rows.findIndex(row => row?.sectionId === sectionId);
  if (rowIndex < 0) fail('Executive section was not found.', 'not-found');
  return { row: rows[rowIndex], rowIndex };
}

function locationSnapshot(location) {
  const item = normalizeItem(location.item);
  if (!item.id) item.id = location.resolvedItemId;
  return {
    sectionId: location.sectionId,
    quarterKey: location.quarterKey,
    index: location.itemIndex,
    item,
  };
}

function canView(role, sectionId) {
  return VIEW[normalizeRole(role)]?.has(sectionId) === true;
}

function authorizeView(role, sectionId) {
  if (!canView(role, sectionId)) fail('Role is not authorized to view this Executive section.', 'permission-denied');
  return true;
}

function normalizeItem(item = {}) {
  if (typeof item === 'string') item = { text: item };
  const rag = RAGS.has(String(item.rag || '').toLowerCase())
    ? String(item.rag).toLowerCase()
    : item.manualHealth === 'delayed' || item.status === 'delayed'
      ? 'red'
      : item.manualHealth === 'at-risk' || item.status === 'at-risk' ? 'yellow' : 'green';
  return {
    ...cloneJson(item),
    id: String(item.id || '').trim(),
    text: String(item.text || item.label || '').trim(),
    version: normalizedVersion(item.version),
    rag,
    manualHealth: RAG_TO_HEALTH[rag],
    status: RAG_TO_HEALTH[rag],
    latestStatusText: String(item.latestStatusText || '').trim(),
    latestStatusAt: String(item.latestStatusAt || ''),
    latestStatusBy: String(item.latestStatusBy || ''),
  };
}

function proposalFor(week, input, role) {
  const changeType = String(input.changeType || '').trim();
  if (!CHANGE_TYPES.has(changeType)) fail('Unsupported structural change type.', 'invalid-argument');

  if (changeType === 'add') {
    const sectionId = normalizedSection(input.after?.sectionId);
    const quarterKey = normalizedQuarter(input.after?.quarterKey);
    authorizeView(role, sectionId);
    const item = normalizeItem(input.after?.item);
    if (!item.id) fail('A stable milestone itemId is required.', 'invalid-argument');
    if (!item.text) fail('Milestone title is required.', 'invalid-argument');
    try {
      findItemLocation(week, item.id);
      fail('Milestone itemId already exists.', 'already-exists');
    } catch (error) {
      if (error.code !== 'not-found') throw error;
    }
    item.version = 0;
    item.rag = 'green';
    item.manualHealth = 'on-track';
    item.status = 'on-track';
    item.latestStatusText = '';
    item.latestStatusAt = '';
    item.latestStatusBy = '';
    const target = sectionRow(week, sectionId);
    const cells = cellsOf(target.row);
    const index = normalizedIndex(input.after?.index, Array.isArray(cells[quarterKey]) ? cells[quarterKey].length : 0);
    return { changeType, itemId: item.id, targetVersion: 0, before: null, after: { sectionId, quarterKey, index, item } };
  }

  const itemId = String(input.itemId || '').trim();
  const location = findItemLocation(week, itemId);
  authorizeView(role, location.sectionId);
  const expectedVersion = normalizedVersion(input.expectedVersion);
  if (expectedVersion !== normalizedVersion(location.item.version)) fail('Milestone version conflict.', 'aborted');

  const before = locationSnapshot(location);
  if (changeType === 'delete') {
    return { changeType, itemId, targetVersion: expectedVersion, before, after: null };
  }

  const after = cloneJson(before);
  if (changeType === 'rename') {
    const text = String(input.after?.item?.text || '').trim();
    if (!text) fail('Milestone title is required.', 'invalid-argument');
    after.item.text = text;
  } else if (changeType === 'move-section') {
    after.sectionId = normalizedSection(input.after?.sectionId);
    authorizeView(role, after.sectionId);
    after.index = normalizedIndex(input.after?.index, Number.MAX_SAFE_INTEGER);
  } else if (changeType === 'move-quarter') {
    after.quarterKey = normalizedQuarter(input.after?.quarterKey);
    after.index = normalizedIndex(input.after?.index, Number.MAX_SAFE_INTEGER);
  } else if (changeType === 'reorder') {
    after.index = normalizedIndex(input.after?.index, Number.MAX_SAFE_INTEGER);
  }
  return { changeType, itemId, targetVersion: expectedVersion, before, after };
}

function applyProposal(week, proposal) {
  const nextWeek = cloneJson(week);

  if (proposal.changeType === 'add') {
    try {
      findItemLocation(nextWeek, proposal.itemId);
      fail('Milestone itemId already exists.', 'already-exists');
    } catch (error) {
      if (error.code !== 'not-found') throw error;
    }
    const destination = sectionRow(nextWeek, proposal.after.sectionId).row;
    const destinationCells = ensureFirestoreSafeCells(destination);
    const item = normalizeItem(proposal.after.item);
    item.version = 1;
    const index = normalizedIndex(proposal.after.index, destinationCells[proposal.after.quarterKey].length);
    destinationCells[proposal.after.quarterKey].splice(index, 0, item);
    return { week: nextWeek, item, before: null, after: { ...proposal.after, index, item: cloneJson(item) } };
  }

  const current = findItemLocation(nextWeek, proposal.itemId);
  if (normalizedVersion(current.item.version) !== normalizedVersion(proposal.targetVersion)) {
    fail('Milestone version conflict.', 'aborted');
  }
  const before = locationSnapshot(current);
  const sourceCells = ensureFirestoreSafeCells(current.row);
  const [removed] = sourceCells[current.quarterKey].splice(current.itemIndex, 1);

  if (proposal.changeType === 'delete') {
    return { week: nextWeek, item: null, before, after: null };
  }

  const item = normalizeItem(removed);
  if (!item.id) item.id = proposal.itemId;
  item.version = normalizedVersion(item.version) + 1;
  if (proposal.changeType === 'rename') item.text = String(proposal.after.item.text || '').trim();

  const destinationSection = proposal.changeType === 'move-section' ? proposal.after.sectionId : current.sectionId;
  const destinationQuarter = proposal.changeType === 'move-quarter' ? proposal.after.quarterKey : current.quarterKey;
  const destination = sectionRow(nextWeek, destinationSection).row;
  const destinationCells = ensureFirestoreSafeCells(destination);
  const destinationList = destinationCells[destinationQuarter];
  const requestedIndex = proposal.changeType === 'rename'
    ? current.itemIndex
    : proposal.changeType === 'reorder' || proposal.changeType === 'move-section' || proposal.changeType === 'move-quarter'
      ? proposal.after.index
      : destinationList.length;
  const index = normalizedIndex(requestedIndex, destinationList.length);
  destinationList.splice(index, 0, item);
  const after = { sectionId: destinationSection, quarterKey: destinationQuarter, index, item: cloneJson(item) };
  return { week: nextWeek, item, before, after };
}

function normalizeRole(value, { allowVipBridge = false } = {}) {
  const role = String(value || '').trim().toLowerCase();
  if (allowVipBridge && role === 'vip') return 'executive';
  return ROLES.has(role) ? role : '';
}

function authorizeUpdate(role, sectionId) {
  const normalized = normalizeRole(role);
  if (!UPDATE[normalized]?.has(String(sectionId || ''))) {
    fail('Role is not authorized to update this Executive section.', 'permission-denied');
  }
  return true;
}

function findItemLocation(week, itemId) {
  const targetId = String(itemId || '').trim();
  if (!targetId) fail('A milestone itemId is required.', 'invalid-argument');
  const rows = timelineOf(week).rows;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const cells = cellsOf(row);
    for (const quarterKey of QUARTER_KEYS) {
      const items = Array.isArray(cells[quarterKey]) ? cells[quarterKey] : [];
      const itemIndex = items.findIndex((item, index) => {
        const text = typeof item === 'string' ? item : item?.text || item?.label || '';
        const resolvedId = item && typeof item === 'object' && item.id
          ? String(item.id)
          : createExecutiveLegacyItemId(String(row.sectionId || ''), quarterKey, index, text);
        return resolvedId === targetId;
      });
      if (itemIndex >= 0) {
        const foundItem = items[itemIndex];
        const text = typeof foundItem === 'string' ? foundItem : foundItem?.text || foundItem?.label || '';
        return {
          row,
          rowIndex,
          sectionId: String(row.sectionId || ''),
          quarterKey,
          itemIndex,
          item: foundItem,
          resolvedItemId: foundItem && typeof foundItem === 'object' && foundItem.id
            ? String(foundItem.id)
            : createExecutiveLegacyItemId(String(row.sectionId || ''), quarterKey, itemIndex, text),
        };
      }
    }
  }
  fail('Executive milestone was not found.', 'not-found');
}

function applyItemUpdate(week, input = {}) {
  const role = normalizeRole(input.role);
  const location = findItemLocation(week, input.itemId);
  authorizeUpdate(role, location.sectionId);
  const expectedVersion = normalizedVersion(input.expectedVersion);
  const currentVersion = normalizedVersion(location.item.version);
  if (expectedVersion !== currentVersion) fail('Milestone version conflict.', 'aborted');

  const rag = String(input.rag || '').trim().toLowerCase();
  if (!RAGS.has(rag)) fail('RAG must be green, yellow, or red.', 'invalid-argument');
  const currentRag = normalizeItem(location.item).rag;
  const statusText = String(input.statusText || '').trim();
  if (!statusText && rag !== currentRag) {
    fail('A status update is required when RAG changes.', 'invalid-argument');
  }
  if (!statusText) fail('A status update is required.', 'invalid-argument');

  const now = String(input.now || new Date().toISOString());
  const actorEmail = String(input.actorEmail || '').trim().toLowerCase();
  const nextWeek = cloneJson(week);
  const nextLocation = findItemLocation(nextWeek, input.itemId);
  const item = normalizeItem(nextLocation.item);
  if (!item.id) item.id = nextLocation.resolvedItemId;
  item.version = currentVersion + 1;
  item.rag = rag;
  item.manualHealth = RAG_TO_HEALTH[rag];
  item.status = RAG_TO_HEALTH[rag];
  item.latestStatusText = statusText;
  item.latestStatusAt = now;
  item.latestStatusBy = actorEmail;
  ensureFirestoreSafeCells(nextLocation.row)[nextLocation.quarterKey][nextLocation.itemIndex] = item;

  return {
    week: nextWeek,
    item: cloneJson(item),
    updateRecord: {
      weekId: String(input.weekId || week.weekId || ''),
      itemId: item.id,
      sectionId: nextLocation.sectionId,
      quarterKey: nextLocation.quarterKey,
      versionBefore: currentVersion,
      versionAfter: item.version,
      ragBefore: currentRag,
      ragAfter: rag,
      statusText,
      actorEmail,
      actorRole: role,
      createdAt: now,
    },
  };
}

function createChangeRequest(week, input = {}) {
  const role = normalizeRole(input.role);
  if (!role) fail('Role is not authorized to request Executive changes.', 'permission-denied');
  const reason = String(input.reason || '').trim();
  if (!reason) fail('A request reason is required.', 'invalid-argument');
  const proposal = proposalFor(week, input, role);
  const now = String(input.now || new Date().toISOString());
  return {
    requestId: String(input.requestId || ''),
    weekId: String(input.weekId || week.weekId || ''),
    ...proposal,
    sourceSectionId: proposal.before?.sectionId || '',
    targetSectionId: proposal.after?.sectionId || proposal.before?.sectionId || '',
    reason,
    requesterEmail: String(input.requesterEmail || '').trim().toLowerCase(),
    requesterRole: role,
    state: 'pending',
    createdAt: now,
    updatedAt: now,
    decisionNote: '',
    decidedAt: '',
    decidedBy: '',
  };
}

function applyApprovedRequest(week, request = {}, decision = {}) {
  const role = normalizeRole(decision.role);
  if (role !== 'executive') fail('Role is not authorized to approve Executive requests.', 'permission-denied');
  if (request.state === 'applied') {
    return { week: cloneJson(week), request: cloneJson(request), audit: null, alreadyApplied: true };
  }
  if (request.state !== 'pending') fail('Request is not pending.', 'failed-precondition');

  const nextRequest = cloneJson(request);
  const now = String(decision.now || new Date().toISOString());
  try {
    const applied = applyProposal(week, request);
    nextRequest.state = 'applied';
    nextRequest.updatedAt = now;
    nextRequest.decidedAt = now;
    nextRequest.decidedBy = String(decision.actorEmail || '').trim().toLowerCase();
    nextRequest.decisionNote = String(decision.decisionNote || '').trim();
    nextRequest.appliedVersion = applied.item?.version ?? null;
    return {
      week: applied.week,
      request: nextRequest,
      alreadyApplied: false,
      audit: {
        action: 'approved-change',
        requestId: String(request.requestId || ''),
        weekId: String(request.weekId || week.weekId || ''),
        itemId: request.itemId,
        changeType: request.changeType,
        before: applied.before,
        after: applied.after,
        reason: request.reason,
        decisionNote: nextRequest.decisionNote,
        actorEmail: nextRequest.decidedBy,
        actorRole: role,
        createdAt: now,
      },
    };
  } catch (error) {
    if (error.code !== 'aborted' && error.code !== 'already-exists') throw error;
    nextRequest.state = 'conflict';
    nextRequest.updatedAt = now;
    nextRequest.decidedAt = now;
    nextRequest.decidedBy = String(decision.actorEmail || '').trim().toLowerCase();
    nextRequest.decisionNote = String(decision.decisionNote || '').trim();
    nextRequest.conflictReason = error.message;
    return { week: cloneJson(week), request: nextRequest, audit: null, alreadyApplied: false };
  }
}

function applyDirectStructureChange(week, input = {}) {
  const role = normalizeRole(input.role);
  if (!['admin', 'executive'].includes(role)) {
    fail('Role is not authorized to change Executive structure directly.', 'permission-denied');
  }
  const reason = String(input.reason || '').trim();
  if (!reason) fail('A direct-change reason is required.', 'invalid-argument');
  const proposal = proposalFor(week, { ...input, reason }, role);
  const applied = applyProposal(week, proposal);
  const now = String(input.now || new Date().toISOString());
  return {
    week: applied.week,
    item: applied.item,
    audit: {
      action: 'direct-change',
      requestId: '',
      weekId: String(input.weekId || week.weekId || ''),
      itemId: proposal.itemId,
      changeType: proposal.changeType,
      before: applied.before,
      after: applied.after,
      reason,
      actorEmail: String(input.actorEmail || '').trim().toLowerCase(),
      actorRole: role,
      createdAt: now,
    },
  };
}

module.exports = {
  SECTION_IDS,
  QUARTER_KEYS,
  normalizeRole,
  createExecutiveLegacyItemId,
  authorizeUpdate,
  findItemLocation,
  applyItemUpdate,
  createChangeRequest,
  applyApprovedRequest,
  applyDirectStructureChange,
};
