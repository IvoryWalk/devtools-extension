// Background Service Worker
// 点击扩展图标时打开新标签页
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});
