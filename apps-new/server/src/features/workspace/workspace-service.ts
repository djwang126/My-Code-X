import type {
  AppDataStorePort,
  ClockPort,
  IdPort,
  PathComparisonPort,
  PathInspectionPort,
} from '../../ports/index.js';
import { AppDataStoreError } from '../../ports/index.js';

export interface OpenWorkspaceListCommand {
  readonly selectedWorkspaceId: string | null;
}

export interface AddWorkspaceCommand {
  readonly cwd: string;
  readonly name: string;
  readonly selectedWorkspaceId: string | null;
}

export interface RenameWorkspaceCommand {
  readonly recordRef: string | null;
  readonly currentWorkspaceId: string;
  readonly name: string;
  readonly selectedWorkspaceId: string | null;
}

export interface EditWorkspaceCwdCommand {
  readonly recordRef: string | null;
  readonly currentWorkspaceId: string;
  readonly cwd: string;
  readonly selectedWorkspaceId: string | null;
}

export interface RemoveWorkspaceCommand {
  readonly recordRef: string | null;
  readonly currentWorkspaceId: string;
  readonly selectedWorkspaceId: string | null;
}

export interface InspectSavedWorkspaceCommand {
  readonly workspaceId: string | null;
}

export type WorkspaceSnapshot =
  | { readonly status: 'none' }
  | { readonly status: 'available'; readonly workspaceId: string }
  | {
      readonly status: 'unavailable';
      readonly workspaceId: string;
      readonly reason: WorkspaceUnavailableReason;
      readonly message: string;
    };

export type WorkspaceUnavailableReason =
  | 'not-saved'
  | 'path-unavailable'
  | 'registry-unavailable';

export interface WorkspaceRecord {
  readonly id: string;
  readonly cwd: string;
  readonly name: string;
  readonly createdAt: string;
}

export interface WorkspaceRegistry {
  readonly version: 1;
  readonly workspaces: readonly WorkspaceRecord[];
}

export type WorkspacePersistenceMode =
  | { readonly status: 'persistent' }
  | {
      readonly status: 'memory';
      readonly warning: string;
      readonly error: WorkspacePersistenceIssue;
    };

export interface WorkspacePersistenceIssue {
  readonly code: WorkspaceMemoryModeReason;
  readonly message: string;
}

export type WorkspaceMemoryModeReason =
  | 'registry-unreadable'
  | 'registry-corrupted'
  | 'write-failed';

export type WorkspaceAvailability =
  | { readonly status: 'available' }
  | { readonly status: 'unavailable'; readonly reason: string };

export interface WorkspaceListItem {
  readonly workspaceId: string;
  readonly recordRef: string;
  readonly name: string;
  readonly cwd: string;
  readonly availability: WorkspaceAvailability;
  readonly selected: boolean;
  readonly operations: readonly WorkspaceOperation[];
}

export type WorkspaceOperation = 'rename' | 'edit-cwd' | 'remove';

export interface WorkspaceListSnapshot {
  readonly persistence: WorkspacePersistenceMode;
  readonly selectedWorkspaceId: string | null;
  readonly items: readonly WorkspaceListItem[];
}

export interface WorkspaceDependencies {
  readonly appData: AppDataStorePort;
  readonly paths: PathInspectionPort;
  readonly pathComparison: PathComparisonPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
}

export interface WorkspaceService {
  inspectSavedWorkspace(input: InspectSavedWorkspaceCommand): Promise<WorkspaceSnapshot>;
  openList(input: OpenWorkspaceListCommand): Promise<WorkspaceListSnapshot>;
  add(input: AddWorkspaceCommand): Promise<WorkspaceListSnapshot>;
  rename(input: RenameWorkspaceCommand): Promise<WorkspaceListSnapshot>;
  editCwd(input: EditWorkspaceCwdCommand): Promise<WorkspaceListSnapshot>;
  remove(input: RemoveWorkspaceCommand): Promise<WorkspaceListSnapshot>;
}

export class WorkspaceValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WorkspaceValidationError';
  }
}

export class WorkspacePersistenceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WorkspacePersistenceError';
  }
}

