const MENUS = [
  ['quote', '引用内容并提问'],
  ['translate', '翻译选中内容'],
  ['explain', '解释这段内容'],
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.removeAll(() => {
    for (const [id, title] of MENUS) chrome.contextMenus.create({ id, title, contexts: ['selection'] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || !info.selectionText) return;

  // sidePanel.open must be invoked synchronously from the context-menu user
  // gesture. Awaiting storage first makes Chrome discard the gesture token.
  const openPanel = chrome.sidePanel.open({ tabId: tab.id });
  const saveSelection = chrome.storage.session.set({
    pendingSelection: {
      text: info.selectionText,
      action: info.menuItemId,
      pageUrl: info.pageUrl || tab.url || '',
      tabTitle: tab.title || '',
      createdAt: Date.now(),
    },
  });

  Promise.all([openPanel, saveSelection]).catch((error) => {
    console.warn('Article Read could not open the side panel:', error);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'OPEN_KNOWLEDGE') {
    const query = new URLSearchParams({
      paperId: message.paperId || 'unknown',
      title: message.title || '未命名论文',
    });
    chrome.tabs.create({ url: chrome.runtime.getURL(`knowledge.html?${query}`) });
    sendResponse({ ok: true });
  }
});
