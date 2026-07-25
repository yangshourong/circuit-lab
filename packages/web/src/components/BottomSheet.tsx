import type React from 'react';
import { useEffect } from 'react';

interface Props {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}

/**
 * Mobile bottom sheet — slides up from the bottom of the viewport.
 * Renders nothing on desktop (breakpoint !== 'mobile'/'tablet').
 * Tap overlay or swipe down to dismiss.
 */
export function BottomSheet({ children, open, onClose }: Props) {
  // Close on escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="bottom-sheet-overlay" onClick={onClose} />
      <div className="bottom-sheet" role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <button type="button" className="sheet-close-btn" onClick={onClose}>
          ✕
        </button>
        {children}
      </div>
    </>
  );
}