export class WorkspaceConflictError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WorkspaceConflictError';
  }
}

const WORKSPACE_REGISTRY_DOCUMENT = 'workspaces.json';
const MEMORY_MODE_WARNING = '当前 Workspace 变更不会持久保存';

type WorkspaceRuntimeState =
  | { readonly mode: 'persistent'; readonly registry: null }
  | { readonly mode: 'memory'; readonly registry: WorkspaceRegistry; readonly error: WorkspaceMemoryModeError };

interface MutationResult {
  readonly registry: WorkspaceRegistry;
  readonly persistence: WorkspacePersistenceMode;
}

export function createWorkspaceService(dependencies: WorkspaceDependencies): WorkspaceService {
  let runtimeState: WorkspaceRuntimeState = {
    mode: 'persistent',
    registry: null,
  };

  return {
    async inspectSavedWorkspace(input: InspectSavedWorkspaceCommand): Promise<WorkspaceSnapshot> {
      if (!input.workspaceId) {
        return {
          status: 'none',
        };
      }

      const workspaceId = input.workspaceId;
      const state = await readRegistryForList({ dependencies, runtimeState });
      runtimeState = state.runtimeState;
      const record = state.registry.workspaces.find(workspace => sameWorkspaceId({ dependencies, left: workspace.cwd, right: workspaceId }));

      if (!record) {
        return {
          status: 'unavailable',
          workspaceId,
          reason: state.persistence.status === 'memory' ? 'registry-unavailable' : 'not-saved',
          message: state.persistence.status === 'memory' ? state.persistence.error.message : 'Workspace 未保存',
        };
      }

      const availability = await inspectAvailability({ dependencies, cwd: record.cwd });
      if (availability.status === 'unavailable') {
        return {
          status: 'unavailable',
          workspaceId: record.cwd,
          reason: 'path-unavailable',
          message: availability.reason,
        };
      }

      return {
        status: 'available',
        workspaceId: record.cwd,
      };
    },

    async openList(input: OpenWorkspaceListCommand): Promise<WorkspaceListSnapshot> {
      const state = await readRegistryForList({ dependencies, runtimeState });
      runtimeState = state.runtimeState;
      return createWorkspaceListSnapshot({ dependencies, registry: state.registry, persistence: state.persistence, selectedWorkspaceId: input.selectedWorkspaceId });
    },

    async add(input: AddWorkspaceCommand): Promise<WorkspaceListSnapshot> {
      const inspected = await validateWorkspaceCwd({ dependencies, cwd: input.cwd });
      const result = await mutateRegistry({ dependencies, runtimeState }, registry => {
        assertNoDuplicateWorkspace({ dependencies, registry, cwd: inspected.canonicalPath });
        const name = input.name === '' ? inspected.basename : input.name;
        return {
          version: 1,
          workspaces: [
            ...registry.workspaces,
            {
              id: readRequiredId(dependencies),
              cwd: inspected.canonicalPath,
              name,
              createdAt: readRequiredNow(dependencies),
            },
          ],
        };
      });
      runtimeState = result.runtimeState;
      return createWorkspaceListSnapshot({ dependencies, registry: result.registry, persistence: result.persistence, selectedWorkspaceId: input.selectedWorkspaceId });
    },

    async rename(input: RenameWorkspaceCommand): Promise<WorkspaceListSnapshot> {
      const result = await mutateRegistry({ dependencies, runtimeState }, registry => {
        const target = findWorkspaceTarget({ dependencies, registry, recordRef: input.recordRef, currentWorkspaceId: input.currentWorkspaceId });
        return {
          version: 1,
          workspaces: registry.workspaces.map(workspace => workspace.id === target.id ? { ...workspace, name: input.name } : workspace),
        };
      });
      runtimeState = result.runtimeState;
      return createWorkspaceListSnapshot({ dependencies, registry: result.registry, persistence: result.persistence, selectedWorkspaceId: input.selectedWorkspaceId });
    },

    async editCwd(input: EditWorkspaceCwdCommand): Promise<WorkspaceListSnapshot> {
      const inspected = await validateWorkspaceCwd({ dependencies, cwd: input.cwd });
      let nextSelectedWorkspaceId = input.selectedWorkspaceId;
      const result = await mutateRegistry({ dependencies, runtimeState }, registry => {
        const target = findWorkspaceTarget({ dependencies, registry, recordRef: input.recordRef, currentWorkspaceId: input.currentWorkspaceId });
        assertNoDuplicateWorkspace({ dependencies, registry, cwd: inspected.canonicalPath, exceptRecordId: target.id });
        if (input.selectedWorkspaceId !== null && sameWorkspaceId({ dependencies, left: target.cwd, right: input.selectedWorkspaceId })) {
          nextSelectedWorkspaceId = inspected.canonicalPath;
        }
        return {
          version: 1,
          workspaces: registry.workspaces.map(workspace => workspace.id === target.id ? { ...workspace, cwd: inspected.canonicalPath } : workspace),
        };
      });
      runtimeState = result.runtimeState;
      return createWorkspaceListSnapshot({ dependencies, registry: result.registry, persistence: result.persistence, selectedWorkspaceId: nextSelectedWorkspaceId });
    },

    async remove(input: RemoveWorkspaceCommand): Promise<WorkspaceListSnapshot> {
      const result = await mutateRegistry({ dependencies, runtimeState }, registry => {
        const target = findWorkspaceTarget({ dependencies, registry, recordRef: input.recordRef, currentWorkspaceId: input.currentWorkspaceId });
        if (input.selectedWorkspaceId !== null && sameWorkspaceId({ dependencies, left: target.cwd, right: input.selectedWorkspaceId })) {
          throw new WorkspaceConflictError('selected-workspace-remove-forbidden', '当前选中的 Workspace 不能移除');
        }
        return {
          version: 1,
          workspaces: registry.workspaces.filter(workspace => workspace.id !== target.id),
        };
      });
      runtimeState = result.runtimeState;
      return createWorkspaceListSnapshot({ dependencies, registry: result.registry, persistence: result.persistence, selectedWorkspaceId: input.selectedWorkspaceId });
    },
  };
}

