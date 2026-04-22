import { useEffect, type CSSProperties, type ReactNode } from 'react';

type OverlayDialogProps = {
  ariaLabel: string;
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  showBackdrop?: boolean;
  showCloseButton?: boolean;
  title: string;
  width?: string;
  zIndex?: number;
};

const rootStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
};

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.78)',
};

const panelStyle: CSSProperties = {
  position: 'relative',
  maxHeight: 'calc(100vh - 2rem)',
  overflow: 'auto',
  background: '#0f172a',
  color: '#e2e8f0',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  borderRadius: '1rem',
  padding: '1rem',
  display: 'grid',
  gap: '0.75rem',
  pointerEvents: 'auto',
  boxShadow: '0 24px 48px rgba(15, 23, 42, 0.28)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
};

export function OverlayDialog({
  ariaLabel,
  children,
  onClose,
  open,
  showBackdrop = true,
  showCloseButton = true,
  title,
  width = 'min(32rem, 100%)',
  zIndex = 260,
}: OverlayDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div style={{ ...rootStyle, zIndex, pointerEvents: showBackdrop ? 'auto' : 'none' }}>
      {showBackdrop ? <div aria-hidden="true" onClick={onClose} style={backdropStyle} /> : null}
      <section
        aria-label={ariaLabel}
        aria-modal="true"
        role="dialog"
        style={{ ...panelStyle, width }}
      >
        <div style={headerStyle}>
          <strong>{title}</strong>
          {showCloseButton ? (
            <button onClick={onClose} type="button">
              Close
            </button>
          ) : null}
        </div>
        {children}
      </section>
    </div>
  );
}
