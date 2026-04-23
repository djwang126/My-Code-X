import { useEffect, useRef, useState } from 'react';

function readIsDocumentVisible() {
  if (typeof document === 'undefined') {
    return true;
  }

  return document.visibilityState === 'visible';
}

export function useSessionStreamVisibility(streamRevision: number) {
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => readIsDocumentVisible());
  const hiddenStreamRevisionRef = useRef<number | null>(null);

  useEffect(() => {
    function handleVisibilityChange() {
      setIsDocumentVisible(readIsDocumentVisible());
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (isDocumentVisible) {
      return;
    }

    hiddenStreamRevisionRef.current = streamRevision;
  }, [isDocumentVisible, streamRevision]);

  useEffect(() => {
    if (!isDocumentVisible) {
      return;
    }

    if (hiddenStreamRevisionRef.current === streamRevision) {
      return;
    }

    hiddenStreamRevisionRef.current = null;
  }, [isDocumentVisible, streamRevision]);

  return {
    isDocumentVisible,
    hiddenStreamRevision: hiddenStreamRevisionRef.current,
  };
}

