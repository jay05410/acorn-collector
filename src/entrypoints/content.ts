import {
  createContextTargetTracker,
  isCaptureRequest,
  respondToCapture,
} from '@/lib/capture/content-handler';

/**
 * Always-on and deliberately small: it only remembers the last right-clicked
 * element (in memory) and builds a snapshot when the background asks. The
 * heavy readability extractor is injected separately, on demand.
 *
 * Top frame only (no allFrames): running in every ad and embed iframe costs
 * more than it gives. For a right-click inside an iframe the background
 * injects this script into that frame on demand; that copy never saw the
 * click, so the background relies on the link, image and selection the
 * browser reported (see lib/capture/controller.ts).
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
