export default defineBackground(() => {
  browser.contextMenus.create({
    id: 'add-to-acorn-collector',
    title: '도토리 주머니에 추가',
    contexts: ['selection', 'image', 'page'],
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'add-to-acorn-collector') {
      const selectedText = info.selectionText;
      const pageUrl = tab?.url;

      await browser.storage.local.set({
        pendingAdd: {
          text: selectedText || '',
          url: pageUrl || '',
          timestamp: Date.now(),
        },
      });

      await browser.action.openPopup();
    }
  });
});
