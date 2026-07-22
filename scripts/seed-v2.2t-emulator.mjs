import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const projectId = 'demo-pm-dashboard-v22t';
const password = 'TestOnly!12345';
const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);

async function seedAuth(email) {
  try {
    await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    await auth.createUser({ email, password, emailVerified: true });
  }
}

async function seedDocument(collection, id, data) {
  await db.collection(collection).doc(id).set(data, { merge: true });
}

const accounts = [
  { email: 'test.admin@pm-dashboard.local', role: 'admin', isProjectManager: true },
  { email: 'test.pm@pm-dashboard.local', role: 'pm', isProjectManager: true },
  { email: 'test.bd@pm-dashboard.local', role: 'bd', isProjectManager: false },
];

for (const account of accounts) {
  await seedAuth(account.email);
  await seedDocument('users', account.email, {
    role: account.role,
    isProjectManager: account.isProjectManager,
    label: 'TEST / DO NOT DELETE',
  });
}

const testProject = {
  name: 'TEST / DO NOT DELETE · Draft project',
  code: 'TEST-DRAFT-001',
  owner: 'Test',
  deputy: '',
  level: 'system',
  status: 'green',
  progress: 25,
  milestones: [],
  visibility: 'active',
};

await seedDocument('weeks', 'W30-2026', {
  weekLabel: 'W30 2026',
  weekDate: 'Jul 20 - Jul 24',
  isReleased: false,
  lastModifiedBy: 'test.admin@pm-dashboard.local',
  projects: [testProject],
  summary: {},
  label: 'TEST / DO NOT DELETE',
});

await seedDocument('weeks', 'W29-2026', {
  weekLabel: 'W29 2026',
  weekDate: 'Jul 13 - Jul 17',
  isReleased: true,
  lastModifiedBy: 'test.admin@pm-dashboard.local',
  projects: [{ ...testProject, code: 'TEST-RELEASED-001', name: 'TEST / DO NOT DELETE · Released project' }],
  summary: {},
  label: 'TEST / DO NOT DELETE',
});

console.log(`Seeded ${accounts.length} local-only accounts. Password: ${password}`);
