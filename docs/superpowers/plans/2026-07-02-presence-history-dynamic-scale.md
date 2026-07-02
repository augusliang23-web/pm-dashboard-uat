# Presence History Reliability and Dynamic Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve a reliable last-seen fallback for every authenticated user, authorize exact session history safely, and dynamically scale low-volume write charts.

**Architecture:** Add pure presence-view helpers in a focused module and consume them from the existing dashboard renderer. Extend presence writes with durable `lastSeenAt` and session ownership, then add complete Firestore Rules based on the user-supplied production rules.

**Tech Stack:** Vanilla JavaScript, Firebase Auth/Firestore, Firestore Rules v2, Node.js built-in test runner.

---

### Task 1: Pure scale and lane helpers

**Files:**
- Create: `team-2/js/presence-usage.mjs`
- Create: `tests/presence-usage.test.mjs`

- [ ] **Step 1: Write failing helper tests**

Test low and high chart modes:

```js
assert.deepEqual(selectPresenceWriteScale([{ writes: 12 }]), {
  maxWrites: 2000,
  gridValues: [0, 500, 1000, 1500, 2000],
  referenceLines: [
    { value: 2000, label: '20% · 2k', kind: 'attention' }
  ]
});
assert.equal(selectPresenceWriteScale([{ writes: 2000 }]).maxWrites, 10000);
assert.deepEqual(
  selectPresenceWriteScale([{ writes: 2000 }]).referenceLines.map(line => line.value),
  [2000, 8000]
);
```

Test last-seen normalization and precise-source de-duplication:

```js
const lastSeen = buildLastSeenPresenceActivities([
  { id: 'nick@example.com', data: { name: 'Nick', role: 'pm', lastSeenAt: 200 } }
], 100, 300);
assert.equal(lastSeen[0].lastSeenAt, 200);
assert.equal(
  buildPresenceTimelineLanes([], [], lastSeen)[0].entries[0].kind,
  'last-seen'
);
assert.equal(
  buildPresenceTimelineLanes([{ userKey: 'nick@example.com' }], [], lastSeen)[0].entries.length,
  1
);
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --test tests/presence-usage.test.mjs
```

Expected: failure because `team-2/js/presence-usage.mjs` does not exist.

- [ ] **Step 3: Implement the pure helpers**

Export:

```js
export function selectPresenceWriteScale(rows, quota = 10000) {
  const threshold20 = quota * 0.2;
  const peak = Math.max(0, ...rows.map(row => Number(row.writes || 0)));
  const highMode = peak >= threshold20;
  return {
    maxWrites: highMode ? quota : threshold20,
    gridValues: highMode
      ? [0, 2500, 5000, 7500, 10000]
      : [0, 500, 1000, 1500, 2000],
    referenceLines: highMode
      ? [
          { value: threshold20, label: '20% · 2k', kind: 'attention' },
          { value: quota * 0.8, label: '80% · 8k', kind: 'warning' }
        ]
      : [{ value: threshold20, label: '20% · 2k', kind: 'attention' }]
  };
}
```

Also implement `buildLastSeenPresenceActivities()` and
`buildPresenceTimelineLanes()` using normalized case-insensitive user keys.
Last-seen entries are included only when no session or activity estimate exists
for the same user in the selected range.

- [ ] **Step 4: Run focused tests and commit**

Run:

```powershell
node --test tests/presence-usage.test.mjs
```

Expected: all tests pass.

Commit:

```powershell
git add team-2/js/presence-usage.mjs tests/presence-usage.test.mjs
git commit -m "feat: model presence fallback and dynamic scale"
```

### Task 2: Dashboard presence rendering and durable last-seen

**Files:**
- Modify: `team-2/index.html`
- Modify: `tests/presence-usage.test.mjs`
- Test: `team-2/presence-estimate.test.cjs`

- [ ] **Step 1: Write failing integration tests**

Assert that the dashboard:

```js
assert.match(dashboard, /ownerUid:\s*currentUser\.uid/);
assert.match(dashboard, /lastSeenAt:\s*Date\.now\(\)/);
assert.match(dashboard, /buildLastSeenPresenceActivities/);
assert.match(dashboard, /buildPresenceTimelineLanes/);
assert.match(dashboard, /Activity detected \(time unknown\)/);
assert.match(dashboard, /class="presence-last-seen-marker"/);
```

