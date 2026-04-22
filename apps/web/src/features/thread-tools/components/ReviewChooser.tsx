import type { ReviewStartTarget } from '../../thread-actions';

type ReviewChooserProps = {
  reviewTargetType: ReviewStartTarget['type'];
  reviewDelivery: 'inline' | 'detached';
  reviewBaseBranch: string;
  reviewCommitSha: string;
  reviewCommitTitle: string;
  reviewCustomInstructions: string;
  onReviewTargetTypeChange: (value: ReviewStartTarget['type']) => void;
  onReviewDeliveryChange: (value: 'inline' | 'detached') => void;
  onReviewBaseBranchChange: (value: string) => void;
  onReviewCommitShaChange: (value: string) => void;
  onReviewCommitTitleChange: (value: string) => void;
  onReviewCustomInstructionsChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function ReviewChooser({
  reviewTargetType,
  reviewDelivery,
  reviewBaseBranch,
  reviewCommitSha,
  reviewCommitTitle,
  reviewCustomInstructions,
  onReviewTargetTypeChange,
  onReviewDeliveryChange,
  onReviewBaseBranchChange,
  onReviewCommitShaChange,
  onReviewCommitTitleChange,
  onReviewCustomInstructionsChange,
  onSubmit,
}: ReviewChooserProps) {
  return (
    <section aria-label="review chooser">
      <form aria-label="review form" onSubmit={onSubmit}>
        <label>
          <span>Review target</span>
          <select aria-label="Review target" onChange={event => onReviewTargetTypeChange(event.target.value as ReviewStartTarget['type'])} value={reviewTargetType}>
            <option value="uncommittedChanges">Uncommitted changes</option>
            <option value="baseBranch">Base branch</option>
            <option value="commit">Commit</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          <span>Review delivery</span>
          <select aria-label="Review delivery" onChange={event => onReviewDeliveryChange(event.target.value as 'inline' | 'detached')} value={reviewDelivery}>
            <option value="inline">Inline</option>
            <option value="detached">Detached</option>
          </select>
        </label>
        {reviewTargetType === 'baseBranch' ? <label><span>Base branch</span><input aria-label="Base branch" onChange={event => onReviewBaseBranchChange(event.target.value)} value={reviewBaseBranch} /></label> : null}
        {reviewTargetType === 'commit' ? <><label><span>Commit sha</span><input aria-label="Commit sha" onChange={event => onReviewCommitShaChange(event.target.value)} value={reviewCommitSha} /></label><label><span>Commit title</span><input aria-label="Commit title" onChange={event => onReviewCommitTitleChange(event.target.value)} value={reviewCommitTitle} /></label></> : null}
        {reviewTargetType === 'custom' ? <label><span>Custom instructions</span><textarea aria-label="Custom instructions" onChange={event => onReviewCustomInstructionsChange(event.target.value)} value={reviewCustomInstructions} /></label> : null}
        <button type="submit">Start review</button>
      </form>
    </section>
  );
}
