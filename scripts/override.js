// === AUTO-SUB-SETS:START ===
// 自动生成区块：请在管理面板的"订阅集合"里维护，不建议手工改这里。
const SUB_SET1 = [
  {
    "name": "A",
    "url": "https://example.com/subscription-A.yaml"
  },
  {
    "name": "B",
    "url": "https://example.com/subscription-B.yaml"
  },
  {
    "name": "C",
    "url": "https://example.com/subscription-C.yaml"
  },
  {
    "name": "D",
    "url": "https://example.com/subscription-D.yaml"
  }
];
const SUB_SET2 = [
  {
    "name": "a",
    "url": "https://example.com/subscription-a.yaml"
  },
  {
    "name": "b",
    "url": "https://example.com/subscription-b.yaml"
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

// 兼容旧版自动区块：缺少 US_AUTO_PRIORITY 常量时回退为空。
const __US_AUTO_PRIORITY_OBJ =
  typeof US_AUTO_PRIORITY === "object" && US_AUTO_PRIORITY !== null
    ? US_AUTO_PRIORITY
    : { priority1: "", priority2: "" };
const __US_AUTO_PRIORITY1 =
  typeof US_AUTO_PRIORITY1 === "string"
    ? US_AUTO_PRIORITY1.trim()
    : String(__US_AUTO_PRIORITY_OBJ.priority1 || "").trim();
const __US_AUTO_PRIORITY2 =
  typeof US_AUTO_PRIORITY2 === "string"
    ? US_AUTO_PRIORITY2.trim()
    : String(__US_AUTO_PRIORITY_OBJ.priority2 || "").trim();

// ==================== 过滤器 ====================
// 付费集合中用于 Google/YouTube 的美国优选节点过滤器
const US_FILTER =
  "(?i)(\\bUS\\b|\\bUSA\\b|United\\s*States|UnitedStates|America|美国|美國|美西|美东|洛杉矶|圣何塞|硅谷|西雅图|达拉斯|芝加哥|纽约|华盛顿|🇺🇸)";
// 付费集合中"免费/试用/低倍率(<=0.2)"节点过滤器，用于 Low 手动组。
// 兼容节点名的多种倍率写法：
//   ×0.2 / X0.2 / x0.1 / 0倍率 / 0.0倍消耗 / [0倍消耗] / 0x
// 大于 0.2 的不匹配（如 ×1、×1.3、×0.25、[1.0倍消耗]、[2.0倍消耗]）。
const LOW_FILTER =
  "(?i)(免费|试用|(?:倍率|倍消耗|倍|[×xX])\\s*[:=]?\\s*0(?:\\.(?:0\\d*|1\\d*|20*))?(?:[^0-9.]|$)|(?:^|[^0-9.])0(?:\\.(?:0\\d*|1\\d*|20*))?\\s*(?:倍率|倍消耗|倍|[×xX]))";
const HEALTHCHECK_URL = "https://www.gstatic.com/generate_204";
const AUTO_CHECK_INTERVAL = 180;
const AUTO_TOLERANCE = 200;

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
        url: HEALTHCHECK_URL,
        interval: AUTO_CHECK_INTERVAL,
      },
      override: { "additional-suffix": ` @${suffixTag}` },
    };
  });
  return names;
}

function addUsManualGroup(groups, groupName, providerNames) {
  const providers = Array.isArray(providerNames)
    ? providerNames.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (!providers.length) return false;
  upsertGroup(groups, {
    name: groupName,
    type: "select",
    use: providers,
    filter: US_FILTER,
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

  // 美国自动测速池（所有付费）
  upsertGroup(groups, {
    name: "US-Auto",
    type: "url-test",
    use: PAID_PROVIDERS,
    filter: US_FILTER,
    url: HEALTHCHECK_URL,
    interval: AUTO_CHECK_INTERVAL,
    tolerance: AUTO_TOLERANCE,
    lazy: false,
  });

  // 固定手动组：US1 / US2（都可手动选择全量美国节点）
  const googleChain = [];
  if (addUsManualGroup(groups, "US1", PAID_PROVIDERS)) googleChain.push("US1");
  if (addUsManualGroup(groups, "US2", PAID_PROVIDERS)) googleChain.push("US2");
  googleChain.push("US-Auto", "REJECT");

  // 低倍率/免费手动组：从付费 provider 中筛出"免费/试用/倍率<=0.2"的节点。
  // 不限地区，非美国的 0 倍率节点同样会进入该组。
  const hasLowGroup = PAID_PROVIDERS.length > 0;
  if (hasLowGroup) {
    upsertGroup(groups, {
      name: "Low",
      type: "select",
      use: PAID_PROVIDERS,
      filter: LOW_FILTER,
    });
  }

  // 免费集合自动优选（Low 手动组作为候选成员并入）
  const freeAutoGroup = {
    name: "Free-Auto",
    type: "url-test",
    use: FREE_PROVIDERS,
    url: HEALTHCHECK_URL,
    interval: AUTO_CHECK_INTERVAL,
    tolerance: AUTO_TOLERANCE,
    lazy: false,
  };
  if (hasLowGroup) {
    freeAutoGroup.proxies = ["Low"];
  }
  upsertGroup(groups, freeAutoGroup);

  // Google 专属组：按 US1 -> US2 -> US-Auto 回退，不可用时阻断
  upsertGroup(groups, {
    name: "Google",
    type: "fallback",
    proxies: googleChain,
    url: HEALTHCHECK_URL,
    interval: AUTO_CHECK_INTERVAL,
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
    // OpenAI / Codex / Anthropic 与 Google 走同一专属代理链（US1 -> US2 -> US-Auto）
    "DOMAIN-SUFFIX,openai.com,Google",
    "DOMAIN-SUFFIX,chatgpt.com,Google",
    "DOMAIN-SUFFIX,oaistatic.com,Google",
    "DOMAIN-SUFFIX,oaiusercontent.com,Google",
    "DOMAIN-SUFFIX,anthropic.com,Google",
    "DOMAIN-SUFFIX,claude.ai,Google",
    "DOMAIN-SUFFIX,claudeusercontent.com,Google",
    "DOMAIN-SUFFIX,claude.com,Google",
    "RULE-SET,geosite-gfw,Proxy",
    "GEOIP,CN,DIRECT,no-resolve",
    "MATCH,Proxy",
  ]);

  return config;
};
