import { extractReadable } from '@/lib/capture/readable';

/**
 * Injected on demand by the background (chrome.scripting.executeScript with
 * files: ['extractor.js']). The value returned from main() becomes the
 * injection result, so it must be structured-clonable plain data.
 */
export default defineUnlistedScript(() => extractReadable(document, location.href));
