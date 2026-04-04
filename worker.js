import { ProxyAlien, Debounce } from './proxyalien.js';

const setBadge = async () => {
  const proxyalien = new ProxyAlien();
  await proxyalien.load();
  const badgeConf = proxyalien.setBadge();
  self.dispatchEvent(new CustomEvent('badge', {
    detail: badgeConf.toObject()
  }));
};

const debouncedSetBadge = Debounce(setBadge, 32);

chrome.proxy.settings.onChange.addListener(debouncedSetBadge);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes?.options?.newValue) return;
  debouncedSetBadge();
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'updateBadge') return;
  debouncedSetBadge();
});

chrome.runtime.onStartup.addListener(debouncedSetBadge);
chrome.runtime.onInstalled.addListener(debouncedSetBadge);
