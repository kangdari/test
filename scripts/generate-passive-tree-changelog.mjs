import fs from "node:fs";

const previousPath = "data/passive-tree/data-0.4.0.json";
const currentPath = "data/passive-tree/data.json";
const outputPath = "public/passive-tree/changelog.json";

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

function comparable(value) {
  return JSON.stringify(value ?? null);
}

function sortNumericText(values) {
  return [...values].sort((a, b) => Number(a) - Number(b));
}

function compactNode(nodeId, node) {
  return {
    id: nodeId,
    name: node.name || "(이름 없음)",
    group: node.group,
    stats: (node.stats ?? []).map(stripStatMarkup),
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

function buildClassChanges(previousClasses, currentClasses) {
  return previousClasses.flatMap((previousClass, index) => {
    const currentClass = currentClasses[index];
    if (!currentClass || comparable(previousClass) === comparable(currentClass)) return [];

    return [
      {
        className: previousClass.name,
        before: (previousClass.ascendancies ?? []).map((entry) => ({
          id: entry.id,
          name: entry.name,
          image: entry.image,
        })),
        after: (currentClass.ascendancies ?? []).map((entry) => ({
          id: entry.id,
          name: entry.name,
          image: entry.image,
        })),
      },
    ];
  });
}

const previousData = JSON.parse(fs.readFileSync(previousPath, "utf8"));
const currentData = JSON.parse(fs.readFileSync(currentPath, "utf8"));

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
        beforeName: before.name || "(이름 없음)",
        afterName: after.name || "(이름 없음)",
        group: after.group ?? before.group,
        type: classifyNode(after),
        fields,
        summary: describeChange(fields, before, after),
        beforeStats: (before.stats ?? []).map(stripStatMarkup),
        afterStats: (after.stats ?? []).map(stripStatMarkup),
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
    ...compactNode(nodeId, currentData.nodes[nodeId]),
    type: classifyNode(currentData.nodes[nodeId]),
  })),
  removedNodes: removedNodeIds.map((nodeId) => ({
    ...compactNode(nodeId, previousData.nodes[nodeId]),
    type: classifyNode(previousData.nodes[nodeId]),
  })),
  changedNodes,
  classChanges: buildClassChanges(previousData.classes, currentData.classes),
  addedJewelSlots: sortNumericText([...currentJewelSlots].filter((slotId) => !previousJewelSlots.has(slotId))).map(
    (slotId) => compactNode(slotId, currentData.nodes[slotId]),
  ),
  addedSkillOverrides: sortNumericText(
    [...currentOverrideIds].filter((overrideId) => !previousOverrideIds.has(overrideId)),
  ).map((overrideId) => ({
    id: overrideId,
    overrides: currentData.skillOverrides[overrideId].map((override) => ({
      name: override.name,
      stats: (override.stats ?? []).map(stripStatMarkup),
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
