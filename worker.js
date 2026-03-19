import { ProxyAlien, ProxyMode, BadgeConfig } from './proxyalien.js';

const proxyalien = new ProxyAlien();

const init = async () => {
  const setBadge = () => {
    const actualMode = proxyalien.proxySettings.mode;
    const fixedProxy = proxyalien.getEnabledFixedProxy();
    const unmanaged = proxyalien.options.badgeConfs[ProxyMode.UNMANAGED];
    const badgeConf = fixedProxy?.badgeConf
        || proxyalien.options.badgeConfs[actualMode]
        || unmanaged; // possible if out-of-sync and in FIXED_SERVERS mode

    if (proxyalien.isUnmanagedOrOutOfSync(actualMode)) {
      badgeConf.setText(unmanaged.text || badgeConf.text);
      badgeConf.setFg(unmanaged.fg);
      badgeConf.setBg(unmanaged.bg);
    }

    chrome.action.setBadgeText({ text: badgeConf.text });
    if (badgeConf.fg) chrome.action.setBadgeTextColor({ color: badgeConf.fg });
    if (badgeConf.bg) chrome.action.setBadgeBackgroundColor({ color: badgeConf.bg });

    self.dispatchEvent(new CustomEvent('badge', {
      detail: badgeConf.toObject()
    }));

    console.log('Set badge', badgeConf);
  };

  // We receive callbacks on both options changes and proxy
  // changes, often back to back. To avoid flicker of double
  // rendering, debounce for a short while.
  const debounceMs = 32;
  let debounceTimer = null;
  const debounceSetBadge = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(setBadge, debounceMs);
  };

  await proxyalien.loadOptions();
  await proxyalien.loadProxySettings();

  setBadge();

  proxyalien.listenForOptions(debounceSetBadge);
  proxyalien.listenForProxySettings(debounceSetBadge);
};

chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);
