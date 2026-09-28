import type { ReactNode } from 'react';
import { CoveredContext } from './layer-context';

interface CoveredLayerProps {
  /** Another layer (e.g. Settings) is on top of this one. */
  covered: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * The panel's main layer. While another layer covers it, its content stays
 * mounted (drafts, edits and a running analysis survive) but is inert, and
 * so are the dialogs opened from it, although they render in portals.
 */
export function CoveredLayer({ covered, className, children }: CoveredLayerProps) {
  return (
    <CoveredContext.Provider value={covered}>
      <div inert={covered} className={className}>
        {children}
      </div>
    </CoveredContext.Provider>
  );
}
