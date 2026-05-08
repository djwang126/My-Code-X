export type ReviewTargetType = 'uncommittedChanges' | 'baseBranch' | 'commit' | 'custom';
export type ReviewDelivery = 'inline' | 'detached';

export type ReviewFormState = {
  targetType: ReviewTargetType;
  delivery: ReviewDelivery;
  baseBranch: string;
  commitSha: string;
  commitTitle: string;
  customInstructions: string;
};

type ReviewFormAction =
  | { type: 'target-type/changed'; value: ReviewTargetType }
  | { type: 'delivery/changed'; value: ReviewDelivery }
  | { type: 'base-branch/changed'; value: string }
  | { type: 'commit-sha/changed'; value: string }
  | { type: 'commit-title/changed'; value: string }
  | { type: 'custom-instructions/changed'; value: string };

export function createInitialReviewFormState(): ReviewFormState {
  return {
    targetType: 'uncommittedChanges',
    delivery: 'inline',
    baseBranch: 'main',
    commitSha: '',
    commitTitle: '',
    customInstructions: '',
  };
}

export function reviewFormReducer(
  state: ReviewFormState,
  action: ReviewFormAction,
): ReviewFormState {
  if (action.type === 'target-type/changed') {
    return {
      ...state,
      targetType: action.value,
    };
  }

  if (action.type === 'delivery/changed') {
    return {
      ...state,
      delivery: action.value,
    };
  }

  if (action.type === 'base-branch/changed') {
    return {
      ...state,
      baseBranch: action.value,
    };
  }

  if (action.type === 'commit-sha/changed') {
    return {
      ...state,
      commitSha: action.value,
    };
  }

  if (action.type === 'commit-title/changed') {
    return {
      ...state,
      commitTitle: action.value,
    };
  }

  if (action.type === 'custom-instructions/changed') {
    return {
      ...state,
      customInstructions: action.value,
    };
  }

  return state;
}
