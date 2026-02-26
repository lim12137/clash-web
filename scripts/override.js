// === AUTO-SUB-SETS:START ===
// 自动生成区块：请在管理面板的“订阅集合”里维护，不建议手工改这里。
const SUB_SET1 = [
  {
    "name": "A",
    "url": "https://example.com/subscription-a.yaml"
  },
  {
    "name": "B",
    "url": "https://example.com/subscription-b.yaml"
  }
];
const SUB_SET2 = [
  {
    "name": "a",
    "url": "https://example.com/subscription-c.yaml"
  },
  {
    "name": "b",
    "url": "https://example.com/subscription-d.yaml"
  }
];
const US_AUTO_PRIORITY = {
  "priority1": "",
  "priority2": ""
};
const US_AUTO_PRIORITY1 = String(US_AUTO_PRIORITY.priority1 || "").trim();
const US_AUTO_PRIORITY2 = String(US_AUTO_PRIORITY.priority2 || "").trim();
const SUB_SET1_URLS = SUB_SET1.map((x) => x.url).filter(Boolean);
const SUB_SET2_URLS = SUB_SET2.map((x) => x.url).filter(Boolean);
// === AUTO-SUB-SETS:END ===

// ==================== 过滤器 ====================
// 付费集合中用于 Google/YouTube 的美国优选节点过滤器
const US_FILTER =
  "(?i)(\\bUS\\b|\\bUSA\\b|United\\s*States|UnitedStates|America|美国|美國|美西|美东|洛杉矶|圣何塞|硅谷|西雅图|达拉斯|芝加哥|纽约|华盛顿|🇺🇸)";

// ==================== 工具函数 ====================
function safeProviderName(raw, fallback) {
  const base = String(raw || fallback || "Sub").trim();
  return base.replace(/[^A-Za-z0-9_-]/g, "_");
}