interface ReadRegistryForListInput {
  readonly dependencies: WorkspaceDependencies;
  readonly runtimeState: WorkspaceRuntimeState;
}

interface ReadRegistryForListResult {
  readonly registry: WorkspaceRegistry;
  readonly persistence: WorkspacePersistenceMode;
  readonly runtimeState: WorkspaceRuntimeState;
}

async function readRegistryForList(input: ReadRegistryForListInput): Promise<ReadRegistryForListResult> {
  if (input.runtimeState.mode === 'memory') {
    const registry = input.runtimeState.registry;
    return {
      registry,
      persistence: createMemoryPersistence(input.runtimeState.error),
      runtimeState: input.runtimeState,
    };
  }

  try {
    const registry = await readPersistentRegistry(input.dependencies);
    return {
      registry,
      persistence: { status: 'persistent' },
      runtimeState: { mode: 'persistent', registry: null },
    };
  } catch (error) {
    const memoryError = createMemoryModeErrorFromReadFailure(error);
    const registry = createEmptyRegistry();
    return {
      registry,
      persistence: createMemoryPersistence(memoryError),
      runtimeState: { mode: 'memory', registry, error: memoryError },
    };
  }
}

interface MutateContext {
  readonly dependencies: WorkspaceDependencies;
  readonly runtimeState: WorkspaceRuntimeState;
}

interface MutateRegistryResult extends MutationResult {
  readonly runtimeState: WorkspaceRuntimeState;
}

