import { useReducer, useState, type FormEvent } from 'react';

import { useImageAttachmentDraft } from '../../../features/chat/attachments';
import type { RuntimeSettings } from '../../../features/chat/settings';
import type { SessionSendInput } from '../../../features/chat/runtime';
import type { SavedWorkspace, WorkspaceDraft } from '../../../features/workspace/bookmarks';
import type {
  ChatPageAttachmentUploadHandler,
  ChatPageReviewStartHandler,
  ChatPageSubmitHandler,
  ChatPageWorkspaceHandler,
  ChatPageWorkspaceSaveHandler,
} from '../types';
import {
  chatPageUiReducer,
  createInitialChatPageUiState,
} from '../state/ui-reducer';
import {
  createInitialReviewFormState,
  reviewFormReducer,
  type ReviewDelivery,
  type ReviewTargetType,
} from '../state/review-form-reducer';
import {
  createInitialWorkspaceDraft,
  workspaceDraftReducer,
} from '../state/workspace-draft-reducer';

type UseChatPageLayoutStateOptions = {
  inputDisabled: boolean;
  workspaceExplorerOpen: boolean;
  runtimeSettings: RuntimeSettings | null;
  onSubmit?: ChatPageSubmitHandler;
  onUploadAttachment?: ChatPageAttachmentUploadHandler;
  onRuntimeSettingsChange?: (settings: RuntimeSettings) => void;
  onReviewStart?: ChatPageReviewStartHandler;
  onWorkspaceSave?: ChatPageWorkspaceSaveHandler;
  onWorkspaceOpen?: ChatPageWorkspaceHandler;
  onWorkspaceExplorerOpen?: () => boolean | Promise<boolean>;
  onWorkspaceExplorerClose?: () => boolean | Promise<boolean>;
};

