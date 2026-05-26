import fs from "node:fs";

const sourcePath = "data/passive-tree/data.json";
const outputPath = "public/passive-tree/compact.json";
const poe2dbAutocompleteKrUrl =
  "https://cdn.poe2db.tw/json/autocomplete_kr.4c60f0f55e394ff9.json";

const manualNameTranslations = new Map(
  Object.entries({
    Marauder: "머라우더",
    Witch: "위치",
    Ranger: "레인저",
    Warrior: "전사",
    Huntress: "헌트리스",
    Sorceress: "소서리스",
    Mercenary: "용병",
    Monk: "몽크",
    Druid: "드루이드",
    Infernalist: "인퍼널리스트",
    "Blood Mage": "블러드 메이지",
    Lich: "리치",
    "Abyssal Lich": "심연 리치",
    Pathfinder: "패스파인더",
    Deadeye: "데드아이",
    Amazon: "아마존",
    Titan: "타이탄",
    Warbringer: "워브링어",
    Smith: "대장장이",
    "Bloodbound": "블러드바운드",
    Ritualist: "의식술사",
    "Tactician": "전술가",
    Witchhunter: "위치헌터",
    "Gemling Legionnaire": "젬링 군단병",
    Invoker: "인보커",
    Acolyte: "수련자",
    "Acolyte of Chayula": "차율라의 수련자",
  }),
);

const termTranslations = new Map(
  Object.entries({
    "Critical Damage Bonus": "치명타 피해 보너스",
    "Critical Hit Chance": "치명타 확률",
    "Critical Hits": "치명타",
    "Critical Hit": "치명타",
    "Elemental Damage": "원소 피해",
    "Physical Damage": "물리 피해",
    "Fire Damage": "화염 피해",
    "Cold Damage": "냉기 피해",
    "Lightning Damage": "번개 피해",
    "Chaos Damage": "카오스 피해",
    "Damage over Time": "지속 피해",
    "Damaging Ailments": "피해를 주는 상태 이상",
    "Elemental Ailments": "원소 상태 이상",
    "Ailment Threshold": "상태 이상 한계치",
    "Ailments": "상태 이상",
    "Energy Shield Recharge": "에너지 보호막 재충전",
    "Energy Shield": "에너지 보호막",
    "Evasion Rating": "회피",
    "Armour Break": "방어도 파괴",
    "Armour": "방어도",
    "Accuracy Rating": "정확도",
    "Accuracy": "정확도",
    "Maximum Life": "최대 생명력",
    "maximum Life": "최대 생명력",
    "Life Regeneration": "생명력 재생",
    "Life": "생명력",
    "Maximum Mana": "최대 마나",
    "maximum Mana": "최대 마나",
    "Mana Regeneration": "마나 재생",
    "Mana": "마나",
    "Spirit": "정신력",
    "Strength": "힘",
    "Dexterity": "민첩",
    "Intelligence": "지능",
    "Attributes": "능력치",
    "Attack Damage": "공격 피해",
    "Attack Speed": "공격 속도",
    "Attacks": "공격",
    "Attack": "공격",
    "Spell Damage": "주문 피해",
    "Cast Speed": "시전 속도",
    "Spells": "주문",
    "Spell": "주문",
    "Skill Effect Duration": "스킬 효과 지속시간",
    "Skill Speed": "스킬 속도",
    "Skill": "스킬",
    "Projectile Damage": "투사체 피해",
    "Projectiles": "투사체",
    "Projectile": "투사체",
    "Melee Damage": "근접 피해",
    "Melee": "근접",
    "Area of Effect": "효과 범위",
    "Flask Charges": "플라스크 충전",
    "Flasks": "플라스크",
    "Flask": "플라스크",
    "Minion Damage": "소환수 피해",
    "Minion Life": "소환수 생명력",
    "Minions": "소환수",
    "Minion": "소환수",
    "Resistances": "저항",
    "Resistance": "저항",
    "Block Chance": "막기 확률",
    "Block": "막기",
    "Shock Chance": "감전 확률",
    "Shock": "감전",
    "Freeze Buildup": "동결 축적",
    "Freeze": "동결",
    "Ignite": "점화",
    "Poison": "중독",
    "Bleeding": "출혈",
    "Blind": "실명",
    "Chill": "냉각",
    "Stun Threshold": "기절 한계치",
    "Stun": "기절",
    "Curse": "저주",
    "Curses": "저주",
    "Tailwind": "순풍",
    "Onslaught": "맹공",
    "Reservation": "점유",
    "Rarity": "희귀도",
    "Duration": "지속시간",
    "Recovery": "회복",
    "Regeneration": "재생",
    "Recharge": "재충전",
    "Charges": "충전",
    "Charge": "충전",
    "Enemies": "적",
    "Enemy": "적",
    "Allies": "동료",
    "Kill": "처치",
    "Hit Damage": "명중 피해",
    "Hits": "명중",
    "Hit": "명중",
    "Damage": "피해",
  }),
);

