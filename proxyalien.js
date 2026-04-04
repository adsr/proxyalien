export const ProxyMode = Object.freeze({
  DIRECT: 'direct',
  FIXED_SERVERS: 'fixed_servers',
  PAC_SCRIPT: 'pac_script',
  AUTO_DETECT: 'auto_detect',
  SYSTEM: 'system',
  UNMANAGED: 'unmanaged',
});

export const ProxyModeLabels = Object.freeze({
  [ProxyMode.DIRECT]: 'Direct',
  [ProxyMode.FIXED_SERVERS]: 'Fixed',
  [ProxyMode.PAC_SCRIPT]: 'Auto (PAC)',
  [ProxyMode.AUTO_DETECT]: 'Auto-detect (WPAD)',
  [ProxyMode.SYSTEM]: 'System',
  [ProxyMode.UNMANAGED]: 'Unmanaged',
});

export const ProxyScheme = Object.freeze({
  HTTP: 'http',
  HTTPS: 'https',
  SOCKS4: 'socks4',
  SOCSK5: 'socks5',
});

export const RuleType = Object.freeze({
  SHEXP: 'shexp',
  REGEX: 'regex',
  EXACT: 'exact',
});

export const RuleSubject = Object.freeze({
  URL: 'url',
  HOST: 'host',
});

export class ProxyServer {
  constructor() {
    this.scheme = ProxyScheme.HTTP;
    this.host = '';
    this.port = 0;
  }
  static fromObject(o) {
    const self = new this();
    self.setScheme(o.scheme);
    self.setHost(o.host);
    self.setPort(o.port);
    return self;
  }
  toObject() {
    return Object.assign({}, this);
  }
  getPort() {
    if (this.port) return this.port;
    switch (this.scheme) {
      case ProxyScheme.HTTP: return 80;
      case ProxyScheme.HTTPS: return 443;
      case ProxyScheme.SOCKS4:
      case ProxyScheme.SOCSK5: return 1080;
    }
    return -1;
  }
  equals(other) {
    return this.scheme === other.scheme
        && this.host === other.host
        && this.getPort() === other.getPort();
  }
  setHost(v) {
    this.host = toString(v);
  }
  setPort(v) {
    this.port = parseInt(toString(v), 10);
  }
  setScheme(v) {
    this.scheme = toEnum(ProxyScheme, v)
  }
  isValid() {
    return this.host.length >= 1
        && (!this.port || (this.port >= 1 && this.port <= 65535));
  }
  toProxyLine() {
    return `${this.scheme.toUpperCase()} ${this.host}:${this.getPort()}`;
  }
}

export class ProxyConfig {
  constructor() {
    this.name = '';
    this.badgeConf = new BadgeConfig('');
    this.server = new ProxyServer();
  }
  static fromObject(o) {
    const self = new this();
    self.setName(o.name);
    self.badgeConf = BadgeConfig.fromObject(o.badgeConf);
    self.server = ProxyServer.fromObject(o.server);
    return self;
  }
  setName(v) {
    this.name = toString(v);
  }
  isValid() {
    return this.name.length >= 1
        && this.name !== ProxyMode.DIRECT
        && this.server.isValid();
  }
  clone() {
    return this.constructor.fromObject(this);
  }
}

export class Rule {
  constructor() {
    this.type = RuleType.SHEXP;
    this.subject = RuleSubject.URL;
    this.pattern = '';
    this.proxyName = ProxyMode.DIRECT;
  }
  static fromObject(o) {
    const self = new this();
    self.setType(o.type);
    self.setSubject(o.subject);
    self.setPattern(o.pattern);
    self.setProxyName(o.proxyName);
    return self;
  }
  setType(v) {
    this.type = toEnum(RuleType, v);
  }
  setSubject(v) {
    this.subject = toEnum(RuleSubject, v);
  }
  setPattern(v) {
    this.pattern = toString(v);
  }
  setProxyName(v) {
    this.proxyName = toString(v);
  }
  isValid(proxyalien) {
    return this.pattern.length >= 1
      && (this.proxyName === ProxyMode.DIRECT
      || proxyalien.getProxyByName(this.proxyName));
  }
  clone() {
    return this.constructor.fromObject(this);
  }
}

export class BadgeConfig {
  constructor(s) {
    this.setText(s);
    this.setFg('#ffffff');
    this.setBg('#000000');
  }
  static fromObject(o) {
    const self = new this();
    if (o) {
      self.setText(o.text);
      self.setFg(o.fg);
      self.setBg(o.bg);
    }
    return self;
  }
  setText(s) {
    this.text = toString(s);
  }
  setFg(c) {
    this.fg = toColor(c);
  }
  setBg(c) {
    this.bg = toColor(c);
  }
  toObject() {
    return Object.assign({}, this);
  }
  clone() {
    return this.constructor.fromObject(this);
  }
}

