const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { liveTimelineRef, normalizeLiveTimelineState, snapshotFromLiveTimeline } = require('./executive-live-timeline');

function database() {
  return getFirestore();
}

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function ownerOrDeputyMatches(project = {}, email) {
  const identity = new Set([normalized(email), normalized(email).split('@')[0]]);
  return [project.owner, project.deputy]
    .flatMap(value => String(value || '').split(/[,;|/\r\n]+/))
    .map(normalized)
    .some(value => value && identity.has(value));
}

function canMutateProject({ role, project, email }) {
  if (role === 'admin') return true;
  return role === 'pm' && ownerOrDeputyMatches(project, email);
}

function assertDraftWeek(week) {
  if (week.isReleased === true) throw new HttpsError('failed-precondition', 'Released reporting weeks cannot be changed.');
}

function canSetWeekRelease(role) {
  return ['admin', 'pm'].includes(role);
}

function canDeleteProject(role) {
  return role === 'admin';
}

function canCreateProject(role) {
  return role === 'admin';
}

function canManageWeekFields(role) {
  return role === 'admin';
}

async function authenticatedRole(transaction, request) {
  const email = normalized(request.auth?.token?.email);
  if (!email) throw new HttpsError('unauthenticated', 'Sign in before changing the dashboard.');
  const snapshot = await transaction.get(database().collection('users').doc(email));
  const role = normalized(snapshot.data()?.role);
  if (!role) throw new HttpsError('permission-denied', 'Dashboard role is missing.');
  return { email, role };
}

function requireWeekId(data) {
  const weekId = String(data?.weekId || '').trim();
  if (!weekId) throw new HttpsError('invalid-argument', 'A week identifier is required.');
  return weekId;
}

function nextWeekVersion(week = {}) {
  const current = Number(week.version);
  return Number.isFinite(current) && current >= 0 ? current + 1 : 1;
}

function requestedProjectCode(data, fallback = '') {
  return String(data?.projectCode || data?.project?.code || fallback).trim();
}

function updateProject(week, data, actor) {
  assertDraftWeek(week);
  const code = requestedProjectCode(data);
  const originalCode = String(data.originalCode || code).trim();
  const index = (week.projects || []).findIndex(project => project?.code === originalCode);
  if (index < 0) throw new HttpsError('not-found', 'The project no longer exists.');
  if (!canMutateProject({ role: actor.role, project: week.projects[index], email: actor.email })) {
    throw new HttpsError('permission-denied', 'You do not have permission to edit this project.');
  }
  const projects = [...week.projects];
  projects[index] = { ...projects[index], ...(data.project || {}), code: code || projects[index].code };
  if (projects.some((project, projectIndex) => projectIndex !== index && project?.code === projects[index].code)) {
    throw new HttpsError('already-exists', 'A project with this code already exists in the reporting week.');
  }
  return { projects, lastModifiedBy: actor.email, version: nextWeekVersion(week) };
}

const saveDashboardProject = onCall(async request => database().runTransaction(async transaction => {
  const actor = await authenticatedRole(transaction, request);
  const weekRef = database().collection('weeks').doc(requireWeekId(request.data));
  const weekSnapshot = await transaction.get(weekRef);
  if (!weekSnapshot.exists) throw new HttpsError('not-found', 'The reporting week no longer exists.');
  const week = weekSnapshot.data();
  let patch;
  if (request.data?.isNew === true) {
    if (!canCreateProject(actor.role)) throw new HttpsError('permission-denied', 'Only administrators can create projects.');
    assertDraftWeek(week);
    const project = { ...(request.data.project || {}), code: requestedProjectCode(request.data) };
    if (!project.code) throw new HttpsError('invalid-argument', 'A project code is required.');
    if ((week.projects || []).some(existing => existing?.code === project.code)) {
      throw new HttpsError('already-exists', 'A project with this code already exists in the reporting week.');
    }
    patch = { projects: [...(week.projects || []), project], lastModifiedBy: actor.email, version: nextWeekVersion(week) };
  } else {
    patch = updateProject(week, request.data, actor);
  }
  transaction.update(weekRef, patch);
  return { week: { ...weekSnapshot.data(), ...patch } };
}));

const deleteDashboardProject = onCall(async request => database().runTransaction(async transaction => {
  const actor = await authenticatedRole(transaction, request);
  if (!canDeleteProject(actor.role)) throw new HttpsError('permission-denied', 'Only administrators can delete projects.');
  const weekRef = database().collection('weeks').doc(requireWeekId(request.data));
  const weekSnapshot = await transaction.get(weekRef);
  if (!weekSnapshot.exists) throw new HttpsError('not-found', 'The reporting week no longer exists.');
  const week = weekSnapshot.data();
  assertDraftWeek(week);
  const code = String(request.data?.originalCode || request.data?.projectCode || '').trim();
  const projects = week.projects || [];
  if (!code || !projects.some(project => project?.code === code)) throw new HttpsError('not-found', 'The project no longer exists.');
  const patch = { projects: projects.filter(project => project?.code !== code), lastModifiedBy: actor.email, version: nextWeekVersion(week) };
  transaction.update(weekRef, patch);
  return { week: { ...week, ...patch } };
}));

