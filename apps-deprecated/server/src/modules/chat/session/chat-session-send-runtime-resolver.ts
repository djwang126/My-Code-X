import { assertSessionContextMatches, resolveSessionWorkspace } from '../shared/chat-session-state.js';
import {
  createThreadBootstrapState,
  sameAppliedThreadRuntimeOverrides,
} from '../thread/thread-bootstrap-policy.js';
import type { PromptOverrideResolver, RuntimeSettings } from '../../../common/codex/codex-types.js';

export function createGetOrCreateRuntimeForSend({
  promptOverrideResolver,
  registry,
  sessionRecovery,
  startThreadForRuntime,
}: {
  promptOverrideResolver?: PromptOverrideResolver | null;
  registry: any;
  sessionRecovery: any;
  startThreadForRuntime: any;
}) {
  return async function getOrCreateRuntimeForSend({
    viewerId,
    slotId,
    workspace = '',
    threadId,
    runtimeSettings,
    collaborationModeKind,
  }: {
    viewerId: string;
    slotId: string;
    workspace?: string;
    threadId?: string;
    runtimeSettings?: RuntimeSettings | null;
    collaborationModeKind?: string;
  }) {
    const runtime = registry.getRuntimeBySlotId(slotId);
    const bootstrapState = await createThreadBootstrapState({ runtimeSettings, promptOverrideResolver });
    const requestedThreadRuntimeOverrides = bootstrapState.appliedThreadRuntimeOverrides;

    assertSessionContextMatches(runtime, { workspace, threadId });

    if (runtime?.threadId) {
      const attachment = sessionRecovery.getRuntimeAttachment(runtime);
      const needsRestore = !attachment.attached;
      const hasRuntimeSettingsMismatch = !sameAppliedThreadRuntimeOverrides(
        runtime.appliedThreadRuntimeOverrides ?? null,
        requestedThreadRuntimeOverrides,
      );

      if (needsRestore || hasRuntimeSettingsMismatch) {
        if (needsRestore) {
          sessionRecovery.logRuntimeRecovery({
            trigger: 'send_message',
            runtime,
            slotId: runtime.slotId,
            threadId: runtime.threadId,
            workspace: resolveSessionWorkspace(runtime, workspace),
            attachment,
          });
        }

        return {
          runtime: await sessionRecovery.restoreRuntime({
            viewerId,
            slotId,
            workspace: resolveSessionWorkspace(runtime, workspace),
            threadId: runtime.threadId,
            runtimeSettings: bootstrapState.normalizedRuntimeSettings,
            recoveryContext: needsRestore
              ? {
                  trigger: 'send_message',
                }
              : null,
          }),
          createdThread: false,
          runtimeSettings: bootstrapState.normalizedRuntimeSettings,
        };
      }

      return {
        runtime,
        createdThread: false,
        runtimeSettings: bootstrapState.normalizedRuntimeSettings,
      };
    }

    if (threadId) {
      const restoredRuntime = await sessionRecovery.restoreRuntime({
        viewerId,
        slotId,
        workspace: resolveSessionWorkspace(runtime, workspace),
        threadId,
        runtimeSettings: bootstrapState.normalizedRuntimeSettings,
      });
      return {
        runtime: restoredRuntime,
        createdThread: false,
        runtimeSettings: bootstrapState.normalizedRuntimeSettings,
      };
    }

    return {
      runtime: await startThreadForRuntime({
        viewerId,
        slotId,
        workspace: resolveSessionWorkspace(runtime, workspace),
        runtime,
        runtimeSettings: bootstrapState.normalizedRuntimeSettings,
        collaborationModeKind,
      }),
      createdThread: true,
      runtimeSettings: bootstrapState.normalizedRuntimeSettings,
    };
  };
}
