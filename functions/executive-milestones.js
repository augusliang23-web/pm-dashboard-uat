'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const {
  applyApprovedRequest,
  applyDirectStructureChange,
  applyItemUpdate,
  createChangeRequest,
  normalizeRole,
} = require('./executive-milestone-core');
const { defaultTimelineConfig, normalizeTimelineConfig } = require('./executive-timeline-config');

const db = getFirestore();
const CALLABLE_OPTIONS = { region: 'us-central1', cors: true };
const RAGS = new Set(['green', 'yellow', 'red']);

function requireEmail(request) {
  if (!request.auth || !request.auth.token?.email) {
    throw new HttpsError('unauthenticated', 'A signed-in email account is required.');
  }
  const email = String(request.auth.token.email).trim().toLowerCase();
  return email;
}

async function getActor(transaction, request) {
  const email = requireEmail(request);
  const userRef = db.collection('users').doc(email);
  const userSnapshot = await transaction.get(userRef);
  if (!userSnapshot.exists || userSnapshot.data().active === false) {
    throw new HttpsError('permission-denied', 'The dashboard account is not active.');
  }
  const role = normalizeRole(userSnapshot.data().role);
  if (!role) throw new HttpsError('permission-denied', 'The dashboard role is not authorized.');
  return { email, role, uid: request.auth.uid, userRef };
}

function requireWeekId(data) {
  const weekId = String(data?.weekId || '').trim();
  if (!weekId || weekId.includes('/')) throw new HttpsError('invalid-argument', 'A valid weekId is required.');
  return weekId;
}

async function readWeek(transaction, weekRef) {
  const snapshot = await transaction.get(weekRef);
  if (!snapshot.exists) throw new HttpsError('not-found', 'Reporting week was not found.');
  if (snapshot.data().isReleased === true) {
    throw new HttpsError('failed-precondition', 'Released reporting weeks cannot be changed.');
  }
  return { ...snapshot.data(), weekId: snapshot.id };
}

function executiveTimelineConfigRef() {
  return db.collection('executiveMilestoneConfig').doc('timeline');
}

async function readExecutiveTimelineConfig(transaction) {
  const snapshot = await transaction.get(executiveTimelineConfigRef());
  return normalizeTimelineConfig(snapshot.exists ? snapshot.data() : defaultTimelineConfig());
}

function configuredLabel(config, collection, id) {
  const key = collection === 'sections' ? 'sectionId' : 'quarterId';
  return config[collection].find(item => item[key] === String(id || ''))?.label || String(id || '');
}

function withConfigMetadata(record, config) {
  return {
    ...record,
    configVersion: config.version,
    sourceSectionLabel: configuredLabel(config, 'sections', record.sourceSectionId || record.sectionId || record.before?.sectionId),
    sourceQuarterLabel: configuredLabel(config, 'quarters', record.before?.quarterKey || record.quarterKey),
    targetSectionLabel: configuredLabel(config, 'sections', record.targetSectionId || record.after?.sectionId || record.sectionId),
    targetQuarterLabel: configuredLabel(config, 'quarters', record.after?.quarterKey || record.quarterKey),
  };
}

function updateTimeline(transaction, weekRef, week, actorEmail) {
  transaction.update(weekRef, {
    'strategyLayer.executiveMilestoneTimeline': week.strategyLayer.executiveMilestoneTimeline,
    lastModifiedBy: actorEmail,
  });
}

function asHttpsError(error) {
  if (error instanceof HttpsError) return error;
  const codes = new Set([
    'invalid-argument', 'not-found', 'already-exists', 'permission-denied',
    'failed-precondition', 'aborted', 'unauthenticated',
  ]);
  return new HttpsError(codes.has(error?.code) ? error.code : 'internal', error?.message || 'Executive milestone operation failed.');
}

function worstRag(items) {
  const severity = { green: 0, yellow: 1, red: 2 };
  const rags = items
    .map(item => String(item?.rag || '').toLowerCase())
    .filter(rag => Object.hasOwn(severity, rag));
  if (!rags.length) return null;
  return rags.reduce((worst, rag) => severity[rag] > severity[worst] ? rag : worst, rags[0]);
}

