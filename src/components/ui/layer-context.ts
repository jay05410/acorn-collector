import { createContext, useContext } from 'react';

/** True inside a CoveredLayer that another layer (e.g. Settings) covers. */
export const CoveredContext = createContext(false);

/** True while the layer this component renders in is covered. */
export function useCovered(): boolean {
  return useContext(CoveredContext);
}