export class Options {
  constructor() {
    this.mode = ProxyMode.UNMANAGED;
    this.fixedProxyName = null;
    this.proxies = [];
    this.autoDefault = ProxyMode.DIRECT;
    this.autoRules = [];
    const badgeDefaults = {
      [ProxyMode.DIRECT]: '',
      [ProxyMode.PAC_SCRIPT]: 'auto',
      [ProxyMode.AUTO_DETECT]: 'auto',
      [ProxyMode.SYSTEM]: 'sys',
      [ProxyMode.UNMANAGED]: '!',
    };
    this.badgeConfs = Object.fromEntries(Object.keys(badgeDefaults).map(
      (badgeType) => [badgeType, new BadgeConfig(badgeDefaults[badgeType])]
    ));
  }
  static fromObject(o) {
    const self = new this();
    self.mode = toEnum(ProxyMode, o.mode);
    self.fixedProxyName = toString(o.fixedProxyName);
    self.proxies = toArray(o.proxies).map(p => {
      return ProxyConfig.fromObject(p);
    });
    self.autoDefault = toString(o.autoDefault);
    self.autoRules = toArray(o.autoRules).map(r => {
      return Rule.fromObject(r);
    });
    for (const [badgeType, badgeConf] of Object.entries(self.badgeConfs)) {
      if (o.badgeConfs?.[badgeType]) {
        self.badgeConfs[badgeType] = BadgeConfig.fromObject(o.badgeConfs[badgeType]);
      }
    }
    return self;
  }
  toObject() {
    return JSON.parse(JSON.stringify(this));
  }
  getAutoProxyMap() {
    const m = {};
    for (const proxy of this.proxies) {
      m[proxy.name] = proxy.server.toProxyLine();
    }
    return m;
  }
  getAutoDefaultRule() {
    for (const proxy of this.proxies) {
      if (proxy.name === this.autoDefault) {
        return proxy.server.toProxyLine();
      }
    }
    return 'DIRECT';
  }
  setMode(mode, fixedServerName) {
    this.mode = toEnum(ProxyMode, mode);
    this.fixedProxyName = this.mode === ProxyMode.FIXED_SERVERS
      ? toString(fixedServerName)
      : null;
  }
  setAutoDefault(v) {
    this.autoDefault = toString(v);
  }
}