function escapeRegexLiteral(raw) {
  return String(raw || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertGroup(groups, groupObj) {
  const idx = groups.findIndex((g) => g && g.name === groupObj.name);
  if (idx >= 0) groups[idx] = groupObj;
  else groups.push(groupObj);
}

function setRules(config, rules) {
  // 完全替换规则列表，避免和历史规则冲突
  config.rules = rules;
}

function buildProvidersFromSet(config, setItems, fallbackPrefix, suffixTag) {
  const names = [];
  setItems.forEach((item, idx) => {
    if (!item?.url) return;
    const providerName = safeProviderName(item.name, `${fallbackPrefix}_${idx + 1}`);
    names.push(providerName);
    config["proxy-providers"][providerName] = {
      type: "http",
      url: item.url,
      interval: 86400,
      "health-check": {
        enable: true,
        url: "https://www.gstatic.com/generate_204",
        interval: 300,
      },
      override: { "additional-suffix": ` @${suffixTag}` },
    };
  });
  return names;
}

function addUsPriorityGroup(groups, groupName, providerNames, nameKeyword) {
  const keyword = String(nameKeyword || "").trim();
  if (!keyword) return false;
  upsertGroup(groups, {
    name: groupName,
    type: "url-test",
    use: providerNames,
    filter: `(?i)${escapeRegexLiteral(keyword)}`,
    url: "https://www.gstatic.com/generate_204",
    interval: 300,
    tolerance: 50,
  });
  return true;
}

// ==================== 主函数 ====================
const main = (config) => {
  config ??= {};
  config.mode = "rule";

  // 由脚本接管，避免旧配置残留
  config["proxy-providers"] = {};
  config["rule-providers"] = {};
  config["proxy-groups"] = [];
  config.rules = [];

  // 集合1(付费) / 集合2(免费) -> provider 名称数组
  const set1ProviderNames = buildProvidersFromSet(config, SUB_SET1, "Paid", "PAID");
  const set2ProviderNames = buildProvidersFromSet(config, SUB_SET2, "Free", "FREE");

  // 对外暴露变量，便于后续脚本段直接使用
  const PAID_PROVIDERS = set1ProviderNames;
  const FREE_PROVIDERS = set2ProviderNames;

  // ==================== 规则提供者（GEOSITE / GEOIP）====================
  config["rule-providers"]["geosite-google"] = {
    type: "http",
    behavior: "domain",
    url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/google.yaml",
    path: "./ruleset/geosite-google.yaml",
    interval: 86400,
  };
  config["rule-providers"]["geosite-youtube"] = {
    type: "http",
    behavior: "domain",
    url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/youtube.yaml",
    path: "./ruleset/geosite-youtube.yaml",
    interval: 86400,
  };
  config["rule-providers"]["geosite-gfw"] = {
    type: "http",
    behavior: "domain",
    url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/gfw.yaml",
    path: "./ruleset/geosite-gfw.yaml",
    interval: 86400,
  };
  config["rule-providers"]["geosite-cn"] = {
    type: "http",
    behavior: "domain",
    url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/cn.yaml",
    path: "./ruleset/geosite-cn.yaml",
    interval: 86400,
  };
  config["rule-providers"]["geoip-private"] = {
    type: "http",
    behavior: "ipcidr",
    url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/private.yaml",
    path: "./ruleset/geoip-private.yaml",
    interval: 86400,
  };

  // ==================== 代理组 ====================
  const groups = config["proxy-groups"];

  // 美国自动测速池（最终回退）
  upsertGroup(groups, {
    name: "US-Auto-Speedtest",
    type: "url-test",
    use: PAID_PROVIDERS,
    filter: US_FILTER,
    url: "https://www.gstatic.com/generate_204",
    interval: 300,
    tolerance: 50,
  });

  // US-Auto 回退顺序：优先1 -> 优先2 -> 自动测速
  const usAutoChain = [];
  if (addUsPriorityGroup(groups, "US-Auto-Priority1", PAID_PROVIDERS, US_AUTO_PRIORITY1)) {
    usAutoChain.push("US-Auto-Priority1");
  }
  if (addUsPriorityGroup(groups, "US-Auto-Priority2", PAID_PROVIDERS, US_AUTO_PRIORITY2)) {
    usAutoChain.push("US-Auto-Priority2");
  }
  usAutoChain.push("US-Auto-Speedtest");
  upsertGroup(groups, {
    name: "US-Auto",
    type: "fallback",
    proxies: usAutoChain,
    url: "https://www.gstatic.com/generate_204",
    interval: 300,
  });

  // 免费集合自动优选
  upsertGroup(groups, {
    name: "Free-Auto",
    type: "url-test",
    use: FREE_PROVIDERS,
    url: "https://www.gstatic.com/generate_204",
    interval: 300,
    tolerance: 50,
  });

  // Google 专属组：US-Auto 不可用时阻断
  upsertGroup(groups, {
    name: "Google",
    type: "fallback",
    proxies: ["US-Auto", "REJECT"],
    url: "https://www.gstatic.com/generate_204",
    interval: 300,
  });

  // 总出口组
  upsertGroup(groups, {
    name: "Proxy",
    type: "select",
    proxies: ["Free-Auto", "US-Auto", "DIRECT"],
  });

  // ==================== 规则（顺序即优先级）====================
  setRules(config, [
    "RULE-SET,geoip-private,DIRECT,no-resolve",
    "RULE-SET,geosite-cn,DIRECT",
    "RULE-SET,geosite-google,Google",
    "RULE-SET,geosite-youtube,Google",
    "DOMAIN-SUFFIX,google.com,Google",
    "DOMAIN-SUFFIX,google.com.hk,Google",
    "DOMAIN-SUFFIX,googleapis.com,Google",
    "DOMAIN-SUFFIX,gstatic.com,Google",
    "DOMAIN-SUFFIX,googleusercontent.com,Google",
    "DOMAIN-SUFFIX,ggpht.com,Google",
    "DOMAIN-SUFFIX,1e100.net,Google",
    "DOMAIN-SUFFIX,youtube.com,Google",
    "DOMAIN-SUFFIX,googlevideo.com,Google",
    "DOMAIN-SUFFIX,ytimg.com,Google",
    "DOMAIN-SUFFIX,youtube-nocookie.com,Google",
    "DOMAIN-SUFFIX,google-analytics.com,Google",
    "DOMAIN-SUFFIX,googletagmanager.com,Google",
    "DOMAIN-SUFFIX,googlesyndication.com,Google",
    "DOMAIN-SUFFIX,googleadservices.com,Google",
    "DOMAIN-SUFFIX,gmail.com,Google",
    "DOMAIN-SUFFIX,googlesource.com,Google",
    "RULE-SET,geosite-gfw,Proxy",
    "GEOIP,CN,DIRECT,no-resolve",
    "MATCH,Proxy",
  ]);

  return config;
};
