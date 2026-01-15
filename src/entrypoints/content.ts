interface ContentMessage {
  type: 'GET_SELECTION' | 'GET_PAGE_TEXT' | 'GET_TWEET_INFO';
}

interface TweetInfo {
  text: string;
  url: string;
  author?: string;
  imageUrls?: string[];
}

function findClosestTweet(element: Element | null): TweetInfo | null {
  if (!element) return null;

  const article = element.closest('article');
  if (!article) return null;

  const tweetText =
    article.querySelector('[data-testid="tweetText"]')?.textContent || '';

  const timeLink = article.querySelector('time')?.closest('a');
  const tweetUrl = timeLink?.href || window.location.href;

  const userNameContainer = article.querySelector('[data-testid="User-Name"]');
  let author = '';

  if (userNameContainer) {
    const links = userNameContainer.querySelectorAll('a');
    const displayName = links[0]?.textContent?.trim() || '';
    const handleLink = Array.from(links).find((a) =>
      a.textContent?.startsWith('@')
    );
    const handle = handleLink?.textContent?.trim() || '';

    if (displayName && handle) {
      author = `${displayName} ${handle}`;
    } else {
      author = displayName || handle;
    }
  }

  const imageUrls: string[] = [];
  const imageElements = article.querySelectorAll(
    'img[src*="pbs.twimg.com/media"]'
  );
  imageElements.forEach((img) => {
    const src = img.getAttribute('src');
    if (src) {
      const highResSrc = src.replace(/&name=\w+$/, '&name=large');
      if (!imageUrls.includes(highResSrc)) {
        imageUrls.push(highResSrc);
      }
    }
  });

  return {
    text: tweetText,
    url: tweetUrl,
    author,
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
  };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    chrome.runtime.onMessage.addListener(
      (
        message: ContentMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response: unknown) => void
      ) => {
        if (message.type === 'GET_SELECTION') {
          const selection = window.getSelection();
          const selectedText = selection?.toString() || '';

          let contextUrl = window.location.href;
          const focusNode = selection?.focusNode;
          if (focusNode) {
            const tweetInfo = findClosestTweet(
              focusNode.nodeType === Node.ELEMENT_NODE
                ? (focusNode as Element)
                : focusNode.parentElement
            );
            if (tweetInfo) {
              contextUrl = tweetInfo.url;
            }
          }

          sendResponse({ text: selectedText, url: contextUrl });
        }

        if (message.type === 'GET_PAGE_TEXT') {
          const pageText = document.body.innerText || '';
          sendResponse({ text: pageText, url: window.location.href });
        }

        if (message.type === 'GET_TWEET_INFO') {
          const activeElement = document.activeElement;
          const tweetInfo = findClosestTweet(activeElement);
          sendResponse(tweetInfo || { text: '', url: window.location.href });
        }

        return true;
      }
    );

    document.addEventListener('contextmenu', (e) => {
      const target = e.target as Element;
      const tweetInfo = findClosestTweet(target);

      if (tweetInfo) {
        chrome.storage.local.set({ lastContextTweet: tweetInfo });
      } else {
        chrome.storage.local.remove('lastContextTweet');
      }
    });
  },
});
