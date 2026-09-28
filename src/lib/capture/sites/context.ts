/** Inputs every site extractor receives from the content script. */
export interface CaptureContext {
  doc: Document;
  /** location.href of the frame being captured. */
  url: string;
  /** Element the user right-clicked (or the selection's element), if any. */
  target: Element | null;
  selection: string | null;
  now: number;
}
