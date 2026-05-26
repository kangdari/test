import fs from "node:fs";

const previousPath = "data/passive-tree/data-0.4.0.json";
const currentPath = "data/passive-tree/data.json";
const compactPath = "public/passive-tree/compact.json";
const outputPath = "public/passive-tree/changelog.json";
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
    Deadeye: "데드아이",
    Pathfinder: "패스파인더",
    Amazon: "아마존",
    Ritualist: "의식술사",
    Invoker: "인보커",
    "Acolyte of Chayula": "차율라의 수련자",
    "Spirit Walker": "스피릿 워커",
    "Martial Artist": "무술가",
  }),
);

const termTranslations = new Map(
  Object.entries({
    "Critical Damage Bonus": "치명타 피해 보너스",
    "Critical Hit Chance": "치명타 확률",
    "Elemental Damage": "원소 피해",
    "Physical Damage": "물리 피해",
    "Fire Damage": "화염 피해",
    "Cold Damage": "냉기 피해",
    "Lightning Damage": "번개 피해",
    "Chaos Damage": "카오스 피해",
    "Ailment Threshold": "상태 이상 한계치",
    "Energy Shield Recharge": "에너지 보호막 재충전",
    "Energy Shield": "에너지 보호막",
    "Evasion Rating": "회피",
    "Armour Break": "방어도 파괴",
    Armour: "방어도",
    Accuracy: "정확도",
    "Maximum Life": "최대 생명력",
    "maximum Life": "최대 생명력",
    Life: "생명력",
    "Maximum Mana": "최대 마나",
    "maximum Mana": "최대 마나",
    Mana: "마나",
    Spirit: "정신력",
    Strength: "힘",
    Dexterity: "민첩",
    Intelligence: "지능",
    Attributes: "능력치",
    "Attack Damage": "공격 피해",
    "Attack Speed": "공격 속도",
    Attack: "공격",
    "Spell Damage": "주문 피해",
    "Cast Speed": "시전 속도",
    Spell: "주문",
    "Skill Effect Duration": "스킬 효과 지속시간",
    Skills: "스킬",
    Skill: "스킬",
    Projectile: "투사체",
    "Melee Damage": "근접 피해",
    Melee: "근접",
    "Area of Effect": "효과 범위",
    Area: "범위",
    Effect: "효과",
    Minions: "소환수",
    Minion: "소환수",
    Companions: "동료",
    Companion: "동료",
    Resistances: "저항",
    Resistance: "저항",
    "Block chance": "막기 확률",
    Block: "막기",
    Shield: "방패",
    Deflection: "튕겨내기",
    Deflect: "튕겨내기",
    Shock: "감전",
    Freeze: "동결",
    Ignite: "점화",
    Poison: "중독",
    Bleeding: "출혈",
    Chill: "냉각",
    "Stun Threshold": "기절 한계치",
    Stun: "기절",
    Curse: "저주",
    Onslaught: "맹공",
    Reservation: "점유",
    Efficiency: "효율",
    Cooldown: "재사용 대기시간",
    Fire: "화염",
    Cold: "냉기",
    Lightning: "번개",
    Chaos: "카오스",
    Physical: "물리",
    Damage: "피해",
    Duration: "지속시간",
    Recovery: "회복",
    Recoup: "피해 회생",
    Recharge: "재충전",
    Enemies: "적",
    Enemy: "적",
    Allies: "동료",
    Kill: "처치",
    Hit: "명중",
    Hits: "명중",
  }),
);

const meaningfulNodeFields = new Set([
  "name",
  "stats",
  "grantedSkill",
  "isNotable",
  "isKeystone",
  "ascendancyName",
  "grantedStrength",
  "grantedDexterity",
  "grantedIntelligence",
  "isJewelSocket",
]);

function stripStatMarkup(value) {
  return String(value ?? "")
    .replace(/\[([^\]|]+)\|([^\]]+)\]/g, "$2")
    .replace(/\[([^\]]+)\]/g, "$1");
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

function translateName(value, passiveNameTranslations) {
  if (!value) return "";
  return passiveNameTranslations.get(normalizeName(value)) ?? manualNameTranslations.get(value) ?? value;
}

function getTranslatedTerm(value) {
  return termTranslations.get(value) ?? manualNameTranslations.get(value) ?? value;
}

