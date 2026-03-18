import { ProxyMan, ProxyMode, BadgeConfig } from './proxyman.js';

const proxyman = new ProxyMan();

const init = async () => {
  const setBadge = () => {
    const actualMode = proxyman.proxySettings.mode;
    const fixedProxy = proxyman.getEnabledFixedProxy();
    const unmanaged = proxyman.options.badgeConfs[ProxyMode.UNMANAGED];
    const badgeConf = fixedProxy?.badgeConf
        || proxyman.options.badgeConfs[actualMode]
        || unmanaged; // possible if out-of-sync and in FIXED_SERVERS mode

    if (proxyman.isUnmanagedOrOutOfSync(actualMode)) {
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

  await proxyman.loadOptions();
  await proxyman.loadProxySettings();

  setBadge();

  proxyman.listenForOptions(debounceSetBadge);
  proxyman.listenForProxySettings(debounceSetBadge);
};

chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);