function calculateOverrideTarget(timeline, scope, targetId) {
  const rows = Array.isArray(timeline?.rows) ? timeline.rows : [];
  if (scope === 'section') {
    const row = rows.find(candidate => candidate?.sectionId === targetId);
    if (!row) throw new HttpsError('not-found', 'Executive section was not found.');
    const cells = Array.isArray(row.cells)
      ? row.cells
      : ['q1', 'q2', 'q3', 'q4'].map(key => row.cells?.[key] || []);
    return worstRag(cells.flat());
  }
  if (scope === 'quarter' && ['q1', 'q2', 'q3', 'q4'].includes(targetId)) {
    return worstRag(rows.flatMap(row => Array.isArray(row.cells) ? row.cells[Number(targetId.slice(1)) - 1] || [] : row.cells?.[targetId] || []));
  }
  throw new HttpsError('invalid-argument', 'A valid RAG override target is required.');
}

const addExecutiveMilestoneUpdate = onCall(CALLABLE_OPTIONS, async request => {
  try {
    const weekId = requireWeekId(request.data);
    const weekRef = db.collection('weeks').doc(weekId);
    const updateRef = db.collection('executiveMilestoneUpdates').doc();
    const result = await db.runTransaction(async transaction => {
      const actor = await getActor(transaction, request);
      const config = await readExecutiveTimelineConfig(transaction);
      const week = await readWeek(transaction, weekRef);
      const applied = applyItemUpdate(week, {
        ...request.data,
        weekId,
        role: actor.role,
        actorEmail: actor.email,
        config,
        now: new Date().toISOString(),
      });
      updateTimeline(transaction, weekRef, applied.week, actor.email);
      transaction.create(updateRef, { ...withConfigMetadata(applied.updateRecord, config), updateId: updateRef.id });
      return applied;
    });
    return { ok: true, weekId, itemId: result.item.id, version: result.item.version };
  } catch (error) {
    throw asHttpsError(error);
  }
});

const createExecutiveMilestoneChangeRequest = onCall(CALLABLE_OPTIONS, async request => {
  try {
    const weekId = requireWeekId(request.data);
    const weekRef = db.collection('weeks').doc(weekId);
    const requestRef = db.collection('executiveMilestoneChangeRequests').doc();
    const changeRequest = await db.runTransaction(async transaction => {
      const actor = await getActor(transaction, request);
      const config = await readExecutiveTimelineConfig(transaction);
      const week = await readWeek(transaction, weekRef);
      const created = createChangeRequest(week, {
        ...request.data,
        requestId: requestRef.id,
        weekId,
        role: actor.role,
        requesterEmail: actor.email,
        config,
        now: new Date().toISOString(),
      });
      transaction.create(requestRef, withConfigMetadata(created, config));
      return created;
    });
    return { ok: true, weekId, itemId: changeRequest.itemId, requestId: requestRef.id };
  } catch (error) {
    throw asHttpsError(error);
  }
});

const decideExecutiveMilestoneChangeRequest = onCall(CALLABLE_OPTIONS, async request => {
  try {
    const requestId = String(request.data?.requestId || '').trim();
    const decision = String(request.data?.decision || '').trim().toLowerCase();
    if (!requestId || requestId.includes('/')) throw new HttpsError('invalid-argument', 'A valid requestId is required.');
    if (!['approve', 'reject'].includes(decision)) throw new HttpsError('invalid-argument', 'Decision must be approve or reject.');

    const requestRef = db.collection('executiveMilestoneChangeRequests').doc(requestId);
    const auditRef = db.collection('executiveMilestoneAudit').doc();
    const result = await db.runTransaction(async transaction => {
      const actor = await getActor(transaction, request);
      if (actor.role !== 'executive') throw new HttpsError('permission-denied', 'Only the Executive Owner may decide requests.');
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists) throw new HttpsError('not-found', 'Change request was not found.');
      const changeRequest = requestSnapshot.data();
      const config = await readExecutiveTimelineConfig(transaction);
      const now = new Date().toISOString();

      if (decision === 'reject') {
        if (changeRequest.state !== 'pending') throw new HttpsError('failed-precondition', 'Request is not pending.');
        const rejected = {
          ...changeRequest,
          state: 'rejected',
          updatedAt: now,
          decidedAt: now,
          decidedBy: actor.email,
          decisionNote: String(request.data?.decisionNote || '').trim(),
        };
        transaction.update(requestRef, rejected);
        return { request: rejected, alreadyApplied: false };
      }

      const weekId = requireWeekId({ weekId: changeRequest.weekId });
      const weekRef = db.collection('weeks').doc(weekId);
      const week = await readWeek(transaction, weekRef);
      const applied = applyApprovedRequest(week, changeRequest, {
        role: actor.role,
        actorEmail: actor.email,
        decisionNote: request.data?.decisionNote,
        config,
        now,
      });
      if (applied.request.state === 'applied' && !applied.alreadyApplied) updateTimeline(transaction, weekRef, applied.week, actor.email);
      if (!applied.alreadyApplied) transaction.update(requestRef, applied.request);
      if (applied.audit) transaction.create(auditRef, { ...withConfigMetadata(applied.audit, config), auditId: auditRef.id });
      return applied;
    });
    return {
      ok: true,
      weekId: result.request.weekId,
      itemId: result.request.itemId,
      requestId,
      state: result.request.state,
      alreadyApplied: result.alreadyApplied === true,
    };
  } catch (error) {
    throw asHttpsError(error);
  }
});