function translateBracketTerms(value) {
  return String(value ?? "")
    .replace(/\[([^\]|]+)\|([^\]]+)\]/g, (_, key, label) => {
      return getTranslatedTerm(label) || getTranslatedTerm(key);
    })
    .replace(/\[([^\]]+)\]/g, (_, label) => getTranslatedTerm(label));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceTerms(value) {
  let translated = String(value ?? "");
  const exactTerm = [...termTranslations.entries()].find(
    ([english]) => english.toLowerCase() === translated.toLowerCase(),
  );
  if (exactTerm) return exactTerm[1];

  const terms = [...termTranslations.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [english, korean] of terms) {
    translated = translated.replace(new RegExp(`\\b${escapeRegExp(english)}\\b`, "gi"), korean);
  }
  return translated
    .replace(/\bincreased\b/gi, "증가")
    .replace(/\breduced\b/gi, "감소")
    .replace(/\bmaximum\b/gi, "최대")
    .replace(/\bgain\b/gi, "획득")
    .replace(/\bgrants\b/gi, "부여")
    .replace(/\balso\b/gi, "또한")
    .replace(/\bagainst\b/gi, "상대로")
    .replace(/\bwith\b/gi, "사용 시")
    .replace(/\bof\b/gi, "의")
    .replace(/\band\b/gi, "및")
    .replace(/\byou\b/gi, "플레이어")
    .replace(/\byour\b/gi, "플레이어의")
    .replace(/\s+/g, " ")
    .trim();
}

function translateStat(value) {
  const cleanValue = translateBracketTerms(stripStatMarkup(value));
  if (cleanValue.includes("\n")) {
    return cleanValue.split("\n").map(translateStat).join("\n");
  }

  const directPatterns = [
    [/^(\d+)% increased (.+)$/i, (_, amount, target) => `${replaceTerms(target)} ${amount}% 증가`],
    [/^(\d+)% reduced (.+)$/i, (_, amount, target) => `${replaceTerms(target)} ${amount}% 감소`],
    [/^(\d+)% faster start of (.+)$/i, (_, amount, target) => `${replaceTerms(target)} 시작 속도 ${amount}% 가속`],
    [/^(\d+)% slower start of (.+)$/i, (_, amount, target) => `${replaceTerms(target)} 시작 속도 ${amount}% 감속`],
    [/^\+(\d+)%? to (.+)$/i, (_, amount, target) => `${replaceTerms(target)} +${amount}`],
    [/^-(\d+)%? to (.+)$/i, (_, amount, target) => `${replaceTerms(target)} -${amount}`],
    [/^(\d+)% chance to (.+)$/i, (_, amount, target) => `${replaceTerms(target)} 확률 ${amount}%`],
    [/^(.+) have (\d+)% increased (.+)$/i, (_, subject, amount, target) => `${replaceTerms(subject)}의 ${replaceTerms(target)} ${amount}% 증가`],
    [/^(.+) deal (\d+)% increased Damage$/i, (_, subject, amount) => `${replaceTerms(subject)}의 피해 ${amount}% 증가`],
    [/^Gain (.+)$/i, (_, target) => `${replaceTerms(target)} 획득`],
    [/^Grants Skill: (.+)$/i, (_, target) => `스킬 부여: ${replaceTerms(target)}`],
  ];

  for (const [pattern, render] of directPatterns) {
    const match = cleanValue.match(pattern);
    if (match) return render(...match);
  }

  return replaceTerms(cleanValue)
    .replace(/\bon Kill\b/gi, "처치 시")
    .replace(/\bon Hit\b/gi, "명중 시")
    .replace(/\bwhile\b/gi, "~하는 동안")
    .replace(/\s+/g, " ")
    .trim();
}

function preferPoe2dbName(value, passiveNameTranslations, compactNodeData) {
  const translatedName = translateName(value, passiveNameTranslations);
  if (translatedName && translatedName !== value) return translatedName;
  if (compactNodeData?.nameKr && !compactNodeData.nameKr.includes(" 의 ")) return compactNodeData.nameKr;
  return value || "(이름 없음)";
}

function comparable(value) {
  return JSON.stringify(value ?? null);
}

function sortNumericText(values) {
  return [...values].sort((a, b) => Number(a) - Number(b));
}

function compactNode(nodeId, node, passiveNameTranslations, compactNodeData) {
  const stats = (node.stats ?? []).map(stripStatMarkup);
  return {
    id: nodeId,
    name: node.name || "(이름 없음)",
    nameKr: preferPoe2dbName(node.name, passiveNameTranslations, compactNodeData),
    group: node.group,
    stats,
    statsKr: stats.map(translateStat),
    isNotable: node.isNotable || undefined,
    isKeystone: node.isKeystone || undefined,
    isJewelSocket: node.isJewelSocket || /Jewel Socket/i.test(node.name ?? "") || undefined,
    grantedSkill: node.grantedSkill,
    ascendancyName: node.ascendancyName,
  };
}