async function mutateRegistry(context: MutateContext, change: (registry: WorkspaceRegistry) => WorkspaceRegistry): Promise<MutateRegistryResult> {
  if (context.runtimeState.mode === 'memory') {
    const current = context.runtimeState.registry;
    const registry = change(current);
    return {
      registry,
      persistence: createMemoryPersistence(context.runtimeState.error),
      runtimeState: { mode: 'memory', registry, error: context.runtimeState.error },
    };
  }

  let current: WorkspaceRegistry;
  try {
    current = await readPersistentRegistry(context.dependencies);
  } catch (error) {
    const memoryError = createMemoryModeErrorFromReadFailure(error);
    const registry = change(createEmptyRegistry());
    return {
      registry,
      persistence: createMemoryPersistence(memoryError),
      runtimeState: { mode: 'memory', registry, error: memoryError },
    };
  }

  const registry = change(current);

  try {
    await writePersistentRegistry({ dependencies: context.dependencies, registry });
    return {
      registry,
      persistence: { status: 'persistent' },
      runtimeState: { mode: 'persistent', registry: null },
    };
  } catch {
    const memoryError = {
      reason: 'write-failed' as const,
      message: 'Workspace 配置不可写',
    };
    return {
      registry,
      persistence: createMemoryPersistence(memoryError),
      runtimeState: { mode: 'memory', registry, error: memoryError },
    };
  }
}

async function readPersistentRegistry(dependencies: WorkspaceDependencies): Promise<WorkspaceRegistry> {
  const document = await dependencies.appData.readDocument({ name: WORKSPACE_REGISTRY_DOCUMENT });
  if (document === null) {
    return createEmptyRegistry();
  }

  return parseWorkspaceRegistry(document);
}

async function writePersistentRegistry(input: { readonly dependencies: WorkspaceDependencies; readonly registry: WorkspaceRegistry }): Promise<void> {
  await input.dependencies.appData.writeDocumentAtomically({
    name: WORKSPACE_REGISTRY_DOCUMENT,
    content: JSON.stringify(input.registry),
  });
}

function parseWorkspaceRegistry(document: string): WorkspaceRegistry {
  let value: unknown;
  try {
    value = JSON.parse(document) as unknown;
  } catch {
    throw new WorkspacePersistenceError('corrupted-registry', 'Workspace 配置文件损坏');
  }

  if (!isWorkspaceRegistry(value)) {
    throw new WorkspacePersistenceError('invalid-registry', 'Workspace 配置文件损坏');
  }

  return value;
}

function isWorkspaceRegistry(value: unknown): value is WorkspaceRegistry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { readonly version?: unknown; readonly workspaces?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.workspaces)) {
    return false;
  }

  return candidate.workspaces.every(isWorkspaceRecord);
}

function isWorkspaceRecord(value: unknown): value is WorkspaceRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Record<keyof WorkspaceRecord, unknown>>;
  return typeof candidate.id === 'string'
    && typeof candidate.cwd === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.createdAt === 'string';
}

function createEmptyRegistry(): WorkspaceRegistry {
  return {
    version: 1,
    workspaces: [],
  };
}

interface WorkspaceMemoryModeError {
  readonly reason: WorkspaceMemoryModeReason;
  readonly message: string;
}

function createMemoryPersistence(error: WorkspaceMemoryModeError): WorkspacePersistenceMode {
  return {
    status: 'memory',
    warning: MEMORY_MODE_WARNING,
    error: {
      code: error.reason,
      message: error.message,
    },
  };
}

function createDefaultMemoryModeError(): WorkspaceMemoryModeError {
  return {
    reason: 'registry-unreadable',
    message: 'Workspace 配置不可读',
  };
}

function createMemoryModeErrorFromReadFailure(error: unknown): WorkspaceMemoryModeError {
  if (error instanceof WorkspacePersistenceError && (error.code === 'corrupted-registry' || error.code === 'invalid-registry')) {
    return {
      reason: 'registry-corrupted',
      message: 'Workspace 配置文件损坏',
    };
  }

  if (error instanceof AppDataStoreError && error.code === 'read-failed') {
    return {
      reason: 'registry-unreadable',
      message: 'Workspace 配置不可读',
    };
  }

  return createDefaultMemoryModeError();
}

async function validateWorkspaceCwd(input: { readonly dependencies: WorkspaceDependencies; readonly cwd: string }): Promise<{ readonly canonicalPath: string; readonly basename: string }> {
  const cwd = input.cwd.trim();
  if (cwd === '') {
    throw new WorkspaceValidationError('empty', 'cwd 必填');
  }

  const result = await input.dependencies.paths.inspect({ path: cwd });
  if (result.status === 'invalid') {
    throw new WorkspaceValidationError(result.reason, result.message);
  }

  return {
    canonicalPath: result.canonicalPath,
    basename: result.basename,
  };
}