export class ProxyAlien {
  constructor() {
    this.options = new Options();
    this.proxySettings = {};
    this.pacSentinel = 'https://github.com/adsr/proxyalien';
  }
  async load() {
    await Promise.all([this.loadOptions(), this.loadProxySettings()]);
  }
  async loadOptions() {
    const r = await chrome.storage.sync.get(['options']);
    if (!r || typeof r.options !== 'object' || Object.keys(r.options).length <= 0) return;
    this.setOptions(r.options);
    console.log('Loaded options', this.options);
  }
  async loadProxySettings() {
    const details = await chrome.proxy.settings.get({ incognito: false });
    this.proxySettings = details.value;
    console.log('Loaded proxy settings', this.proxySettings);
  }
  setOptions(o) {
    this.options = Options.fromObject(o);
  }
  async saveOptions() {
    const saveObj = this.options.toObject();
    await chrome.storage.sync.set({ options: saveObj });
    chrome.runtime.sendMessage({ type: 'updateBadge' });
    console.log('Saved options', saveObj);
  }
  async configureProxy() {
    const settings = {};
    const o = this.options;
    const mode = o.mode;
    console.log('configureProxy options', o);
    switch (mode) {
      case ProxyMode.DIRECT:
      case ProxyMode.AUTO_DETECT:
      case ProxyMode.SYSTEM:
        settings.mode = mode;
        break;
      case ProxyMode.PAC_SCRIPT:
        settings.mode = mode;
        settings.pacScript = { data: this.generatePacScript() };
        break;
      case ProxyMode.FIXED_SERVERS:
        settings.mode = mode;
        const proxy = this.getProxyByName(o.fixedProxyName);
        if (!proxy) return;
        settings.rules = { singleProxy: proxy.server.toObject() };
        break;
      case ProxyMode.UNMANAGED:
        await chrome.proxy.settings.clear({ scope: 'regular' });
        console.log('Cleared proxy settings');
        return;
    }
    await chrome.proxy.settings.set({ value: settings, scope: 'regular' });
    chrome.runtime.sendMessage({ type: 'updateBadge' });
    console.log('Set proxy settings', settings);
    await this.loadProxySettings();
  }
  generatePacScript() {
    const autoRulesJson = JSON.stringify(this.options.autoRules);
    const autoDefaultJson = JSON.stringify(this.options.getAutoDefaultRule());
    const proxyMapJson = JSON.stringify(this.options.getAutoProxyMap());
    const constsJson = JSON.stringify(Object.assign(
      {}, ProxyMode, RuleType, RuleSubject
    ));
    const code = `
      // ${this.pacSentinel}
      function FindProxyForURL(url, host) {
        const autoRules = ${autoRulesJson};
        const autoDefault = ${autoDefaultJson};
        const proxyMap = ${proxyMapJson};
        const consts = ${constsJson};
        const log = (s) => console.log(s);
        let i = 0;
        for (const rule of autoRules) {
          let subject = null;
          switch (rule.subject) {
            default:
            case consts.URL: subject = url; break;
            case consts.HOST: subject = host; break;
          }
          log(\`Checking \${rule.type}=\${rule.pattern} against subject=\${subject}\`);
          let matched = false;
          try {
            switch (rule.type) {
              case consts.SHEXP: matched = shExpMatch(subject, rule.pattern); break;
              case consts.REGEX: matched = (new RegExp(rule.pattern)).test(subject); break;
              case consts.EXACT: matched = rule.pattern === subject; break;
            }
          } catch (e) {
            log(\`Caught exception while evaluating rule \${i}:\`, e);
          }
          if (matched) {
            log(\`Rule \${i} (\${rule.proxyName}) matched\`);
            if (rule.proxyName === consts.DIRECT) {
              return 'DIRECT';
            } else if (proxyMap[rule.proxyName]) {
              log(\`Returning \${proxyMap[rule.proxyName]}\`);
              return proxyMap[rule.proxyName];
            } else {
              log(\`No proxy named \${rule.proxyName}; using DIRECT\`);
              return 'DIRECT';
            }
          }
          i += 1;
        }
        log(\`Returning default rule: \${autoDefault}\`);
        return autoDefault;
      }
    `;
    console.log(code);
    return code;
  }
  setBadge() {
    const actualMode = this.proxySettings.mode;
    const fixedProxy = this.getEnabledFixedProxy();
    const unmanaged = this.options.badgeConfs[ProxyMode.UNMANAGED];
    const badgeConf = fixedProxy?.badgeConf
        || this.options.badgeConfs[actualMode]
        || unmanaged; // possible if out-of-sync and in FIXED_SERVERS mode

    if (this.isUnmanagedOrOutOfSync(actualMode)) {
      badgeConf.setText(unmanaged.text || badgeConf.text);
      badgeConf.setFg(unmanaged.fg);
      badgeConf.setBg(unmanaged.bg);
    }

    chrome.action.setBadgeText({ text: badgeConf.text });
    if (badgeConf.fg) chrome.action.setBadgeTextColor({ color: badgeConf.fg });
    if (badgeConf.bg) chrome.action.setBadgeBackgroundColor({ color: badgeConf.bg });

    console.log('Set badge', badgeConf);
    return badgeConf;
  }
  getProxyByName(name) {
    for (const proxy of (this.options?.proxies || [])) {
      if (proxy.name === name) {
        return proxy;
      }
    }
    return null;
  }
  isProxyForeign() {
    return this.isFixedForeign() || this.isPacForeign();
  }
  isPacForeign() {
    const c = this.proxySettings;
    return c?.mode === ProxyMode.PAC_SCRIPT
      && !c?.pacScript?.data?.includes(this.pacSentinel);
  }
  isFixedForeign() {
    const o = this.options;
    const c = this.proxySettings;
    if (c?.mode !== ProxyMode.FIXED_SERVERS) {
      return false;
    }
    for (const proxy of this.options.proxies) {
      if (this.isFixedEnabled(proxy)) {
        return false;
      }
    }
    return true;
  }
  isFixedEnabled(proxy) {
    const c = this.proxySettings;
    if (c.mode !== ProxyMode.FIXED_SERVERS) return false;
    const tmp = ProxyServer.fromObject(c?.rules?.singleProxy || {});
    return proxy.server.equals(tmp);
  }
  getEnabledFixedProxy() {
    const c = this.proxySettings;
    for (const proxy of this.options.proxies) {
      if (this.isFixedEnabled(proxy)) return proxy;
    }
    return null;
  }
  isUnmanagedOrOutOfSync(actualMode) {
    return actualMode !== this.options.mode || this.isProxyForeign();
  }
}

export const Debounce = (fn, millis) => {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, millis);
  };
};

const toEnum = (ec, value) => {
  for (const v of Object.values(ec)) {
    if (value === v) return v;
  }
  return Object.values(ec)[0];
};

const toString = (v) => {
  if (!v) return '';
  return v.toString();
};

const toStringOrNull = (v) => {
  if (v === null) return v;
  return toString(v);
};

const toArray = (v) => {
  if (Array.isArray(v)) return v;
  return [];
};

const toColor = (v) => {
  const s = toString(v);
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  return '';
};