const setDashboardProjectAttention = onCall(async request => database().runTransaction(async transaction => {
  const actor = await authenticatedRole(transaction, request);
  const weekRef = database().collection('weeks').doc(requireWeekId(request.data));
  const weekSnapshot = await transaction.get(weekRef);
  if (!weekSnapshot.exists) throw new HttpsError('not-found', 'The reporting week no longer exists.');
  const patch = updateProject(weekSnapshot.data(), { ...request.data, project: { attention: request.data.attention, attentionManual: true } }, actor);
  transaction.update(weekRef, patch);
  return { week: { ...weekSnapshot.data(), ...patch } };
}));

const setDashboardWeekRelease = onCall(async request => database().runTransaction(async transaction => {
  const actor = await authenticatedRole(transaction, request);
  if (!canSetWeekRelease(actor.role)) throw new HttpsError('permission-denied', 'Only PMs and administrators can change release status.');
  const weekRef = database().collection('weeks').doc(requireWeekId(request.data));
  const weekSnapshot = await transaction.get(weekRef);
  if (!weekSnapshot.exists) throw new HttpsError('not-found', 'The reporting week no longer exists.');
  const isReleasing = request.data.isReleased === true;
  const patch = { isReleased: isReleasing, lastModifiedBy: actor.email, version: nextWeekVersion(weekSnapshot.data()) };
  if (isReleasing) {
    const liveRef = liveTimelineRef(database());
    const liveSnapshot = await transaction.get(liveRef);
    const state = normalizeLiveTimelineState(liveSnapshot.exists ? liveSnapshot.data() : null);
    if (!state.timeline) {
      throw new HttpsError('failed-precondition', 'Executive milestones have not been initialized. Initialize the live roadmap before releasing this week.');
    }
    patch['strategyLayer.executiveMilestoneTimelineSnapshot'] = snapshotFromLiveTimeline(state, actor.email, new Date().toISOString());
  }
  transaction.update(weekRef, patch);
  return { week: { ...weekSnapshot.data(), ...patch } };
}));

const saveDashboardWeekFields = onCall(async request => database().runTransaction(async transaction => {
  const actor = await authenticatedRole(transaction, request);
  if (!canManageWeekFields(actor.role)) throw new HttpsError('permission-denied', 'Only administrators can update week management fields.');
  const weekRef = database().collection('weeks').doc(requireWeekId(request.data));
  const weekSnapshot = await transaction.get(weekRef);
  if (!weekSnapshot.exists) throw new HttpsError('not-found', 'The reporting week no longer exists.');
  const week = weekSnapshot.data();
  assertDraftWeek(week);
  const fields = request.data?.fields && typeof request.data.fields === 'object' ? request.data.fields : {};
  const patch = {};
  for (const key of ['summary', 'strategyLayer']) if (Object.prototype.hasOwnProperty.call(fields, key)) patch[key] = fields[key];
  patch.lastModifiedBy = actor.email;
  patch.version = nextWeekVersion(week);
  transaction.update(weekRef, patch);
  return { week: { ...week, ...patch } };
}));

const createDashboardWeek = onCall(async request => database().runTransaction(async transaction => {
  const actor = await authenticatedRole(transaction, request);
  if (!canManageWeekFields(actor.role)) throw new HttpsError('permission-denied', 'Only administrators can create reporting weeks.');
  const weekId = requireWeekId(request.data);
  const weekRef = database().collection('weeks').doc(weekId);
  const existing = await transaction.get(weekRef);
  if (existing.exists) throw new HttpsError('already-exists', 'This reporting week already exists.');
  const week = { ...(request.data?.week || {}), isReleased: false, lastModifiedBy: actor.email, version: 0 };
  if (!String(week.weekLabel || '').trim()) throw new HttpsError('invalid-argument', 'A week label is required.');
  transaction.create(weekRef, week);
  return { week: { ...week, __documentId: weekId } };
}));

module.exports = {
  assertDraftWeek,
  canMutateProject,
  canSetWeekRelease,
  canDeleteProject,
  canCreateProject,
  canManageWeekFields,
  saveDashboardProject,
  deleteDashboardProject,
  setDashboardProjectAttention,
  setDashboardWeekRelease,
  saveDashboardWeekFields,
  createDashboardWeek,
};