function classifyNode(node) {
  const haystack = [node.name, ...(node.stats ?? [])].join(" ").toLowerCase();
  if (node.isJewelSocket || /jewel socket/i.test(node.name ?? "")) return "jewel";
  if (node.isKeystone) return "keystone";
  if (node.isNotable) return "notable";
  if (node.grantedSkill) return "skill";
  if (haystack.includes("companion") || haystack.includes("bond of")) return "companion";
  if (haystack.includes("armour") || haystack.includes("deflection") || haystack.includes("energy shield")) return "defence";
  if (haystack.includes("leech") || haystack.includes("recoup") || haystack.includes("recovery")) return "recovery";
  return "passive";
}

function describeChange(fields, oldNode, newNode) {
  if (fields.includes("grantedSkill")) return "부여 스킬 변경";
  if (fields.includes("isKeystone") || fields.includes("isNotable")) return "노드 등급 변경";
  if (oldNode.name !== newNode.name && comparable(oldNode.stats) !== comparable(newNode.stats)) {
    return "이름 및 효과 변경";
  }
  if (oldNode.name !== newNode.name) return "이름 변경";
  if (comparable(oldNode.stats) !== comparable(newNode.stats)) return "효과 변경";
  return "표시 데이터 변경";
}

function edgeKey(edge) {
  return JSON.stringify({
    from: edge.from,
    to: edge.to,
    orbit: edge.orbit,
    orbitX: edge.orbitX,
    orbitY: edge.orbitY,
  });
}

function buildClassChanges(previousClasses, currentClasses, passiveNameTranslations) {
  return previousClasses.flatMap((previousClass, index) => {
    const currentClass = currentClasses[index];
    if (!currentClass || comparable(previousClass) === comparable(currentClass)) return [];

    return [
      {
        className: previousClass.name,
        classNameKr: translateName(previousClass.name, passiveNameTranslations),
        before: (previousClass.ascendancies ?? []).map((entry) => ({
          id: entry.id,
          name: entry.name,
          nameKr: translateName(entry.name, passiveNameTranslations),
          image: entry.image,
        })),
        after: (currentClass.ascendancies ?? []).map((entry) => ({
          id: entry.id,
          name: entry.name,
          nameKr: translateName(entry.name, passiveNameTranslations),
          image: entry.image,
        })),
      },
    ];
  });
}

const previousData = JSON.parse(fs.readFileSync(previousPath, "utf8"));
const currentData = JSON.parse(fs.readFileSync(currentPath, "utf8"));
const compactData = fs.existsSync(compactPath) ? JSON.parse(fs.readFileSync(compactPath, "utf8")) : { nodes: {} };
const passiveNameTranslations = await loadPoe2dbPassiveNameTranslations();

const previousGroupIds = new Set(Object.keys(previousData.groups));
const currentGroupIds = new Set(Object.keys(currentData.groups));
const previousNodeIds = new Set(Object.keys(previousData.nodes));
const currentNodeIds = new Set(Object.keys(currentData.nodes));
const previousOverrideIds = new Set(Object.keys(previousData.skillOverrides));
const currentOverrideIds = new Set(Object.keys(currentData.skillOverrides));
const previousJewelSlots = new Set(previousData.jewelSlots.map(String));
const currentJewelSlots = new Set(currentData.jewelSlots.map(String));
const previousEdges = new Set(previousData.edges.map(edgeKey));
const currentEdges = new Set(currentData.edges.map(edgeKey));

