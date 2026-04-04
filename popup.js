import { ProxyAlien, ProxyMode, Debounce } from './proxyalien.js';

const proxyalien = new ProxyAlien();

const render = () => {
  const o = proxyalien.options;
  const actualMode = proxyalien.proxySettings?.mode;

  const isFixedForeign = proxyalien.isFixedForeign();
  const isPacForeign = proxyalien.isPacForeign();
  const isForeign = proxyalien.isProxyForeign();

  // Render markup
  let html = '';
  html += `<ul class="${isForeign ? 'out_of_sync' : ''}">`;
  html += `<li class="action ${actualMode === ProxyMode.DIRECT ? 'current' : ''}"  data-mode="${ProxyMode.DIRECT}">Direct</li>`;
  html += `<li class="action ${actualMode === ProxyMode.PAC_SCRIPT ? 'current' : ''}" data-mode="${ProxyMode.PAC_SCRIPT}">Auto (PAC)</li>`;
  html += '<hr />'
  if (o.proxies.length > 0) {
    for (const proxy of o.proxies) {
      html += `<li class="action ${proxyalien.isFixedEnabled(proxy) ? 'current' : ''}" data-mode="${ProxyMode.FIXED_SERVERS}" data-proxy-name="${proxy.name}">${proxy.name}</li>`;
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
      proxyalien.options.setMode(
        mode,
        mode === ProxyMode.FIXED_SERVERS ? fixedServerName : null
      );

      // Save options and configure proxy settings
      await proxyalien.saveOptions();
      await proxyalien.configureProxy();

      // Re-render
      render();
    });
  });
};

await proxyalien.load();

render();

const debouncedRender = Debounce(render, 32);

chrome.proxy.settings.onChange.addListener((details) => {
  debouncedRender();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes?.options?.newValue) return;
  debouncedRender();
})
