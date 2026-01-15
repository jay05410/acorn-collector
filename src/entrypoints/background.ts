export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.remove('add-to-acorn-collector').catch(() => {});
    chrome.contextMenus.create({
      id: 'add-to-acorn-collector',
      title: '도토리주머니에 담기',
      contexts: ['selection', 'page', 'link'],
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (
      info.menuItemId === 'add-to-acorn-collector' &&
      tab?.id &&
      tab?.windowId
    ) {
      const windowId = tab.windowId;
      const pageUrl = tab.url || '';

      chrome.sidePanel
        .open({ windowId })
        .then(() => {
          let text = info.selectionText || '';
          let url = info.linkUrl || pageUrl;
          let author: string | undefined;

          chrome.storage.local.get('lastContextTweet').then((stored) => {
            let imageUrls: string[] | undefined;

            if (stored.lastContextTweet) {
              const tweetInfo = stored.lastContextTweet as {
                text: string;
                url: string;
                author?: string;
                imageUrls?: string[];
              };

              if (!text && tweetInfo.text) {
                text = tweetInfo.text;
              }

              if (tweetInfo.url && tweetInfo.url !== pageUrl) {
                url = tweetInfo.url;
              }

              if (tweetInfo.author) {
                author = tweetInfo.author;
              }

              if (tweetInfo.imageUrls) {
                imageUrls = tweetInfo.imageUrls;
              }

              chrome.storage.local.remove('lastContextTweet');
            }

            const pendingData = {
              text,
              url,
              pageUrl,
              author,
              imageUrls,
              timestamp: Date.now(),
            };

            chrome.storage.local.set({ pendingAdd: pendingData });
          });
        })
        .catch((e) => {
          console.error('Failed to open side panel:', e);
        });
    }
  });
});