async function createWorkspaceListSnapshot(input: {
  readonly dependencies: WorkspaceDependencies;
  readonly registry: WorkspaceRegistry;
  readonly persistence: WorkspacePersistenceMode;
  readonly selectedWorkspaceId: string | null;
}): Promise<WorkspaceListSnapshot> {
  const items: WorkspaceListItem[] = [];
  let selectedWorkspaceId: string | null = null;

  for (const record of input.registry.workspaces) {
    const availability = await inspectAvailability({ dependencies: input.dependencies, cwd: record.cwd });
    const selected = availability.status === 'available'
      && input.selectedWorkspaceId !== null
      && sameWorkspaceId({ dependencies: input.dependencies, left: record.cwd, right: input.selectedWorkspaceId });
    if (selected) {
      selectedWorkspaceId = record.cwd;
    }
    items.push({
      workspaceId: record.cwd,
      recordRef: record.id,
      name: record.name,
      cwd: record.cwd,
      availability,
      selected,
      operations: readAllowedOperations({ availability, selected }),
    });
  }

  return {
    persistence: input.persistence,
    selectedWorkspaceId,
    items,
  };
}

async function inspectAvailability(input: { readonly dependencies: WorkspaceDependencies; readonly cwd: string }): Promise<WorkspaceAvailability> {
  const result = await input.dependencies.paths.inspect({ path: input.cwd });
  if (result.status === 'available') {
    return {
      status: 'available',
    };
  }

  return {
    status: 'unavailable',
    reason: result.message,
  };
}

function readAllowedOperations(input: { readonly availability: WorkspaceAvailability; readonly selected: boolean }): readonly WorkspaceOperation[] {
  if (input.availability.status === 'unavailable') {
    return ['remove'];
  }

  if (input.selected) {
    return ['rename', 'edit-cwd'];
  }

  return ['rename', 'edit-cwd', 'remove'];
}

function findWorkspaceTarget(input: {
  readonly dependencies: WorkspaceDependencies;
  readonly registry: WorkspaceRegistry;
  readonly recordRef: string | null;
  readonly currentWorkspaceId: string;
}): WorkspaceRecord {
  const byRecordRef = input.recordRef === null ? undefined : input.registry.workspaces.find(workspace => workspace.id === input.recordRef);
  if (byRecordRef) {
    return byRecordRef;
  }

  if (input.recordRef !== null) {
    throw new WorkspaceConflictError('workspace-not-found', 'Workspace 记录已变更或不存在');
  }

  const byWorkspaceId = input.registry.workspaces.find(workspace => sameWorkspaceId({
    dependencies: input.dependencies,
    left: workspace.cwd,
    right: input.currentWorkspaceId,
  }));
  if (!byWorkspaceId) {
    throw new WorkspaceConflictError('workspace-not-found', 'Workspace 记录已变更或不存在');
  }

  return byWorkspaceId;
}

function assertNoDuplicateWorkspace(input: {
  readonly dependencies: WorkspaceDependencies;
  readonly registry: WorkspaceRegistry;
  readonly cwd: string;
  readonly exceptRecordId?: string;
}): void {
  const duplicate = input.registry.workspaces.find(workspace => workspace.id !== input.exceptRecordId && sameWorkspaceId({
    dependencies: input.dependencies,
    left: workspace.cwd,
    right: input.cwd,
  }));
  if (duplicate) {
    throw new WorkspaceConflictError('duplicate-workspace', 'Workspace 已存在');
  }
}

function sameWorkspaceId(input: { readonly dependencies: WorkspaceDependencies; readonly left: string; readonly right: string }): boolean {
  return input.dependencies.pathComparison.samePath({
    left: input.left,
    right: input.right,
  });
}

function readRequiredId(dependencies: WorkspaceDependencies): string {
  return dependencies.ids.createId();
}

function readRequiredNow(dependencies: WorkspaceDependencies): string {
  return dependencies.clock.now();
}
