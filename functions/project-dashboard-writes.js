const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

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

function updateProject(week, data, actor) {
  assertDraftWeek(week);
  const code = String(data.projectCode || data.project?.code || '').trim();
  const index = (week.projects || []).findIndex(project => project?.code === (data.originalCode || code));
  if (index < 0) throw new HttpsError('not-found', 'The project no longer exists.');
  if (!canMutateProject({ role: actor.role, project: week.projects[index], email: actor.email })) {
    throw new HttpsError('permission-denied', 'You do not have permission to edit this project.');
  }
  const projects = [...week.projects];
  projects[index] = { ...projects[index], ...(data.project || {}), code: code || projects[index].code };
  return { projects, lastModifiedBy: actor.email };
}

const saveDashboardProject = onCall(async request => database().runTransaction(async transaction => {
  const actor = await authenticatedRole(transaction, request);
  const weekRef = database().collection('weeks').doc(requireWeekId(request.data));
  const weekSnapshot = await transaction.get(weekRef);
  if (!weekSnapshot.exists) throw new HttpsError('not-found', 'The reporting week no longer exists.');
  const patch = updateProject(weekSnapshot.data(), request.data, actor);
  transaction.update(weekRef, patch);
  return { week: { ...weekSnapshot.data(), ...patch } };
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
  const patch = { isReleased: request.data.isReleased === true, lastModifiedBy: actor.email };
  transaction.update(weekRef, patch);
  return { week: { ...weekSnapshot.data(), ...patch } };
}));

module.exports = { assertDraftWeek, canMutateProject, canSetWeekRelease, saveDashboardProject, setDashboardProjectAttention, setDashboardWeekRelease };