const addedNodeIds = sortNumericText([...currentNodeIds].filter((nodeId) => !previousNodeIds.has(nodeId)));
const removedNodeIds = sortNumericText([...previousNodeIds].filter((nodeId) => !currentNodeIds.has(nodeId)));
const changedNodes = sortNumericText([...currentNodeIds].filter((nodeId) => previousNodeIds.has(nodeId)))
  .flatMap((nodeId) => {
    const before = previousData.nodes[nodeId];
    const after = currentData.nodes[nodeId];
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
      (field) => meaningfulNodeFields.has(field) && comparable(before[field]) !== comparable(after[field]),
    );
    if (fields.length === 0) return [];

    return [
      {
        id: nodeId,
        name: after.name || before.name || "(이름 없음)",
        nameKr: preferPoe2dbName(after.name || before.name, passiveNameTranslations, compactData.nodes[nodeId]),
        beforeName: before.name || "(이름 없음)",
        beforeNameKr: preferPoe2dbName(before.name, passiveNameTranslations),
        afterName: after.name || "(이름 없음)",
        afterNameKr: preferPoe2dbName(after.name, passiveNameTranslations, compactData.nodes[nodeId]),
        group: after.group ?? before.group,
        type: classifyNode(after),
        fields,
        summary: describeChange(fields, before, after),
        beforeStats: (before.stats ?? []).map(stripStatMarkup),
        beforeStatsKr: (before.stats ?? []).map(translateStat),
        afterStats: (after.stats ?? []).map(stripStatMarkup),
        afterStatsKr: (after.stats ?? []).map(translateStat),
      },
    ];
  });

const changelog = {
  versions: {
    previous: "0.4.0",
    current: "0.5.0",
  },
  summary: {
    groups: {
      before: previousGroupIds.size,
      after: currentGroupIds.size,
      added: [...currentGroupIds].filter((groupId) => !previousGroupIds.has(groupId)).length,
      removed: [...previousGroupIds].filter((groupId) => !currentGroupIds.has(groupId)).length,
    },
    nodes: {
      before: previousNodeIds.size,
      after: currentNodeIds.size,
      added: addedNodeIds.length,
      removed: removedNodeIds.length,
      changed: changedNodes.length,
    },
    edges: {
      before: previousData.edges.length,
      after: currentData.edges.length,
      added: [...currentEdges].filter((edge) => !previousEdges.has(edge)).length,
      removed: [...previousEdges].filter((edge) => !currentEdges.has(edge)).length,
    },
    skillOverrides: {
      before: previousOverrideIds.size,
      after: currentOverrideIds.size,
      added: [...currentOverrideIds].filter((overrideId) => !previousOverrideIds.has(overrideId)).length,
      removed: [...previousOverrideIds].filter((overrideId) => !currentOverrideIds.has(overrideId)).length,
    },
    jewelSlots: {
      before: previousJewelSlots.size,
      after: currentJewelSlots.size,
      added: [...currentJewelSlots].filter((slotId) => !previousJewelSlots.has(slotId)).length,
      removed: [...previousJewelSlots].filter((slotId) => !currentJewelSlots.has(slotId)).length,
    },
  },
  addedNodes: addedNodeIds.map((nodeId) => ({
    ...compactNode(nodeId, currentData.nodes[nodeId], passiveNameTranslations, compactData.nodes[nodeId]),
    type: classifyNode(currentData.nodes[nodeId]),
  })),
  removedNodes: removedNodeIds.map((nodeId) => ({
    ...compactNode(nodeId, previousData.nodes[nodeId], passiveNameTranslations),
    type: classifyNode(previousData.nodes[nodeId]),
  })),
  changedNodes,
  classChanges: buildClassChanges(previousData.classes, currentData.classes, passiveNameTranslations),
  addedJewelSlots: sortNumericText([...currentJewelSlots].filter((slotId) => !previousJewelSlots.has(slotId))).map(
    (slotId) => compactNode(slotId, currentData.nodes[slotId], passiveNameTranslations, compactData.nodes[slotId]),
  ),
  addedSkillOverrides: sortNumericText(
    [...currentOverrideIds].filter((overrideId) => !previousOverrideIds.has(overrideId)),
  ).map((overrideId) => ({
    id: overrideId,
    overrides: currentData.skillOverrides[overrideId].map((override) => ({
      name: override.name,
      nameKr: translateName(override.name, passiveNameTranslations),
      stats: (override.stats ?? []).map(stripStatMarkup),
      statsKr: (override.stats ?? []).map(translateStat),
      isNotable: override.isNotable || undefined,
    })),
  })),
  assetChanges: [
    "assets/background-huntress.webp",
    "assets/background-monk.json",
    "assets/background-monk.webp",
    "assets/jewel-radius.json",
    "assets/jewel-radius.webp",
    "assets/skills-disabled.json",
    "assets/skills-disabled.webp",
    "assets/skills.json",
    "assets/skills.webp",
    "data.json",
  ],
};

fs.writeFileSync(outputPath, `${JSON.stringify(changelog)}\n`);
console.log(
  `Generated passive tree changelog: ${addedNodeIds.length} added, ${removedNodeIds.length} removed, ${changedNodes.length} changed nodes at ${outputPath}.`,
);
