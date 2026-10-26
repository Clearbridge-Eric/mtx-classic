// Applies the page zoom the content script asks for. Firefox keeps zoom per site, so once it's set
// every MTX tab opens at that size. A zoom the tech picked themselves (anything other than 100%
// or our own value) is never overridden.

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== 'cbs-zoom' || !sender.tab) return;
  const tabId = sender.tab.id;
  const target = Number(message.zoom);
  if (!(target > 0.3 && target < 3)) return;

  return browser.tabs.getZoom(tabId).then((current) => {
    const isDefault = Math.abs(current - 1) < 0.001;
    const isOurs = Math.abs(current - target) < 0.001;
    if (message.on && isDefault) return browser.tabs.setZoom(tabId, target);
    if (!message.on && isOurs) return browser.tabs.setZoom(tabId, 1);
    return undefined;
  });
});
