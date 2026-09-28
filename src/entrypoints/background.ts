import { createCaptureController } from '@/lib/capture/controller';

export default defineBackground(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.warn('[acorn] setPanelBehavior failed', error));

  const capture = createCaptureController({
    chrome,
    fetch: (input, init) => fetch(input, init),
  });

  chrome.runtime.onInstalled.addListener((details) => {
    capture.onInstalled(details).catch((error: unknown) => {
      console.warn('[acorn] context menu setup failed', error);
    });
  });

  // Listeners must stay synchronous up to sidePanel.open (user gesture);
  // the controller opens the panel before its first await.
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    void capture.onContextMenuClick(info, tab);
  });

  chrome.commands.onCommand.addListener((command, tab) => {
    void capture.onCommand(command, tab);
  });

  chrome.runtime.onMessage.addListener(capture.onRuntimeMessage);
});