function stripStatMarkup(value) {
  return value.replace(/\[([^\]|]+)\|([^\]]+)\]/g, "$2").replace(/\[([^\]]+)\]/g, "$1");
}

function normalizeName(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/%2C/gi, ",")
    .replace(/_/g, " ")
    .replace(/['’.,:()\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function loadPoe2dbPassiveNameTranslations() {
  try {
    const response = await fetch(poe2dbAutocompleteKrUrl, {
      headers: {
        referer: "https://poe2db.tw/kr/",
        "user-agent": "Mozilla/5.0",
      },
    });
    if (!response.ok) throw new Error(`PoE2DB autocomplete returned ${response.status}`);

    const autocompleteItems = await response.json();
    const translations = new Map();
    for (const item of autocompleteItems) {
      if (item?.desc !== "Passive" || !item.label || !item.value) continue;
      translations.set(normalizeName(item.value), item.label);
    }
    return translations;
  } catch (error) {
    console.warn(`Could not load PoE2DB Korean passive names: ${error.message}`);
    return new Map();
  }
}

function getTranslatedTerm(value) {
  return termTranslations.get(value) ?? manualNameTranslations.get(value) ?? value;
}

function translateBracketTerms(value) {
  return value.replace(/\[([^\]|]+)\|([^\]]+)\]/g, (_, key, label) => {
    return getTranslatedTerm(label) || getTranslatedTerm(key);
  }).replace(/\[([^\]]+)\]/g, (_, label) => getTranslatedTerm(label));
}

