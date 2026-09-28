import { createContext, useContext } from 'react';

/** True inside a CoveredLayer that another layer (e.g. Settings) covers. */
export const CoveredContext = createContext(false);

/** True while the layer this component renders in is covered. */
export function useCovered(): boolean {
  return useContext(CoveredContext);
}

/**
 * The layer a component renders in: the panel ('base') or a full layer on
 * top of it ('overlay', see OverlayLayer). Dialogs opened from an overlay
 * must stack above it, not at the panel's dialog level beneath it.
 */
export type LayerLevel = 'base' | 'overlay';

export const LayerLevelContext = createContext<LayerLevel>('base');

export function useLayerLevel(): LayerLevel {
  return useContext(LayerLevelContext);
}
