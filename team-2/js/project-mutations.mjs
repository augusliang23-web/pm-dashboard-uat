export class ProjectMutationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProjectMutationError';
    this.code = code;
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function arrayEntryIdentity(value) {
  if (!isPlainObject(value)) return '';
  for (const key of ['id', 'planId', 'code', 'name']) {
    const candidate = String(value[key] ?? '').trim();
    if (candidate) return `${key}:${candidate}`;
  }
  return '';
}

export function mergePreservingUnknown(liveValue, draftValue) {
  if (Array.isArray(draftValue)) {
    if (!Array.isArray(liveValue)) {
      return draftValue.map(item => mergePreservingUnknown(undefined, item));
    }
    const usedLiveIndexes = new Set();
    return draftValue.map((draftItem, draftIndex) => {
      const identity = arrayEntryIdentity(draftItem);
      let liveIndex = -1;
      if (identity) {
        liveIndex = liveValue.findIndex((liveItem, index) => (
          !usedLiveIndexes.has(index) && arrayEntryIdentity(liveItem) === identity
        ));
      } else if (draftIndex < liveValue.length && !usedLiveIndexes.has(draftIndex)) {
        liveIndex = draftIndex;
      }
      if (liveIndex >= 0) usedLiveIndexes.add(liveIndex);
      return mergePreservingUnknown(
        liveIndex >= 0 ? liveValue[liveIndex] : undefined,
        draftItem,
      );
    });
  }
  if (isPlainObject(draftValue)) {
    const liveObject = isPlainObject(liveValue) ? liveValue : {};
    const merged = { ...liveObject };
    for (const [key, value] of Object.entries(draftValue)) {
      merged[key] = mergePreservingUnknown(liveObject[key], value);
    }
    return merged;
  }
  return draftValue;
}

function canonicalValue(value) {
  if (value === undefined) return { $type: 'undefined' };
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : { $type: 'number', value: String(value) };
  }
  if (typeof value === 'bigint') return { $type: 'bigint', value: value.toString() };
  if (value instanceof Date) return { $type: 'date', value: value.toISOString() };
  if (value && typeof value.toMillis === 'function') {
    return { $type: 'timestamp', value: value.toMillis() };
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]),
    );
  }
  return { $type: typeof value, value: String(value) };
}

export function projectRevisionFingerprint(project) {
  return JSON.stringify(canonicalValue(project));
}

function assertRevisionUnchanged(project, options) {
  if (options.expectedFingerprint === undefined) return;
  const fingerprintProject = typeof options.fingerprintProject === 'function'
    ? options.fingerprintProject
    : projectRevisionFingerprint;
  if (fingerprintProject(project) !== options.expectedFingerprint) {
    throw new ProjectMutationError(
      'revision-conflict',
      'This project changed since the editor was opened. Close and reopen the editor before trying again.',
    );
  }
}

function liveProjects(week) {
  if (!week || typeof week !== 'object' || !Array.isArray(week.projects)) {
    throw new ProjectMutationError(
      'invalid-week',
      'The selected week has invalid project data. Refresh the dashboard and try again.',
    );
  }
  return week.projects;
}

function trimmedIdentity(draft) {
  const name = String(draft?.name ?? '').trim();
  const code = String(draft?.code ?? '').trim();
  if (!name) {
    throw new ProjectMutationError('blank-name', 'Project name is required.');
  }
  if (!code) {
    throw new ProjectMutationError('blank-code', 'Project code is required.');
  }
  return { name, code };
}

function assertUniqueCode(projects, code, excludedIndex = -1) {
  const normalizedCode = code.toLocaleLowerCase();
  const duplicate = projects.some((project, index) => (
    index !== excludedIndex
    && String(project?.code ?? '').trim().toLocaleLowerCase() === normalizedCode
  ));
  if (duplicate) {
    throw new ProjectMutationError(
      'duplicate-code',
      `A project with code "${code}" already exists. Choose a unique code.`,
    );
  }
}

export function applyProjectSave(week, options = {}) {
  const projects = liveProjects(week);
  const {
    draft,
    originalCode,
    isNew,
    role,
    canEdit,
    lastModifiedBy,
  } = options;

  if (isNew) {
    if (role !== 'admin') {
      throw new ProjectMutationError(
        'create-forbidden',
        'Only administrators can create projects. Refresh to update your permissions.',
      );
    }
    const identity = trimmedIdentity(draft);
    assertUniqueCode(projects, identity.code);
    const project = { ...draft, ...identity };
    return {
      project,
      week: {
        ...week,
        projects: [...projects, project],
        lastModifiedBy,
      },
    };
  }

  const targetIndex = projects.findIndex(project => project?.code === originalCode);
  if (targetIndex < 0) {
    throw new ProjectMutationError(
      'missing-target',
      'This project no longer exists in the selected week. Close and reopen the editor.',
    );
  }
  const targetProject = projects[targetIndex];
  const authorized = role === 'admin'
    || (role === 'pm' && typeof canEdit === 'function' && canEdit(targetProject));
  if (!authorized) {
    throw new ProjectMutationError(
      'edit-forbidden',
      'Your permission to edit this project changed. Refresh the dashboard and try again.',
    );
  }
  assertRevisionUnchanged(targetProject, options);
  const identity = trimmedIdentity(draft);
  assertUniqueCode(projects, identity.code, targetIndex);

  const project = {
    ...mergePreservingUnknown(targetProject, draft),
    ...identity,
  };
  const nextProjects = [...projects];
  nextProjects[targetIndex] = project;
  return {
    project,
    week: {
      ...week,
      projects: nextProjects,
      lastModifiedBy,
    },
  };
}

export function applyProjectDelete(week, options = {}) {
  const projects = liveProjects(week);
  const { originalCode, role, lastModifiedBy } = options;
  if (role !== 'admin') {
    throw new ProjectMutationError(
      'delete-forbidden',
      'Only administrators can delete projects. Refresh to update your permissions.',
    );
  }

  const targetIndex = projects.findIndex(project => project?.code === originalCode);
  if (targetIndex < 0) {
    throw new ProjectMutationError(
      'missing-target',
      'This project no longer exists in the selected week. Close and reopen the editor.',
    );
  }
  const deletedProject = projects[targetIndex];
  assertRevisionUnchanged(deletedProject, options);
  return {
    deletedProject,
    week: {
      ...week,
      projects: projects.filter((_, index) => index !== targetIndex),
      lastModifiedBy,
    },
  };
}