function replaceTerms(value) {
  let translated = String(value ?? "");
  const terms = [...termTranslations.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [english, korean] of terms) {
    translated = translated.replace(new RegExp(`\\b${escapeRegExp(english)}\\b`, "g"), korean);
  }
  return translated;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function translateStat(value) {
  const cleanValue = translateBracketTerms(stripStatMarkup(value));

  const directPatterns = [
    [/^(.+) deal (\d+)% increased Damage$/i, (_, subject, amount) => `${replaceTerms(subject)}의 피해 ${amount}% 증가`],
    [/^(\d+)% increased (.+)$/i, (_, amount, target) => `${replaceTerms(target)} ${amount}% 증가`],
    [/^(\d+)% reduced (.+)$/i, (_, amount, target) => `${replaceTerms(target)} ${amount}% 감소`],
    [/^\+(\d+) to (.+)$/i, (_, amount, target) => `${replaceTerms(target)} +${amount}`],
    [/^-(\d+) to (.+)$/i, (_, amount, target) => `${replaceTerms(target)} -${amount}`],
    [/^(\d+)% chance to (.+)$/i, (_, amount, target) => `${replaceTerms(target)} 확률 ${amount}%`],
    [/^(\d+)% increased chance to (.+)$/i, (_, amount, target) => `${replaceTerms(target)} 확률 ${amount}% 증가`],
    [/^(\d+)% chance to (.+) Enemies on Hit$/i, (_, amount, target) => `명중 시 적에게 ${replaceTerms(target)} 유발 확률 ${amount}%`],
    [/^Recover (\d+)% of maximum (.+) on Kill$/i, (_, amount, target) => `처치 시 최대 ${replaceTerms(target)}의 ${amount}% 회복`],
    [/^Gain (.+) on Skill use$/i, (_, target) => `스킬 사용 시 ${replaceTerms(target)} 획득`],
    [/^Lose all (.+) when Hit$/i, (_, target) => `명중당하면 모든 ${replaceTerms(target)} 상실`],
    [/^(.+) does not Recharge$/i, (_, target) => `${replaceTerms(target)} 재충전 불가`],
    [/^You can apply an additional Curse$/i, () => "저주를 1개 추가 적용 가능"],
    [/^(.+) deal damage (\d+)% faster$/i, (_, target, amount) => `${replaceTerms(target)} 피해가 ${amount}% 더 빠르게 적용`],
  ];

  for (const [pattern, render] of directPatterns) {
    const match = cleanValue.match(pattern);
    if (match) return render(...match);
  }

  return replaceTerms(cleanValue)
    .replace(/\bincreased\b/gi, "증가")
    .replace(/\breduced\b/gi, "감소")
    .replace(/\bmaximum\b/gi, "최대")
    .replace(/\bgained\b/gi, "획득")
    .replace(/\bgain\b/gi, "획득")
    .replace(/\bon Kill\b/gi, "처치 시")
    .replace(/\bon Hit\b/gi, "명중 시")
    .replace(/\bwhile\b/gi, "~하는 동안")
    .replace(/\bwith\b/gi, "사용 시")
    .replace(/\s+/g, " ")
    .trim();
}

function translateName(value, passiveNameTranslations) {
  if (!value) return "";
  return passiveNameTranslations.get(normalizeName(value)) ?? manualNameTranslations.get(value) ?? replaceTerms(value);
}

function getNodeAffinity(node) {
  const haystack = [node.icon, node.name, ...(node.stats ?? [])].join(" ").toLowerCase();
  if (haystack.includes("fire") || haystack.includes("strength") || haystack.includes("armour")) {
    return "str";
  }
  if (haystack.includes("cold") || haystack.includes("lightning") || haystack.includes("spell")) {
    return "int";
  }
  if (haystack.includes("evasion") || haystack.includes("poison") || haystack.includes("projectile")) {
    return "dex";
  }
  return undefined;
}

function hasTreePosition(node) {
  return Number.isFinite(node.x) && Number.isFinite(node.y);
}

const data = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const passiveNameTranslations = await loadPoe2dbPassiveNameTranslations();

const compactData = {
  classes: data.classes.map((treeClass) => ({
    name: treeClass.name,
    nameKr: translateName(treeClass.name, passiveNameTranslations),
    base_str: treeClass.base_str,
    base_dex: treeClass.base_dex,
    base_int: treeClass.base_int,
    ascendancies: (treeClass.ascendancies ?? []).map((ascendancy) => ({
      id: ascendancy.id,
      name: ascendancy.name,
      nameKr: translateName(ascendancy.name, passiveNameTranslations),
    })),
  })),
  nodes: {},
  edges: [],
  min_x: data.min_x,
  min_y: data.min_y,
  max_x: data.max_x,
  max_y: data.max_y,
};

for (const [nodeId, node] of Object.entries(data.nodes)) {
  if (!hasTreePosition(node)) continue;

  const stats = (node.stats ?? []).map(stripStatMarkup);
  const statsKr = (node.stats ?? []).map(translateStat);
  const nameKr = translateName(node.name, passiveNameTranslations);
  compactData.nodes[nodeId] = {
    name: node.name,
    nameKr,
    stats,
    statsKr,
    flavourText: node.flavourText?.map(stripStatMarkup),
    flavourTextKr: node.flavourText?.map(translateStat),
    isNotable: node.isNotable || undefined,
    isKeystone: node.isKeystone || undefined,
    isMastery: node.isMastery || undefined,
    ascendancyId: node.ascendancyId,
    x: Math.round(node.x),
    y: Math.round(node.y),
    affinity: getNodeAffinity(node),
    searchText: [node.name, nameKr, ...stats, ...statsKr].join(" ").toLowerCase(),
  };
}

for (const edge of data.edges) {
  const fromId = String(edge.from);
  const toId = String(edge.to);
  if (!compactData.nodes[fromId] || !compactData.nodes[toId]) continue;

  compactData.edges.push({
    from: fromId,
    to: toId,
    orbitX: Number.isFinite(edge.orbitX) ? Math.round(edge.orbitX) : undefined,
    orbitY: Number.isFinite(edge.orbitY) ? Math.round(edge.orbitY) : undefined,
  });
}

fs.writeFileSync(outputPath, `${JSON.stringify(compactData)}\n`);
console.log(
  `Generated compact passive tree: ${Object.keys(compactData.nodes).length} nodes, ${
    compactData.edges.length
  } links, ${passiveNameTranslations.size} PoE2DB passive name translations at ${outputPath}.`,
);
