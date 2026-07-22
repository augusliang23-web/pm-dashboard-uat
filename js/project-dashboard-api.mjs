export function createProjectDashboardApi({ functions, httpsCallable }) {
  const call = name => httpsCallable(functions, name);
  return {
    saveProject: data => call('saveDashboardProject')(data).then(result => result.data),
    setAttention: data => call('setDashboardProjectAttention')(data).then(result => result.data),
    setWeekRelease: data => call('setDashboardWeekRelease')(data).then(result => result.data),
  };
}