Assert the chart renders reference lines from `selectPresenceWriteScale()` and
does not contain a permanently hard-coded 80% SVG line.

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test tests/presence-usage.test.mjs team-2/presence-estimate.test.cjs
```

Expected: integration assertions fail because the dashboard is not wired to the
new helpers.

- [ ] **Step 3: Persist ownership and last-seen**

Add `ownerUid: currentUser.uid` to new session documents.

For every active, idle, heartbeat, and logout presence write, include:

```js
lastSeenAt: Date.now()
```

Logout continues to set `lastActive: 0` but never clears `lastSeenAt`.

- [ ] **Step 4: Render the dynamic write scale**

Import `selectPresenceWriteScale`, calculate scale from visible points, use its
`maxWrites` and `gridValues`, and render each reference line from
`referenceLines`. Low mode shows only 20%; high mode shows 20% and 80%.

- [ ] **Step 5: Render merged timeline lanes**

Build last-seen records from the already loaded `presence` documents, pass them
to `renderPresenceUsageStats`, and let `buildPresenceTimelineLanes` provide the
lane list.

Render a last-seen entry as a point marker:

```html
<circle class="presence-last-seen-marker" ...>
  <title>Nick · Last seen ... · No session duration recorded</title>
</circle>
```

Rename gold legend and tooltip copy to
`Activity detected (time unknown)`.

- [ ] **Step 6: Run focused tests and commit**

Run:

```powershell
node --test tests/presence-usage.test.mjs team-2/presence-estimate.test.cjs tests/v2-baseline.test.mjs
```

Expected: all focused tests pass.

Commit:

```powershell
git add team-2/index.html tests/presence-usage.test.mjs
git commit -m "feat: show reliable presence fallback history"
```

### Task 3: Firestore Rules source

**Files:**
- Create: `firestore.rules`
- Modify: `firebase.json`
- Create: `tests/firestore-rules-source.test.mjs`

- [ ] **Step 1: Write failing Rules source tests**

Assert:

```js
assert.match(rules, /match \/presenceSessions\/\{sessionId\}/);
assert.match(rules, /request\.resource\.data\.ownerUid == request\.auth\.uid/);
assert.match(rules, /allow read: if isAdmin\(\)/);
assert.match(rules, /match \/presenceDailyRollups\/\{rollupId\}/);
assert.match(rules, /allow write: if false/);
assert.equal(firebase.firestore.rules, 'firestore.rules');
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test tests/firestore-rules-source.test.mjs
```

Expected: failure because `firestore.rules` and the Firebase Rules mapping are
absent.

- [ ] **Step 3: Add the complete Rules file**

Preserve the supplied `users`, `weeks`, `logs`, and `presence` rules. Add
`isSignedIn()` and `isAdmin()` helpers, UID-owned session create/update rules,
Admin-only session reads, and Admin-read/backend-only-write rollup rules.

Session updates may change only:

```text
lastSeenAt, endedAt, activeMs, idleMs, state, endReason, updatedAt
```

- [ ] **Step 4: Map Rules in Firebase config**

Update `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": {
    "source": "functions"
  }
}
```

- [ ] **Step 5: Run focused tests and commit**

Run:

```powershell
node --test tests/firestore-rules-source.test.mjs
```

Expected: all tests pass.

Commit:

```powershell
git add firestore.rules firebase.json tests/firestore-rules-source.test.mjs
git commit -m "feat: authorize owned presence sessions"
```

### Task 4: Full verification

**Files:**
- Modify only if a verified defect is found.

- [ ] **Step 1: Run complete tests**

Run:

```powershell
node --test
git diff --check
```

Expected: zero failures and no whitespace errors.

- [ ] **Step 2: Verify locally in the browser**

Confirm:

- Low-volume data uses a 2,000-write axis with only a 20% line.
- Synthetic 2,000-write data switches to the full axis with 20% and 80% lines.
- A last-seen-only user gets a marker and lane.
- Session and activity lanes suppress duplicate last-seen markers.
- Gold copy does not imply twelve hours online.
- No console errors appear.

- [ ] **Step 3: Prepare deployment handoff**

Report the exact `firestore.rules` path and state explicitly that GitHub Pages
deployment does not publish Firestore Rules. The user must publish the complete
Rules in Firebase Console before exact session history becomes readable.
