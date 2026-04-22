import { useReducer, useState, type FormEvent } from 'react';

import { useImageAttachmentDraft } from '../../chat-attachments';
import type { RuntimeSettings } from '../../runtime-settings';
import type { SessionSendInput } from '../../chat-runtime/public-types';
import {
  chatPageUiReducer,
  createInitialChatPageUiState,
} from '../state/chat-page-ui-reducer';

type ReviewTargetType = 'uncommittedChanges' | 'baseBranch' | 'commit' | 'custom';
type ReviewDelivery = 'inline' | 'detached';

type UseChatPageLayoutStateOptions = {
  inputDisabled: boolean;
  workspaceExplorerOpen: boolean;
  runtimeSettings: RuntimeSettings | null;
  onSubmit?: (input: SessionSendInput) => boolean | Promise<boolean>;
  onUploadAttachment?: (file: File) => Promise<{ attachmentId: string }>;
  onRuntimeSettingsChange?: (settings: RuntimeSettings) => void;
  onReviewStart?: (payload: {
    delivery: ReviewDelivery;
    target:
      | { type: 'uncommittedChanges' }
      | { type: 'baseBranch'; branch: string }
      | { type: 'commit'; sha: string; title?: string }
      | { type: 'custom'; instructions: string };
  }) => boolean | Promise<boolean>;
  onWorkspaceSave?: (workspace: { path: string; label: string }) => boolean | Promise<boolean>;
  onWorkspaceOpen?: (workspacePath: string) => boolean | Promise<boolean>;
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
  const [workspacePathDraft, setWorkspacePathDraft] = useState('');
  const [workspaceLabelDraft, setWorkspaceLabelDraft] = useState('');
  const [reviewTargetType, setReviewTargetType] = useState<ReviewTargetType>('uncommittedChanges');
  const [reviewDelivery, setReviewDelivery] = useState<ReviewDelivery>('inline');
  const [reviewBaseBranch, setReviewBaseBranch] = useState('main');
  const [reviewCommitSha, setReviewCommitSha] = useState('');
  const [reviewCommitTitle, setReviewCommitTitle] = useState('');
  const [reviewCustomInstructions, setReviewCustomInstructions] = useState('');
  const attachmentDialogOpen = uiState.primaryOverlay === 'attachment-dialog';
  const leftOpen = uiState.primaryOverlay === 'workspace-sidebar';
  const rightOpen = uiState.primaryOverlay === 'thread-tools';
  const settingsOpen = uiState.primaryOverlay === 'runtime-settings';
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

  async function handleWorkspaceSave({ path, label }: { path: string; label: string }) {
    const trimmedPath = path.trim();
    const trimmedLabel = label.trim();
    if (!trimmedPath) return false;
    const saved = (await onWorkspaceSave?.({ path: trimmedPath, label: trimmedLabel })) ?? true;
    if (!saved) return false;
    setWorkspacePathDraft('');
    setWorkspaceLabelDraft('');
    return true;
  }

  function startEditingWorkspace(savedWorkspace: { path: string; label: string }) {
    setManageWorkspaceOpen(true);
    setWorkspacePathDraft(savedWorkspace.path);
    setWorkspaceLabelDraft(savedWorkspace.label);
  }

  function buildReviewTarget() {
    if (reviewTargetType === 'uncommittedChanges') return { type: 'uncommittedChanges' } as const;
    if (reviewTargetType === 'baseBranch') {
      const branch = reviewBaseBranch.trim();
      return branch ? ({ type: 'baseBranch', branch } as const) : null;
    }
    if (reviewTargetType === 'commit') {
      const sha = reviewCommitSha.trim();
      if (!sha) return null;
      const trimmedTitle = reviewCommitTitle.trim();
      return trimmedTitle ? ({ type: 'commit', sha, title: trimmedTitle } as const) : ({ type: 'commit', sha } as const);
    }
    const instructions = reviewCustomInstructions.trim();
    return instructions ? ({ type: 'custom', instructions } as const) : null;
  }

  async function handleReviewStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = buildReviewTarget();
    if (!target) return;
    const started = (await onReviewStart?.({ delivery: reviewDelivery, target })) ?? false;
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

    dispatchUi({ type: 'overlay/toggled', overlay: 'workspace-sidebar' });
  }

  async function handleRightToggle() {
    const closed = await closeWorkspaceExplorerIfOpen();
    if (!closed) {
      return;
    }

    dispatchUi({ type: 'overlay/toggled', overlay: 'thread-tools' });
  }

  async function handleSettingsToggle() {
    const closed = await closeWorkspaceExplorerIfOpen();
    if (!closed) {
      return;
    }

    dispatchUi({ type: 'overlay/toggled', overlay: 'runtime-settings' });
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
    workspacePathDraft,
    workspaceLabelDraft,
    reviewTargetType,
    reviewDelivery,
    reviewBaseBranch,
    reviewCommitSha,
    reviewCommitTitle,
    reviewCustomInstructions,
    setBottomDrawerOpen,
    setReviewChooserOpen,
    setManageWorkspaceOpen,
    setWorkspacePathDraft,
    setWorkspaceLabelDraft,
    setReviewTargetType,
    setReviewDelivery,
    setReviewBaseBranch,
    setReviewCommitSha,
    setReviewCommitTitle,
    setReviewCustomInstructions,
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