const applyDirectExecutiveMilestoneChange = onCall(CALLABLE_OPTIONS, async request => {
  try {
    const weekId = requireWeekId(request.data);
    const weekRef = db.collection('weeks').doc(weekId);
    const auditRef = db.collection('executiveMilestoneAudit').doc();
    const result = await db.runTransaction(async transaction => {
      const actor = await getActor(transaction, request);
      const config = await readExecutiveTimelineConfig(transaction);
      const week = await readWeek(transaction, weekRef);
      const applied = applyDirectStructureChange(week, {
        ...request.data,
        weekId,
        role: actor.role,
        actorEmail: actor.email,
        config,
        now: new Date().toISOString(),
      });
      updateTimeline(transaction, weekRef, applied.week, actor.email);
      transaction.create(auditRef, { ...withConfigMetadata(applied.audit, config), auditId: auditRef.id });
      return applied;
    });
    return { ok: true, weekId, itemId: result.audit.itemId, version: result.item?.version ?? null };
  } catch (error) {
    throw asHttpsError(error);
  }
});

const setExecutiveRagOverride = onCall(CALLABLE_OPTIONS, async request => {
  try {
    const weekId = requireWeekId(request.data);
    const scope = String(request.data?.scope || '').trim().toLowerCase();
    const targetId = String(request.data?.targetId || '').trim();
    const replacementValue = request.data?.rag == null ? null : String(request.data.rag).trim().toLowerCase();
    const reason = String(request.data?.reason || '').trim();
    if (!['section', 'quarter'].includes(scope)) throw new HttpsError('invalid-argument', 'Override scope must be section or quarter.');
    if (replacementValue !== null && !RAGS.has(replacementValue)) throw new HttpsError('invalid-argument', 'Override RAG must be green, yellow, red, or null.');
    if (!reason) throw new HttpsError('invalid-argument', 'An override reason is required.');

    const weekRef = db.collection('weeks').doc(weekId);
    const auditRef = db.collection('executiveMilestoneAudit').doc();
    const result = await db.runTransaction(async transaction => {
      const actor = await getActor(transaction, request);
      if (!['admin', 'executive'].includes(actor.role)) throw new HttpsError('permission-denied', 'Role is not authorized to override Executive RAG.');
      const week = await readWeek(transaction, weekRef);
      const timeline = JSON.parse(JSON.stringify(week.strategyLayer?.executiveMilestoneTimeline || {}));
      const calculatedValue = calculateOverrideTarget(timeline, scope, targetId);
      const key = [scope, targetId].join(':');
      timeline.ragOverrides = timeline.ragOverrides && typeof timeline.ragOverrides === 'object' ? timeline.ragOverrides : {};
      const previousOverride = timeline.ragOverrides[key] || null;
      if (replacementValue === null) delete timeline.ragOverrides[key];
      else timeline.ragOverrides[key] = {
        scope,
        targetId,
        calculatedValue,
        replacementValue,
        reason,
        actorEmail: actor.email,
        actorRole: actor.role,
        updatedAt: new Date().toISOString(),
      };
      transaction.update(weekRef, {
        'strategyLayer.executiveMilestoneTimeline': timeline,
        lastModifiedBy: actor.email,
      });
      const audit = {
        auditId: auditRef.id,
        action: replacementValue === null ? 'remove-rag-override' : 'set-rag-override',
        weekId,
        scope,
        targetId,
        calculatedValue,
        previousOverride,
        replacementValue,
        reason,
        actorEmail: actor.email,
        actorRole: actor.role,
        createdAt: new Date().toISOString(),
      };
      transaction.create(auditRef, audit);
      return audit;
    });
    return { ok: true, weekId, scope, targetId, rag: result.replacementValue };
  } catch (error) {
    throw asHttpsError(error);
  }
});

module.exports = {
  addExecutiveMilestoneUpdate,
  createExecutiveMilestoneChangeRequest,
  decideExecutiveMilestoneChangeRequest,
  applyDirectExecutiveMilestoneChange,
  setExecutiveRagOverride,
};
