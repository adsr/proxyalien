import {ProxyMan, ProxyMode} from './proxyman.js';

const render = () => {
  const o = proxyman.options;
  const actualMode = proxyman.proxySettings?.mode;

  const isFixedForeign = proxyman.isFixedForeign();
  const isPacForeign = proxyman.isPacForeign();
  const isForeign = proxyman.isProxyForeign();

  // Render markup
  let html = '';
  html += `<ul class="${isForeign ? 'out_of_sync' : ''}">`;
  html += `<li class="action ${actualMode === ProxyMode.DIRECT ? 'current' : ''}"  data-mode="${ProxyMode.DIRECT}">Direct</li>`;
  html += `<li class="action ${actualMode === ProxyMode.PAC_SCRIPT ? 'current' : ''}" data-mode="${ProxyMode.PAC_SCRIPT}">Auto (PAC)</li>`;
  html += '<hr />'
  if (o.proxies.length > 0) {
    for (const proxy of o.proxies) {
      html += `<li class="action ${proxyman.isFixedEnabled(proxy) ? 'current' : ''}" data-mode="${ProxyMode.FIXED_SERVERS}" data-proxy-name="${proxy.name}">${proxy.name}</li>`;
    }
  } else {
    html += `<li id="no-proxies">No proxies</li>`;
  }
  if (isFixedForeign) {
    html += `<li class="current">Other</li>`;
  }
  html += '<hr />'
  html += `<li class="action ${actualMode === ProxyMode.AUTO_DETECT ? 'current' : ''}" data-mode="${ProxyMode.AUTO_DETECT}">Auto-detect (WPAD)</li>`;
  html += `<li class="action ${actualMode === ProxyMode.SYSTEM ? 'current' : ''}" data-mode="${ProxyMode.SYSTEM}">System</li>`;
  html += '<hr />'
  html += `<li class="action ${o.mode === ProxyMode.UNMANAGED ? 'unmanaged' : ''}" data-mode="${ProxyMode.UNMANAGED}">Unmanaged</li>`;
  html += `<li class="action" id="options">Options</li>`;
  if (isForeign) {
    html += '<li id="out_of_sync">(*) out of sync</li>';
  }
  html += '</ul>';
  document.body.innerHTML = html;

  // Hook click events
  const self = this;
  document.querySelectorAll('li').forEach((li, i) => {
    li.addEventListener('click', async (e) => {
      const li = e.target;
      const fixedServerName = li.innerText;

      if (!li.classList.contains('action')) {
        // No action
        return;
      } else if (li.id === 'options') {
        // Open options
        chrome.runtime.openOptionsPage();
        return;
      }

      // Set mode
      const mode = li.dataset?.mode;
      proxyman.options.setMode(
        mode,
        mode === ProxyMode.FIXED_SERVERS ? fixedServerName : null
      );

      // Save options and configure proxy settings
      await proxyman.saveOptions();
      await proxyman.configureProxy();

      // Re-render
      render();
    });
  });
};

const proxyman = new ProxyMan();
await proxyman.loadOptions();
await proxyman.loadProxySettings();
proxyman.listenForProxySettings(render);
proxyman.listenForOptions(render);

render();
