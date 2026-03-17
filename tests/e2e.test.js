import assert        from 'node:assert';
import child_process from "node:child_process";
import http          from 'node:http';
import path          from 'node:path';
import process       from 'node:process';
import test          from 'node:test';
import url           from 'node:url';
import util          from 'node:util';

import puppeteer     from 'puppeteer';
import socks         from 'simple-socks';

await (new class {
  constructor() {
    this.config = Object.freeze({
      WEB_SERVER_IP:      '11.0.0.1',
      WEB_SERVER_PORT:    8080,
      WEB_BASE_URL:       'http://11.0.0.1:8080',
      SOCKS_SERVER1_IP:   '11.0.0.2',
      SOCKS_SERVER1_PORT: 1080,
      SOCKS_SERVER2_IP:   '11.0.0.3',
      SOCKS_SERVER2_PORT: 1081,
    });
    this.webServer = null;
    this.socksServer1 = null;
    this.socksServer2 = null;
    this.browser = null;
    this.worker = null;
    this.page = null;
    this.popup = null;
    this.options = null;
    this.socksConns = [];
  }
  async run() {
    test.suite('ProxyMan', () => {
      test.before(() => this.manageIps(true));
      test.before(async () => await this.startServers());
      test.before(async () => await this.startBrowser());
      test.after(async () => await this.closeBrowser());
      test.after(async () => await this.closeServers());
      test.after(() => this.manageIps(false));

      // test.after(() => {
      //   setInterval(() => {
      //     console.log(
      //       `process._getActiveRequests().length=${process._getActiveHandles().length}`,
      //       process._getActiveRequests()
      //     );
      //   }, 5000);
      // });

      test.test('manages proxies', async () => {
        const o = await this.openOptions();
        assert.ok(o);

        let proxies;

        await this.addProxy(o, 'proxy1', 'p1', '#000001', '#ffffff', this.config.SOCKS_SERVER1_IP, this.config.SOCKS_SERVER1_PORT);
        await this.addProxy(o, 'proxy2', 'p2', '#000002', '#ffffff', this.config.SOCKS_SERVER2_IP, this.config.SOCKS_SERVER2_PORT);
        await this.addProxy(o, 'bogus',  'bo', '#000003', '#ffffff', 'fake', 4200);
        proxies = await this.getProxies(o);
        assert.equal(proxies.length, 3);

        await this.deleteProxy(o, 'bogus');
        proxies = await this.getProxies(o);
        assert.equal(proxies.length, 2);

        await this.saveProxies(o);
        await this.addProxy(o, 'bogus', 'bo', '#000003', '#ffffff', 'fake', 4200);
        await this.revertProxies(o);
        proxies = await this.getProxies(o);
        assert.equal(proxies.length, 2);

        await o.close();
      });

      test.test('manages PAC rules', async () => {
        const o = await this.openOptions();
        assert.ok(o);

        let ruleCount = 0;
        for (const patternType of ['shexp', 'regex', 'exact']) {
          for (const subject of ['url', 'host']) {
            for (const proxyName of ['proxy1', 'proxy2', 'direct']) {
              await this.addPacRule(o, `patt${ruleCount}`, patternType, subject, proxyName);
              ++ruleCount;
            }
          }
        }

        let rules;

        rules = await this.getPacRules(o);
        assert.equal(rules.length, ruleCount);

        await this.deletePacRule(o, ruleCount - 1);
        --ruleCount;

        rules = await this.getPacRules(o);
        assert.equal(rules.length, ruleCount);

        await this.movePacRuleDown(o, 0);
        rules = await this.getPacRules(o);
        assert.equal(rules[0].pattern, 'patt1');
        assert.equal(rules[1].pattern, 'patt0');

        await this.savePacRules(o);
        await this.addPacRule(o, 'bogus', 'exact', 'host', 'direct');
        await this.revertPacRules(o);

        rules = await this.getPacRules(o);
        assert.equal(rules.length, ruleCount);

        for (let i = 0; i < ruleCount; i++) {
          await this.deletePacRule(o, 0);
        }

        await this.addPacRule(o, `${this.config.WEB_BASE_URL}/direct_exact`, 'exact', 'url', 'direct');
        await this.addPacRule(o, `^${this.config.WEB_BASE_URL}/proxy1_regex/`, 'regex', 'url', 'proxy1');
        await this.addPacRule(o, '*/proxy2_shexp/*', 'shexp', 'url', 'proxy2');
        await this.savePacRules(o);

        rules = await this.getPacRules(o);
        assert.equal(rules.length, 3);

        await o.close();
      });

      test.test('manages badge defaults', async () => {
        const o = await this.openOptions();
        assert.ok(o);

        await this.setBadgeDefault(o, 'direct',      'dir', '#000004', '#ffffff');
        await this.setBadgeDefault(o, 'pac_script',  'pac', '#000005', '#ffffff');
        await this.setBadgeDefault(o, 'auto_detect', 'aut', '#000006', '#ffffff');
        await this.setBadgeDefault(o, 'system',      'sys', '#000007', '#ffffff');
        await this.setBadgeDefault(o, 'unmanaged',   'unm', '#000008', '#ffffff');

        let badges;

        badges = await this.getBadgeDefaults(o);
        assert.equal(badges.length, 5);

        await this.saveBadgeDefaults(o);

        await this.setBadgeDefault(o, 'direct', 'bogus', 'bogus', 'bogus');
        badges = await this.getBadgeDefaults(o);
        assert.equal(badges[0].badge, 'bogus');

        await this.revertBadgeDefaults(o);

        badges = await this.getBadgeDefaults(o);
        assert.equal(badges[0].badge, 'dir');

        await o.close();
      });

      test.test('stores config', async () => {
        const expectedConfig = {
          "autoDefault": "direct",
          "autoRules": [
            {
              "pattern": `${this.config.WEB_BASE_URL}/direct_exact`,
              "proxyName": "direct",
              "subject": "url",
              "type": "exact"
            },
            {
              "pattern": `^${this.config.WEB_BASE_URL}/proxy1_regex/`,
              "proxyName": "proxy1",
              "subject": "url",
              "type": "regex"
            },
            {
              "pattern": "*/proxy2_shexp/*",
              "proxyName": "proxy2",
              "subject": "url",
              "type": "shexp"
            }
          ],
          "badgeConfs": {
            "auto_detect": {
              "bg": "#ffffff",
              "fg": "#000006",
              "text": "aut"
            },
            "direct": {
              "bg": "#ffffff",
              "fg": "#000004",
              "text": "dir"
            },
            "pac_script": {
              "bg": "#ffffff",
              "fg": "#000005",
              "text": "pac"
            },
            "system": {
              "bg": "#ffffff",
              "fg": "#000007",
              "text": "sys"
            },
            "unmanaged": {
              "bg": "#ffffff",
              "fg": "#000008",
              "text": "unm"
            }
          },
          "fixedProxyName": "",
          "mode": "unmanaged",
          "proxies": [
            {
              "badgeConf": {
                "bg": "#ffffff",
                "fg": "#000001",
                "text": "p1"
              },
              "name": "proxy1",
              "server": {
                "host": this.config.SOCKS_SERVER1_IP,
                "port": this.config.SOCKS_SERVER1_PORT,
                "scheme": "socks5"
              }
            },
            {
              "badgeConf": {
                "bg": "#ffffff",
                "fg": "#000002",
                "text": "p2"
              },
              "name": "proxy2",
              "server": {
                "host": this.config.SOCKS_SERVER2_IP,
                "port": this.config.SOCKS_SERVER2_PORT,
                "scheme": "socks5"
              }
            }
          ]
        };
        const actualConfig = await this.getStoredConfig();
        assert.deepStrictEqual(actualConfig, expectedConfig);
      });

      test.test('supports fixed_servers', async () => {
        const popup = await this.openPopup();
        assert.ok(popup);

        await this.setProxyMode(popup, 'direct');
        await this.assertProxy(`${this.config.WEB_BASE_URL}/test`, `remote=${this.config.WEB_SERVER_IP}`, 'direct');

        await this.setFixedProxy(popup, 'proxy1');
        await this.assertProxy(`${this.config.WEB_BASE_URL}/test`, `remote=${this.config.SOCKS_SERVER1_IP}`, 'proxy1');

        await this.setFixedProxy(popup, 'proxy2');
        await this.assertProxy(`${this.config.WEB_BASE_URL}/test`, `remote=${this.config.SOCKS_SERVER2_IP}`, 'proxy2');

        await popup.close();
      });

      test.test('supports pac_script', async () => {
        const popup = await this.openPopup();
        assert.ok(popup);

        await this.setProxyMode(popup, 'pac_script');
        await this.assertProxy(`${this.config.WEB_BASE_URL}/direct_exact`, `remote=${this.config.WEB_SERVER_IP}`);
        await this.assertProxy(`${this.config.WEB_BASE_URL}/proxy1_regex/anything`, `remote=${this.config.SOCKS_SERVER1_IP}`);
        await this.assertProxy(`${this.config.WEB_BASE_URL}/proxy2_shexp/anything`, `remote=${this.config.SOCKS_SERVER2_IP}`);

        await this.setProxyMode(popup, 'direct');

        await popup.close();
      });
    });
  }
  async addProxy(o, name, badge, fg, bg, host, port) {
    const index = await o.$$eval('input.proxy-name', inputs => inputs.length);
    await o.click('button.proxy-add');
    await o.waitForSelector(`input.proxy-name[data-index="${index}"]`);

    await o.type(`input.proxy-name[data-index="${index}"]`, name);
    await o.type(`input.proxy-badge-text[data-index="${index}"]`, badge);

    await o.$eval(`input.proxy-badge-fg[data-index="${index}"]`, this.changeInputValue, fg);
    await o.$eval(`input.proxy-badge-bg[data-index="${index}"]`, this.changeInputValue, bg);

    await o.select(`select.proxy-scheme[data-index="${index}"]`, 'socks5');
    await o.type(`input.proxy-host[data-index="${index}"]`, host);
    await o.type(`input.proxy-port[data-index="${index}"]`, `${port}`);
  }
  async deleteProxy(o, name) {
    const proxy = await this.getProxy(o, name);
    if (!proxy) throw new Error(`proxy ${name} not found`);
    await o.click(`button.proxy-delete[data-index="${proxy.index}"]`);
  }
  async saveProxies(o) {
    await o.click('button.proxy-save');
  }
  async revertProxies(o) {
    await o.click('button.proxy-revert');
  }
  async getProxy(o, name) {
    const proxies = await this.getProxies(o);
    return proxies.filter(p => p.name === name).shift();
  }
  async getProxies(o) {
    return await o.$$eval('input.proxy-name', inputs => {
      return inputs.map(input => {
        return {
          name: input.value,
          index: input.dataset.index,
        };
      });
    });
  }
  async addPacRule(o, pattern, patternType, subject, proxyName) {
    const index = await o.$$eval('input.rule-pattern', inputs => inputs.length);
    await o.click('button.rule-add');
    await o.waitForSelector(`input.rule-pattern[data-index="${index}"]`);

    await o.type(`input.rule-pattern[data-index="${index}"]`, pattern);
    await o.select(`select.rule-type[data-index="${index}"]`, patternType);
    await o.select(`select.rule-subject[data-index="${index}"]`, subject);
    await o.select(`select.rule-proxy[data-index="${index}"]`, proxyName);
  }
  async deletePacRule(o, index) {
    await o.click(`button.rule-delete[data-index="${index}"]`);
  }
  async movePacRuleUp(o, index) {
    await o.click(`button.rule-up[data-index="${index}"]`);
  }
  async movePacRuleDown(o, index) {
    await o.click(`button.rule-down[data-index="${index}"]`);
  }
  async revertPacRules(o) {
    await o.click('button.rule-revert');
  }
  async savePacRules(o) {
    await o.click('button.rule-save');
  }
  async getPacRules(o) {
    return await o.$$eval('input.rule-pattern', inputs => {
      return inputs.map(input => {
        const index = input.dataset.index;
        return {
          pattern: input.value,
          patternType: document.querySelector(`select.rule-type[data-index="${index}"]`).value,
          subject: document.querySelector(`select.rule-subject[data-index="${index}"]`).value,
          proxyName: document.querySelector(`select.rule-proxy[data-index="${index}"]`).value,
        };
      });
    });
  }
  async setBadgeDefault(o, badgeType, badge, fg, bg) {
    // `$eval` does not trigger events, `type` appends
    // Have to clear default value first
    await o.focus(`input.badge-conf-text[data-index="${badgeType}"]`);
    await o.keyboard.down('Control');
    await o.keyboard.press('A');
    await o.keyboard.up('Control');
    await o.keyboard.type(badge);

    await o.$eval(`input.badge-conf-fg[data-index="${badgeType}"]`, this.changeInputValue, fg);
    await o.$eval(`input.badge-conf-bg[data-index="${badgeType}"]`, this.changeInputValue, bg);
  }
  changeInputValue(el, val) {
    el.value = val;
    el.dispatchEvent(new Event('input'));
  }
  async saveBadgeDefaults(o) {
    await o.click('button.badge-conf-save');
  }
  async revertBadgeDefaults(o) {
    await o.click('button.badge-conf-revert');
  }
  async getBadgeDefaults(o) {
    return await o.$$eval('input.badge-conf-text', inputs => {
      return inputs.map(input => {
        const index = input.dataset.index;
        return {
          badgeType: index,
          badge: document.querySelector(`input.badge-conf-text[data-index="${index}"]`).value,
          fg: document.querySelector(`input.badge-conf-fg[data-index="${index}"]`).value,
          bg: document.querySelector(`input.badge-conf-bg[data-index="${index}"]`).value,
        };
      });
    });
  }
  async setFixedProxy(popup, proxyName) {
    await popup.click(`li[data-proxy-name="${proxyName}"]`);
    await this.sleep(1000); // TODO
    const cfg = await this.getStoredConfig();
    assert.equal(cfg.mode, 'fixed_servers');
    assert.equal(cfg.fixedProxyName, proxyName);
  }
  async setProxyMode(popup, mode) {
    await popup.click(`li[data-mode="${mode}"]`);
    await this.sleep(1000); // TODO
    const cfg = await this.getStoredConfig();
    assert.equal(cfg.mode, mode);
  }
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  async assertProxy(url, expected, msg) {
    const page = await this.browser.newPage();
    assert.ok(page);

    await page.goto(url);
    const actual = await page.evaluate(() => document.body.textContent);
    await page.close();

    assert.equal(actual, expected, msg);
  }
  async openPopup() {
    const extensionId = await this.worker.evaluate('chrome.runtime.id')
    const popup = await this.browser.newPage();
    assert.ok(popup);
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForSelector('li.action');
    return popup;
  }
  async getStoredConfig() {
    return await this.worker.evaluate(() => {
      return new Promise(resolve => {
        chrome.storage.sync.get(['options'], o => {
          resolve(o ? o.options : {});
        });
      });
    });
  }
  async openOptions() {
    await this.worker.evaluate('chrome.runtime.openOptionsPage();');
    const optionsTarget = await this.browser.waitForTarget(
      target => target.type() === 'page' && target.url().endsWith('options.html'),
    );
    return await optionsTarget.asPage();
  }
  manageIps(create) {
    const ips = [
      this.config.WEB_SERVER_IP,
      this.config.SOCKS_SERVER1_IP,
      this.config.SOCKS_SERVER2_IP,
    ];
    for (const ip of ips) {
      child_process.execSync(`sudo ip addr ${create ? 'add' : 'del'} ${ip}/32 dev lo`, { stdio: 'inherit' });
    }
  }
  async startServers() {
    this.webServer = await this.startWebServer(this.config.WEB_SERVER_IP, this.config.WEB_SERVER_PORT);
    this.socksServer1 = await this.startSocksServer(this.config.SOCKS_SERVER1_IP, this.config.SOCKS_SERVER1_PORT);
    this.socksServer2 = await this.startSocksServer(this.config.SOCKS_SERVER2_IP, this.config.SOCKS_SERVER2_PORT);
  }
  async closeServers() {
    if (this.webServer) {
      this.webServer.close();
      this.webServer.closeAllConnections();
    }
    if (this.socksServer1) this.socksServer1.close();
    if (this.socksServer2) this.socksServer2.close();
  }
  async startBrowser() {
    this.browser = await puppeteer.launch({
      pipe: true,
      dumpio: true,
      enableExtensions: [ this.getExtensionPath() ],
      args: [
        '--no-sandbox',
        '--log-level=3',
      ],
    });
    const workerTarget = await this.browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().endsWith('worker.js')
    );
    this.worker = await workerTarget.worker();
  }
  async closeBrowser() {
    if (this.worker) await this.worker.close();
    if (this.browser) await this.browser.close();
  }
  getExtensionPath() {
    const dir = path.dirname(url.fileURLToPath(import.meta.url));
    return path.resolve(dir, '..');
  }
  async startWebServer(ip, port) {
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        const host = req.headers.host || 'unknown';
        const remote = req.socket.remoteAddress;
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end(`remote=${remote}`);
      });
      server.listen(port, ip, () => {
        console.log(`web server listening on ${ip}:${port}`);
        resolve(server);
      });
    });
  }
  async startSocksServer(ip, port) {
    return new Promise((resolve) => {
      const server = socks.createServer({
        connTimeout: 5000,
        localAddress: ip,
      });
      server.listen({ exclusive: true, ip, port }, () => {
        console.log(`socks server listening on ${ip}:${port}`);
        resolve(server);
      });
    });
  }
}).run();