export function useChatPageLayoutState({
  inputDisabled,
  workspaceExplorerOpen,
  runtimeSettings,
  onSubmit,
  onUploadAttachment,
  onRuntimeSettingsChange,
  onReviewStart,
  onWorkspaceSave,
  onWorkspaceOpen,
  onWorkspaceExplorerOpen,
  onWorkspaceExplorerClose,
}: UseChatPageLayoutStateOptions) {
  const [uiState, dispatchUi] = useReducer(chatPageUiReducer, undefined, createInitialChatPageUiState);
  const [bottomDrawerOpen, setBottomDrawerOpen] = useState(false);
  const [reviewChooserOpen, setReviewChooserOpen] = useState(false);
  const [manageWorkspaceOpen, setManageWorkspaceOpen] = useState(false);
  const [workspaceDraft, dispatchWorkspaceDraft] = useReducer(
    workspaceDraftReducer,
    undefined,
    createInitialWorkspaceDraft,
  );
  const [reviewForm, dispatchReviewForm] = useReducer(
    reviewFormReducer,
    undefined,
    createInitialReviewFormState,
  );
  const attachmentDialogOpen = uiState.primaryOverlay === 'attachment-dialog';
  const leftOpen = uiState.primaryOverlay === 'workspace-navigation';
  const rightOpen = uiState.primaryOverlay === 'tools-panel';
  const settingsOpen = uiState.primaryOverlay === 'chat-settings';
  const attachmentDraft = useImageAttachmentDraft({
    onUploadAttachment: async (file: File) => {
      if (!onUploadAttachment) {
        throw new Error('image attachment upload is not configured');
      }

      return onUploadAttachment(file);
    },
  });

  async function handleSubmit() {
    if (inputDisabled || attachmentDraft.hasBlockingItems) {
      return;
    }

    const content = attachmentDraft.buildSessionContent();
    const submitInput: SessionSendInput = content.length
      ? { text: attachmentDraft.draftText.trim(), content }
      : { text: attachmentDraft.draftText.trim() };
    let submitted = false;

    try {
      attachmentDraft.beginSend();
      submitted = (await onSubmit?.(submitInput)) ?? false;
    } finally {
      if (!submitted) {
        attachmentDraft.resetAfterSendFailure();
      }
    }

    if (submitted) {
      attachmentDraft.clearDraft();
    }

    setBottomDrawerOpen(false);
  }

  function updateRuntimeSetting<K extends keyof RuntimeSettings>(key: K, value: RuntimeSettings[K]) {
    if (!runtimeSettings) return;
    onRuntimeSettingsChange?.({ ...runtimeSettings, [key]: value });
  }

  async function handleWorkspaceSave({ path, label }: WorkspaceDraft) {
    const trimmedPath = path.trim();
    const trimmedLabel = label.trim();
    if (!trimmedPath) return false;
    const saved = (await onWorkspaceSave?.({ path: trimmedPath, label: trimmedLabel })) ?? true;
    if (!saved) return false;
    dispatchWorkspaceDraft({ type: 'draft/cleared' });
    return true;
  }

  function startEditingWorkspace(savedWorkspace: SavedWorkspace) {
    setManageWorkspaceOpen(true);
    dispatchWorkspaceDraft({ type: 'editing/started', workspace: savedWorkspace });
  }

  function buildReviewTarget() {
    if (reviewForm.targetType === 'uncommittedChanges') return { type: 'uncommittedChanges' } as const;
    if (reviewForm.targetType === 'baseBranch') {
      const branch = reviewForm.baseBranch.trim();
      return branch ? ({ type: 'baseBranch', branch } as const) : null;
    }
    if (reviewForm.targetType === 'commit') {
      const sha = reviewForm.commitSha.trim();
      if (!sha) return null;
      const trimmedTitle = reviewForm.commitTitle.trim();
      return trimmedTitle ? ({ type: 'commit', sha, title: trimmedTitle } as const) : ({ type: 'commit', sha } as const);
    }
    const instructions = reviewForm.customInstructions.trim();
    return instructions ? ({ type: 'custom', instructions } as const) : null;
  }

  async function handleReviewStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = buildReviewTarget();
    if (!target) return;
    const started = (await onReviewStart?.({ delivery: reviewForm.delivery, target })) ?? false;
    if (started) setReviewChooserOpen(false);
  }

  async function closeWorkspaceExplorerIfOpen() {
    if (!workspaceExplorerOpen) {
      return true;
    }

    return (await onWorkspaceExplorerClose?.()) ?? true;
  }

  async function closeAllOverlays() {
    const closed = await closeWorkspaceExplorerIfOpen();
    if (!closed) {
      return;
    }

    dispatchUi({ type: 'overlay/closed' });
  }

  async function handleLeftToggle() {
    const closed = await closeWorkspaceExplorerIfOpen();
    if (!closed) {
      return;
    }

    dispatchUi({ type: 'overlay/toggled', overlay: 'workspace-navigation' });
  }

  async function handleRightToggle() {
    const closed = await closeWorkspaceExplorerIfOpen();
    if (!closed) {
      return;
    }

    dispatchUi({ type: 'overlay/toggled', overlay: 'tools-panel' });
  }

  async function handleSettingsToggle() {
    const closed = await closeWorkspaceExplorerIfOpen();
    if (!closed) {
      return;
    }

    dispatchUi({ type: 'overlay/toggled', overlay: 'chat-settings' });
  }

  async function handleWorkspaceExplorerOpenFromTools() {
    const opened = (await onWorkspaceExplorerOpen?.()) ?? false;
    if (opened) {
      dispatchUi({ type: 'overlay/closed' });
    }
    return opened;
  }

  async function handleAttachmentDialogOpen() {
    const closed = await closeWorkspaceExplorerIfOpen();
    if (!closed) {
      return;
    }

    setBottomDrawerOpen(false);
    dispatchUi({ type: 'overlay/opened', overlay: 'attachment-dialog' });
  }

  function closeAttachmentDialog() {
    dispatchUi({ type: 'overlay/closed' });
  }

  async function handleWorkspaceOpenAndCloseManager(path: string) {
    const opened = (await onWorkspaceOpen?.(path)) ?? false;
    if (opened) {
      setManageWorkspaceOpen(false);
    }
    return opened;
  }

  return {
    attachmentDialogOpen,
    attachmentDraftItems: attachmentDraft.items,
    attachmentLimitMessage: attachmentDraft.limitMessage,
    draft: attachmentDraft.draftText,
    leftOpen,
    rightOpen,
    settingsOpen,
    bottomDrawerOpen,
    reviewChooserOpen,
    manageWorkspaceOpen,
    workspacePathDraft: workspaceDraft.path,
    workspaceLabelDraft: workspaceDraft.label,
    reviewTargetType: reviewForm.targetType,
    reviewDelivery: reviewForm.delivery,
    reviewBaseBranch: reviewForm.baseBranch,
    reviewCommitSha: reviewForm.commitSha,
    reviewCommitTitle: reviewForm.commitTitle,
    reviewCustomInstructions: reviewForm.customInstructions,
    setBottomDrawerOpen,
    setReviewChooserOpen,
    setManageWorkspaceOpen,
    setWorkspacePathDraft: (value: string) => dispatchWorkspaceDraft({ type: 'path/changed', value }),
    setWorkspaceLabelDraft: (value: string) => dispatchWorkspaceDraft({ type: 'label/changed', value }),
    setReviewTargetType: (value: ReviewTargetType) =>
      dispatchReviewForm({ type: 'target-type/changed', value }),
    setReviewDelivery: (value: ReviewDelivery) =>
      dispatchReviewForm({ type: 'delivery/changed', value }),
    setReviewBaseBranch: (value: string) =>
      dispatchReviewForm({ type: 'base-branch/changed', value }),
    setReviewCommitSha: (value: string) =>
      dispatchReviewForm({ type: 'commit-sha/changed', value }),
    setReviewCommitTitle: (value: string) =>
      dispatchReviewForm({ type: 'commit-title/changed', value }),
    setReviewCustomInstructions: (value: string) =>
      dispatchReviewForm({ type: 'custom-instructions/changed', value }),
    updateRuntimeSetting,
    handleAttachmentDialogOpen,
    closeAttachmentDialog,
    handleAttachmentFilesSelected: (files: File[]) => attachmentDraft.selectFiles({ files }),
    handleAttachmentRemoveItem: attachmentDraft.removeItem,
    setDraft: attachmentDraft.setDraftText,
    handleSubmit,
    handleWorkspaceSave,
    startEditingWorkspace,
    handleReviewStart,
    closeAllOverlays,
    handleLeftToggle,
    handleRightToggle,
    handleSettingsToggle,
    handleWorkspaceExplorerOpenFromTools,
    handleWorkspaceOpenAndCloseManager,
  };
}
