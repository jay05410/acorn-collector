import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CoveredContext, LayerLevelContext } from './layer-context';

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

interface OverlayLayerProps {
  className?: string;
  children?: ReactNode;
}

/**
 * A full-panel layer above the CoveredLayer and the dialogs opened from it
 * (--z-overlay), e.g. the settings view. Dialogs opened inside it stack
 * above it (--z-overlay-dialog), below toasts.
 */
export function OverlayLayer({ className, children }: OverlayLayerProps) {
  return (
    <LayerLevelContext.Provider value="overlay">
      <div
        className={cn(
          'fixed inset-0 z-(--z-overlay) flex flex-col bg-canvas',
          className
        )}
      >
        {children}
      </div>
    </LayerLevelContext.Provider>
  );
}
