import type { FormEvent } from 'react';

import type { ReviewStartTarget } from '../../thread-actions';
import { ReviewChooser } from './ReviewChooser';
import { IconClose, IconFolder, IconRefresh, IconReview } from './ThreadToolsIcons';

type ThreadToolsActionHandler = () => boolean | Promise<boolean>;

type ThreadToolsSidebarProps = {
  open: boolean;
  hasWorkspace: boolean;
  hasThread: boolean;
  actionBlocked: boolean;
  isRestarting: boolean;
  tokenUsageText?: string;
  reviewChooserOpen: boolean;
  reviewTargetType: ReviewStartTarget['type'];
  reviewDelivery: 'inline' | 'detached';
  reviewBaseBranch: string;
  reviewCommitSha: string;
  reviewCommitTitle: string;
  reviewCustomInstructions: string;
  onClose: () => void;
  onRestart?: ThreadToolsActionHandler;
  onWorkspaceExplorerOpen?: ThreadToolsActionHandler;
  onToggleReviewChooser: () => void;
  onReviewTargetTypeChange: (value: ReviewStartTarget['type']) => void;
  onReviewDeliveryChange: (value: 'inline' | 'detached') => void;
  onReviewBaseBranchChange: (value: string) => void;
  onReviewCommitShaChange: (value: string) => void;
  onReviewCommitTitleChange: (value: string) => void;
  onReviewCustomInstructionsChange: (value: string) => void;
  onReviewStart: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function ThreadToolsSidebar({
  open,
  hasWorkspace,
  hasThread,
  actionBlocked,
  isRestarting,
  tokenUsageText = '',
  reviewChooserOpen,
  reviewTargetType,
  reviewDelivery,
  reviewBaseBranch,
  reviewCommitSha,
  reviewCommitTitle,
  reviewCustomInstructions,
  onClose,
  onRestart,
  onWorkspaceExplorerOpen,
  onToggleReviewChooser,
  onReviewTargetTypeChange,
  onReviewDeliveryChange,
  onReviewBaseBranchChange,
  onReviewCommitShaChange,
  onReviewCommitTitleChange,
  onReviewCustomInstructionsChange,
  onReviewStart,
}: ThreadToolsSidebarProps) {
  const tokenUsageLines = tokenUsageText.split('|').map(line => line.trim()).filter(Boolean);

  return (
    <aside aria-label="tools sidebar" className={`sidebar-right ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h2>Tools</h2>
        <button aria-label="Close tools" className="sidebar-close-btn" onClick={onClose} type="button">
          <IconClose />
        </button>
      </div>
      <div className="sidebar-body">
        <p className="sidebar-section-title">Session</p>
        <button className="tool-btn" disabled={!hasWorkspace || isRestarting} onClick={() => void onRestart?.()} type="button">
          <IconRefresh />
          <span className="tool-btn-label">{isRestarting ? 'Restarting…' : 'Restart'}</span>
        </button>
        <button className="tool-btn" disabled={!hasWorkspace || isRestarting} onClick={() => void onWorkspaceExplorerOpen?.()} type="button">
          <IconFolder />
          <span className="tool-btn-label">File Explorer</span>
        </button>
        <button className="tool-btn" disabled={!hasThread || actionBlocked} onClick={onToggleReviewChooser} type="button">
          <IconReview />
          <span className="tool-btn-label">Code Review</span>
        </button>
        {reviewChooserOpen ? (
          <div className="review-section">
            <ReviewChooser
              onReviewBaseBranchChange={onReviewBaseBranchChange}
              onReviewCommitShaChange={onReviewCommitShaChange}
              onReviewCommitTitleChange={onReviewCommitTitleChange}
              onReviewCustomInstructionsChange={onReviewCustomInstructionsChange}
              onReviewDeliveryChange={onReviewDeliveryChange}
              onReviewTargetTypeChange={onReviewTargetTypeChange}
              onSubmit={onReviewStart}
              reviewBaseBranch={reviewBaseBranch}
              reviewCommitSha={reviewCommitSha}
              reviewCommitTitle={reviewCommitTitle}
              reviewCustomInstructions={reviewCustomInstructions}
              reviewDelivery={reviewDelivery}
              reviewTargetType={reviewTargetType}
            />
          </div>
        ) : null}
        {tokenUsageLines.length ? (
          <>
            <p className="sidebar-section-title">Usage</p>
            <section aria-label="token usage" className="sidebar-info-card">
              <h3 className="sidebar-info-card-title">Token usage</h3>
              <div className="sidebar-info-card-body">
                {tokenUsageLines.map(line => <p key={line}>{line}</p>)}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </aside>
  );
}
