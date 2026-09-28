import {
  createContextTargetTracker,
  isCaptureRequest,
  respondToCapture,
} from '@/lib/capture/content-handler';

/**
 * Always-on and deliberately small: it only remembers the last right-clicked
 * element (in memory) and builds a snapshot when the background asks. The
 * heavy readability extractor is injected separately, on demand.
 */
export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const tracker = createContextTargetTracker();
    document.addEventListener('contextmenu', tracker.record, {
      capture: true,
      passive: true,
    });

    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!isCaptureRequest(message)) return false;
      sendResponse(respondToCapture(message, { window, tracker, now: Date.now }));
      return false;
    });
  },
});
