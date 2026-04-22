import { ChatPageScreen } from '../../chat-page';
import { SessionBlockingState } from '../../session-feedback';
import { useSessionBootstrap } from '../hooks/useSessionBootstrap';
import { SLOT_DISPLACED_MESSAGE } from '../scope';
import { useSessionState } from '../context';

export function SessionGate() {
  const state = useSessionState();
  const { retryBootstrap, startFresh } = useSessionBootstrap();

  if (state.phase === 'auth-required') {
    return (
      <SessionBlockingState
        message="Refresh your credentials locally, then reload or start a fresh session."
        title="Access token required"
        tone="warning"
      />
    );
  }

  if (state.phase === 'error') {
    const retryLabel = state.errorMessage === SLOT_DISPLACED_MESSAGE ? 'Retake slot' : 'Retry';

    return (
      <SessionBlockingState
        actions={
          <>
            <button onClick={retryBootstrap} type="button">
              {retryLabel}
            </button>
            <button onClick={startFresh} type="button">
              Start over
            </button>
          </>
        }
        tone="error"
      >
        {state.errorMessage}
      </SessionBlockingState>
    );
  }

  return <ChatPageScreen />;
}
