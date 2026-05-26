import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Bookmark,
  ExternalLink,
  Globe2,
  Network,
  Search,
  ShieldQuestion,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { items } from "./generated/items";
import type { Language, LocalizedItem, UniqueItem } from "./generated/items";

type AppView = "items" | "passive-tree" | "changelog";

type SavedModifier = {
  id: string;
  text: string;
  itemName: string;
  itemBaseType: string;
  slug: string;
  language?: Language;
  modifierIndex?: number;
};

type PassiveTreeClass = {
  name: string;
  nameKr?: string;
  base_str: number;
  base_dex: number;
  base_int: number;
  ascendancies: { id: string; name: string; nameKr?: string }[];
};

type PassiveTreeNode = {
  name: string;
  nameKr?: string;
  stats?: string[];
  statsKr?: string[];
  flavourText?: string[];
  flavourTextKr?: string[];
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  ascendancyId?: string;
  x: number;
  y: number;
  affinity?: "str" | "dex" | "int";
  searchText: string;
};

type PassiveTreeEdge = {
  from: string;
  to: string;
  orbitX?: number;
  orbitY?: number;
};

type PassiveTreeData = {
  classes: PassiveTreeClass[];
  nodes: Record<string, PassiveTreeNode>;
  edges: PassiveTreeEdge[];
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
};

type PassiveNodeTypeFilter = "all" | "notable" | "keystone" | "ascendancy";

type ChangelogNode = {
  id: string;
  name: string;
  nameKr?: string;
  beforeName?: string;
  beforeNameKr?: string;
  afterName?: string;
  afterNameKr?: string;
  group?: number;
  type: string;
  fields?: string[];
  summary?: string;
  stats?: string[];
  statsKr?: string[];
  beforeStats?: string[];
  beforeStatsKr?: string[];
  afterStats?: string[];
  afterStatsKr?: string[];
  isNotable?: boolean;
  isKeystone?: boolean;
  isJewelSocket?: boolean;
};

type ChangelogData = {
  versions: {
    previous: string;
    current: string;
  };
  summary: Record<
    "groups" | "nodes" | "edges" | "skillOverrides" | "jewelSlots",
    { before: number; after: number; added: number; removed: number; changed?: number }
  >;
  addedNodes: ChangelogNode[];
  removedNodes: ChangelogNode[];
  changedNodes: ChangelogNode[];
  classChanges: {
    className: string;
    classNameKr?: string;
    before: { id: string; name?: string | null; nameKr?: string | null; image?: string | null }[];
    after: { id: string; name?: string | null; nameKr?: string | null; image?: string | null }[];
  }[];
  addedJewelSlots: ChangelogNode[];
  addedSkillOverrides: {
    id: string;
    overrides: { name: string; nameKr?: string; stats: string[]; statsKr?: string[]; isNotable?: boolean }[];
  }[];
  assetChanges: string[];
};

type ChangelogSection =
  | "summary"
  | "added"
  | "removed"
  | "changed"
  | "classes"
  | "jewels"
  | "overrides"
  | "assets";

const savedModifiersStorageKey = "poe2:saved-explicit-modifiers";

function languageLabel(language: Language) {
  return language === "kr" ? "KR" : "EN";
}

function itemForLanguage(item: UniqueItem, language: Language): LocalizedItem {
  return language === "en" && item.en ? item.en : item.kr;
}

function getLevelValue(item: UniqueItem) {
  const text = item.kr.requirements[0] ?? item.en?.requirements[0] ?? "";
  const match = text.match(/(?:레벨|Level)\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function hasItemInfo(local: LocalizedItem) {
  return (
    local.properties.length > 0 ||
    local.requirements.length > 0 ||
    local.implicitModifiers.length > 0 ||
    local.explicitModifiers.length > 0 ||
    Boolean(local.flavourText)
  );
}

function isIncompleteItem(item: UniqueItem) {
  return (
    !item.imagePath ||
    !item.category ||
    !item.kr.category ||
    item.kr.properties.length === 0 ||
    !hasItemInfo(item.kr)
  );
}

function getNodeType(node: PassiveTreeNode) {
  if (node.isKeystone) return "Keystone";
  if (node.isNotable) return "Notable";
  if (node.ascendancyId) return "Ascendancy";
  if (node.isMastery) return "Mastery";
  return "Passive";
}

function getNodeRadius(node: PassiveTreeNode) {
  if (node.isKeystone) return 155;
  if (node.isNotable) return 92;
  if (node.ascendancyId) return 74;
  return 30;
}

function getNodeClassName(node: PassiveTreeNode, selected: boolean) {
  const classes = ["tree-node"];
  if (node.isKeystone) classes.push("keystone");
  else if (node.isNotable) classes.push("notable");
  else if (node.ascendancyId) classes.push("ascendancy");
  classes.push(node.affinity ?? "neutral");
  if (selected) classes.push("selected");
  return classes.join(" ");
}

function getClassBackgroundName(selectedClass: string) {
  const backgrounds = new Set([
    "druid",
    "huntress",
    "mercenary",
    "monk",
    "ranger",
    "sorceress",
    "warrior",
    "witch",
  ]);
  const className = selectedClass.toLowerCase();
  return backgrounds.has(className) ? className : "witch";
}

function getLocalizedText(korean: string | undefined, english: string) {
  return korean && korean !== english ? korean : english;
}

function getPassiveNodeSummary(node: PassiveTreeNode) {
  const primaryStat = node.stats?.[0];
  const primaryStatKr = node.statsKr?.[0];
  if (primaryStat) return getLocalizedText(primaryStatKr, primaryStat);
  if (node.flavourTextKr?.[0]) return node.flavourTextKr[0];
  if (node.flavourText?.[0]) return node.flavourText[0];
  return "표시할 효과 정보가 없습니다.";
}

function getChangelogTypeLabel(type: string) {
  const labels: Record<string, string> = {
    companion: "Companion",
    defence: "Defence",
    jewel: "Jewel",
    keystone: "Keystone",
    notable: "Notable",
    passive: "Passive",
    recovery: "Recovery",
    skill: "Skill",
  };
  return labels[type] ?? type;
}

function buildSavedModifierId(slug: string, language: Language, modifier: string, modifierIndex: number) {
  return `${slug}:${language}:${modifierIndex}:${modifier}`;
}

function getSavedModifierId(item: UniqueItem, language: Language, modifier: string, modifierIndex: number) {
  return buildSavedModifierId(item.slug, language, modifier, modifierIndex);
}

function getLegacySavedModifierId(item: UniqueItem, language: Language, modifier: string) {
  return `${item.slug}:${language}:${modifier}`;
}

function isLanguage(value: unknown): value is Language {
  return value === "kr" || value === "en";
}

function parseSavedModifierId(id: string) {
  const [slug, language, indexText, ...modifierParts] = id.split(":");
  const parsedLanguage = isLanguage(language) ? language : undefined;
  const parsedIndex = Number(indexText);

  return {
    slug,
    language: parsedLanguage,
    modifierIndex: Number.isInteger(parsedIndex) ? parsedIndex : undefined,
    modifierText: modifierParts.length > 0 ? modifierParts.join(":") : indexText,
  };
}

function normalizeSavedModifier(modifier: unknown): SavedModifier | null {
  if (typeof modifier !== "object" || modifier === null) {
    return null;
  }

  const savedModifier = modifier as Partial<SavedModifier>;

  if (
    typeof savedModifier.id !== "string" ||
    typeof savedModifier.text !== "string" ||
    typeof savedModifier.itemName !== "string" ||
    typeof savedModifier.itemBaseType !== "string" ||
    typeof savedModifier.slug !== "string" ||
    (typeof savedModifier.modifierIndex !== "number" && typeof savedModifier.modifierIndex !== "undefined")
  ) {
    return null;
  }

  const parsedId = parseSavedModifierId(savedModifier.id);
  const language = isLanguage(savedModifier.language) ? savedModifier.language : parsedId.language;
  const item = items.find((entry) => entry.slug === savedModifier.slug || entry.slug === parsedId.slug);

  if (!item || !language) {
    return savedModifier as SavedModifier;
  }

  const local = itemForLanguage(item, language);
  const storedIndex = savedModifier.modifierIndex ?? parsedId.modifierIndex;
  const modifierIndex =
    typeof storedIndex === "number" && local.explicitModifiers[storedIndex] === savedModifier.text
      ? storedIndex
      : local.explicitModifiers.findIndex((entry) => entry === savedModifier.text);

  if (modifierIndex < 0) {
    return {
      ...(savedModifier as SavedModifier),
      language,
      slug: item.slug,
    };
  }

  return {
    id: buildSavedModifierId(item.slug, language, savedModifier.text, modifierIndex),
    text: savedModifier.text,
    itemName: local.name,
    itemBaseType: local.baseType,
    slug: item.slug,
    language,
    modifierIndex,
  };
}

function readSavedModifiers() {
  try {
    const savedValue = window.localStorage.getItem(savedModifiersStorageKey);
    if (!savedValue) return [];

    const parsedValue = JSON.parse(savedValue);
    if (!Array.isArray(parsedValue)) return [];

    const normalizedModifiers = parsedValue
      .map(normalizeSavedModifier)
      .filter((modifier): modifier is SavedModifier => Boolean(modifier));

    return Array.from(
      normalizedModifiers
        .reduce((modifiersById, modifier) => modifiersById.set(modifier.id, modifier), new Map<string, SavedModifier>())
        .values(),
    );
  } catch {
    return [];
  }
}

function App() {
  const [activeView, setActiveView] = useState<AppView>("items");
  const [language, setLanguage] = useState<Language>("kr");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [savedModifiers, setSavedModifiers] = useState<SavedModifier[]>(readSavedModifiers);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);

  useEffect(() => {
    setCategory("all");
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(savedModifiersStorageKey, JSON.stringify(savedModifiers));
  }, [savedModifiers]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => itemForLanguage(item, language).category).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, language === "kr" ? "ko" : "en"));
  }, [language]);

  const savedModifierIds = useMemo(
    () => new Set(savedModifiers.map((modifier) => modifier.id)),
    [savedModifiers],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter(
        (item) => category === "all" || itemForLanguage(item, language).category === category,
      )
      .filter((item) => !normalizedQuery || item.searchText.includes(normalizedQuery))
      .sort((a, b) => {
        const incompleteCompare = Number(isIncompleteItem(a)) - Number(isIncompleteItem(b));
        if (incompleteCompare !== 0) return incompleteCompare;

        const categoryCompare = a.category.localeCompare(b.category, "ko");
        if (categoryCompare !== 0) return categoryCompare;
        return getLevelValue(a) - getLevelValue(b) || a.kr.name.localeCompare(b.kr.name, "ko");
      });
  }, [category, language, query]);

  function saveModifier(item: UniqueItem, modifier: string, modifierIndex: number) {
    const local = itemForLanguage(item, language);
    const id = getSavedModifierId(item, language, modifier, modifierIndex);
    const legacyId = getLegacySavedModifierId(item, language, modifier);

    setSavedModifiers((current) => {
      if (current.some((saved) => saved.id === id || saved.id === legacyId)) {
        return current.filter((saved) => saved.id !== id && saved.id !== legacyId);
      }

      return [
        ...current,
        {
          id,
          text: modifier,
          itemName: local.name,
          itemBaseType: local.baseType,
          slug: item.slug,
          language,
          modifierIndex,
        },
      ];
    });
  }

  function removeModifier(id: string) {
    setSavedModifiers((current) => current.filter((modifier) => modifier.id !== id));
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-lockup">
          <div className="brand-mark">
            {activeView === "items" ? (
              <Sparkles size={22} aria-hidden="true" />
            ) : (
              <Network size={22} aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="eyebrow">Path of Exile 2</p>
            <h1>
              {activeView === "items"
                ? "Unique Items"
                : activeView === "passive-tree"
                  ? "Passive Tree"
                  : "Tree Changes"}
            </h1>
          </div>
        </div>

        <div className="header-actions">
          <nav className="main-nav" aria-label="Main menu">
            <button
              type="button"
              className={activeView === "items" ? "active" : ""}
              onClick={() => setActiveView("items")}
            >
              Unique Items
            </button>
            <button
              type="button"
              className={activeView === "passive-tree" ? "active" : ""}
              onClick={() => setActiveView("passive-tree")}
            >
              패시브 트리
            </button>
            <button
              type="button"
              className={activeView === "changelog" ? "active" : ""}
              onClick={() => setActiveView("changelog")}
            >
              변경점
            </button>
          </nav>
          {activeView === "items" ? (
            <>
              <div className="result-count" aria-live="polite">
                {filteredItems.length} / {items.length}
              </div>
              <div className="language-toggle" aria-label="Language toggle">
                <button
                  type="button"
                  className={language === "kr" ? "active" : ""}
                  onClick={() => setLanguage("kr")}
                >
                  KR
                </button>
                <button
                  type="button"
                  className={language === "en" ? "active" : ""}
                  onClick={() => setLanguage("en")}
                >
                  EN
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>

      {activeView === "items" ? (
        <main className="catalog-layout">
          <section className="catalog-panel" aria-label="Unique item catalog">
            <section className="control-panel" aria-label="Filters">
              <label className="search-box">
                <Search size={17} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="이름, 베이스, 옵션 검색"
                />
              </label>

              <label className="select-box">
                <span>종류</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option value="all">전체</option>
                  {categories.map((itemCategory) => (
                    <option key={itemCategory} value={itemCategory}>
                      {itemCategory}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            {filteredItems.length === 0 ? (
              <div className="empty-state">
                <ShieldQuestion size={18} aria-hidden="true" />
                검색 결과가 없습니다.
              </div>
            ) : (
              <div className="item-grid">
                {filteredItems.map((item) => {
                  const local = itemForLanguage(item, language);
                  const incomplete = isIncompleteItem(item);
                  return (
                    <ItemCard
                      key={item.slug}
                      item={item}
                      local={local}
                      incomplete={incomplete}
                      language={language}
                      savedModifierIds={savedModifierIds}
                      onSaveModifier={saveModifier}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <SavedModifierPanel
            language={language}
            savedModifiers={savedModifiers}
            isOpen={savedPanelOpen}
            onToggleOpen={() => setSavedPanelOpen((isOpen) => !isOpen)}
            onClose={() => setSavedPanelOpen(false)}
            onRemoveModifier={removeModifier}
          />
        </main>
      ) : activeView === "passive-tree" ? (
        <PassiveTreeView />
      ) : (
        <PassiveTreeChangelogView />
      )}
    </div>
  );
}

function PassiveTreeChangelogView() {
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [activeSection, setActiveSection] = useState<ChangelogSection>("summary");
  const [changelogQuery, setChangelogQuery] = useState("");
  const deferredChangelogQuery = useDeferredValue(changelogQuery);

  useEffect(() => {
    let canceled = false;

    fetch("/passive-tree/changelog.json")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load passive tree changelog");
        return response.json() as Promise<ChangelogData>;
      })
      .then((data) => {
        if (!canceled) setChangelog(data);
      })
      .catch(() => {
        if (!canceled) setLoadError(true);
      });

    return () => {
      canceled = true;
    };
  }, []);

  const normalizedQuery = deferredChangelogQuery.trim().toLowerCase();
  const filterNodes = (nodes: ChangelogNode[]) => {
    if (!normalizedQuery) return nodes;
    return nodes.filter((node) => {
      return [
        node.id,
        node.name,
        node.nameKr,
        node.beforeName,
        node.beforeNameKr,
        node.afterName,
        node.afterNameKr,
        node.summary,
        node.type,
        ...(node.stats ?? []),
        ...(node.statsKr ?? []),
        ...(node.beforeStats ?? []),
        ...(node.beforeStatsKr ?? []),
        ...(node.afterStats ?? []),
        ...(node.afterStatsKr ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  };

  if (loadError) {
    return (
      <main className="changelog-layout">
        <div className="empty-state">
          <ShieldQuestion size={18} aria-hidden="true" />
          변경점 데이터를 불러오지 못했습니다.
        </div>
      </main>
    );
  }

  if (!changelog) {
    return (
      <main className="changelog-layout">
        <div className="tree-loading">변경점 데이터 로딩 중...</div>
      </main>
    );
  }

  const sections: { id: ChangelogSection; label: string; count?: number }[] = [
    { id: "summary", label: "요약" },
    { id: "added", label: "추가", count: changelog.addedNodes.length },
    { id: "removed", label: "삭제", count: changelog.removedNodes.length },
    { id: "changed", label: "변경", count: changelog.changedNodes.length },
    { id: "classes", label: "전직", count: changelog.classChanges.length },
    { id: "jewels", label: "주얼", count: changelog.addedJewelSlots.length },
    { id: "overrides", label: "오버라이드", count: changelog.addedSkillOverrides.length },
    { id: "assets", label: "에셋", count: changelog.assetChanges.length },
  ];
  const visibleAddedNodes = filterNodes(changelog.addedNodes);
  const visibleRemovedNodes = filterNodes(changelog.removedNodes);
  const visibleChangedNodes = filterNodes(changelog.changedNodes);

  return (
    <main className="changelog-layout">
      <section className="changelog-panel" aria-label="Passive tree changelog">
        <div className="changelog-hero">
          <div>
            <p className="eyebrow">Passive Tree Diff</p>
            <h2>
              {changelog.versions.previous} → {changelog.versions.current}
            </h2>
          </div>
          <div className="changelog-version-badge">0.5.0 기준</div>
        </div>

        <section className="changelog-controls" aria-label="Changelog filters">
          <div className="changelog-tabs" role="tablist" aria-label="Change sections">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={activeSection === section.id ? "active" : ""}
                onClick={() => setActiveSection(section.id)}
              >
                <span>{section.label}</span>
                {section.count !== undefined ? <strong>{section.count}</strong> : null}
              </button>
            ))}
          </div>

          <label className="search-box changelog-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={changelogQuery}
              onChange={(event) => setChangelogQuery(event.target.value)}
              placeholder="노드 이름, 효과, ID 검색"
            />
          </label>
        </section>

        {activeSection === "summary" ? <ChangelogSummary changelog={changelog} /> : null}
        {activeSection === "added" ? (
          <ChangelogNodeList nodes={visibleAddedNodes} mode="added" emptyText="추가 노드 검색 결과가 없습니다." />
        ) : null}
        {activeSection === "removed" ? (
          <ChangelogNodeList nodes={visibleRemovedNodes} mode="removed" emptyText="삭제 노드 검색 결과가 없습니다." />
        ) : null}
        {activeSection === "changed" ? (
          <ChangelogNodeList nodes={visibleChangedNodes} mode="changed" emptyText="변경 노드 검색 결과가 없습니다." />
        ) : null}
        {activeSection === "classes" ? <ClassChangeList changes={changelog.classChanges} /> : null}
        {activeSection === "jewels" ? (
          <ChangelogNodeList nodes={changelog.addedJewelSlots} mode="added" emptyText="추가 주얼 슬롯이 없습니다." />
        ) : null}
        {activeSection === "overrides" ? (
          <SkillOverrideList overrides={changelog.addedSkillOverrides} />
        ) : null}
        {activeSection === "assets" ? <AssetChangeList assets={changelog.assetChanges} /> : null}
      </section>
    </main>
  );
}

function ChangelogSummary({ changelog }: { changelog: ChangelogData }) {
  const rows = [
    ["Groups", changelog.summary.groups],
    ["Nodes", changelog.summary.nodes],
    ["Edges", changelog.summary.edges],
    ["Skill Overrides", changelog.summary.skillOverrides],
    ["Jewel Slots", changelog.summary.jewelSlots],
  ] as const;

  return (
    <section className="summary-grid" aria-label="Change summary">
      {rows.map(([label, row]) => (
        <article key={label} className="summary-tile">
          <span>{label}</span>
          <strong>
            {row.before.toLocaleString()} → {row.after.toLocaleString()}
          </strong>
          <p>
            +{row.added.toLocaleString()} / -{row.removed.toLocaleString()}
            {row.changed ? ` / 변경 ${row.changed.toLocaleString()}` : ""}
          </p>
        </article>
      ))}
    </section>
  );
}

function ChangelogNodeList({
  nodes,
  mode,
  emptyText,
}: {
  nodes: ChangelogNode[];
  mode: "added" | "removed" | "changed";
  emptyText: string;
}) {
  if (nodes.length === 0) {
    return <div className="empty-state">{emptyText}</div>;
  }

  return (
    <div className="change-list">
      {nodes.map((node) => (
        <article key={node.id} className={`change-card ${mode}`}>
          <div className="change-card-header">
            <div>
              <span className="change-id">#{node.id}</span>
              <h3>
                {mode === "changed"
                  ? getLocalizedText(node.afterNameKr, node.afterName ?? node.name)
                  : getLocalizedText(node.nameKr, node.name)}
              </h3>
              {mode === "changed" && node.afterNameKr && node.afterNameKr !== node.afterName ? (
                <small>{node.afterName}</small>
              ) : mode !== "changed" && node.nameKr && node.nameKr !== node.name ? (
                <small>{node.name}</small>
              ) : null}
            </div>
            <span className="change-type">{node.summary ?? getChangelogTypeLabel(node.type)}</span>
          </div>

          <div className="change-meta">
            <span>{getChangelogTypeLabel(node.type)}</span>
            {node.group ? <span>Group {node.group}</span> : null}
            {node.fields && node.fields.length > 0 ? <span>{node.fields.join(", ")}</span> : null}
          </div>

          {mode === "changed" ? (
            <div className="diff-columns">
              <ChangeStatBlock
                title="0.4.0"
                name={node.beforeName}
                nameKr={node.beforeNameKr}
                stats={node.beforeStats}
                statsKr={node.beforeStatsKr}
              />
              <ChangeStatBlock
                title="0.5.0"
                name={node.afterName}
                nameKr={node.afterNameKr}
                stats={node.afterStats}
                statsKr={node.afterStatsKr}
              />
            </div>
          ) : (
            <ChangeStatBlock
              title={mode === "added" ? "추가 효과" : "삭제 전 효과"}
              name={node.name}
              nameKr={node.nameKr}
              stats={node.stats}
              statsKr={node.statsKr}
            />
          )}
        </article>
      ))}
    </div>
  );
}

function ChangeStatBlock({
  title,
  name,
  nameKr,
  stats = [],
  statsKr = [],
}: {
  title: string;
  name?: string;
  nameKr?: string;
  stats?: string[];
  statsKr?: string[];
}) {
  return (
    <section className="change-stat-block">
      <h4>{title}</h4>
      {name ? (
        <p>
          {getLocalizedText(nameKr, name)}
          {nameKr && nameKr !== name ? <small>{name}</small> : null}
        </p>
      ) : null}
      {stats.length > 0 ? (
        <ul>
          {stats.map((stat, index) => (
            <li key={`${stat}:${index}`} className="translated-stat">
              <span>{getLocalizedText(statsKr[index], stat)}</span>
              {statsKr[index] && statsKr[index] !== stat ? <small>{stat}</small> : null}
            </li>
          ))}
        </ul>
      ) : (
        <span>표시 효과 없음</span>
      )}
    </section>
  );
}

function ClassChangeList({ changes }: { changes: ChangelogData["classChanges"] }) {
  return (
    <div className="change-list">
      {changes.map((change) => (
        <article key={change.className} className="change-card changed">
          <div className="change-card-header">
            <div>
              <span className="change-id">Class</span>
              <h3>{getLocalizedText(change.classNameKr, change.className)}</h3>
              {change.classNameKr && change.classNameKr !== change.className ? (
                <small>{change.className}</small>
              ) : null}
            </div>
            <span className="change-type">전직 데이터 변경</span>
          </div>
          <div className="diff-columns">
            <AscendancyBlock title="0.4.0" entries={change.before} />
            <AscendancyBlock title="0.5.0" entries={change.after} />
          </div>
        </article>
      ))}
    </div>
  );
}

function AscendancyBlock({
  title,
  entries,
}: {
  title: string;
  entries: { id: string; name?: string | null; nameKr?: string | null; image?: string | null }[];
}) {
  return (
    <section className="change-stat-block">
      <h4>{title}</h4>
      {entries.length > 0 ? (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              {entry.id}: {getLocalizedText(entry.nameKr ?? undefined, entry.name ?? "비활성/미공개")}
              {entry.nameKr && entry.nameKr !== entry.name ? <small>{entry.name}</small> : null}
            </li>
          ))}
        </ul>
      ) : (
        <span>표시 전직 없음</span>
      )}
    </section>
  );
}

function SkillOverrideList({ overrides }: { overrides: ChangelogData["addedSkillOverrides"] }) {
  return (
    <div className="change-list">
      {overrides.map((entry) => (
        <article key={entry.id} className="change-card added">
          <div className="change-card-header">
            <div>
              <span className="change-id">Node #{entry.id}</span>
              <h3>
                {getLocalizedText(
                  entry.overrides[0]?.nameKr,
                  entry.overrides[0]?.name ?? "Skill override",
                )}
              </h3>
              {entry.overrides[0]?.nameKr && entry.overrides[0].nameKr !== entry.overrides[0].name ? (
                <small>{entry.overrides[0].name}</small>
              ) : null}
            </div>
            <span className="change-type">신규 오버라이드</span>
          </div>
          {entry.overrides.map((override, index) => (
            <ChangeStatBlock
              key={`${entry.id}:${index}`}
              title={override.isNotable ? "Notable override" : "Override"}
              stats={override.stats}
              statsKr={override.statsKr}
            />
          ))}
        </article>
      ))}
    </div>
  );
}

function AssetChangeList({ assets }: { assets: string[] }) {
  return (
    <div className="asset-list">
      {assets.map((asset) => (
        <article key={asset} className="asset-row">
          <span>{asset.endsWith(".json") ? "JSON" : asset.endsWith(".webp") ? "WEBP" : "DATA"}</span>
          <strong>{asset}</strong>
        </article>
      ))}
    </div>
  );
}

function PassiveTreeView() {
  const [treeData, setTreeData] = useState<PassiveTreeData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [treeQuery, setTreeQuery] = useState("");
  const [nodeType, setNodeType] = useState<PassiveNodeTypeFilter>("all");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isTreeDragging, setIsTreeDragging] = useState(false);
  const treeSvgRef = useRef<SVGSVGElement | null>(null);
  const lastDragPointRef = useRef<{ x: number; y: number } | null>(null);
  const draggedTreeRef = useRef(false);
  const pointerDownNodeIdRef = useRef<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const deferredTreeQuery = useDeferredValue(treeQuery);

  useEffect(() => {
    let canceled = false;

    fetch("/passive-tree/compact.json")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load passive tree data");
        return response.json() as Promise<PassiveTreeData>;
      })
      .then((data) => {
        if (!canceled) {
          setTreeData(data);
          const firstNotable = Object.entries(data.nodes).find(
            ([, node]) => node.isNotable,
          );
          const firstPositionedNode = Object.entries(data.nodes).find(([, node]) => node);
          setSelectedNodeId(firstNotable?.[0] ?? firstPositionedNode?.[0] ?? null);
        }
      })
      .catch(() => {
        if (!canceled) setLoadError(true);
      });

    return () => {
      canceled = true;
    };
  }, []);

  const classAscendancyIds = useMemo(() => {
    if (!treeData || selectedClass === "all") return new Set<string>();
    const treeClass = treeData.classes.find((entry) => entry.name === selectedClass);
    return new Set(treeClass?.ascendancies.map((ascendancy) => ascendancy.id) ?? []);
  }, [selectedClass, treeData]);

  const filteredNodeEntries = useMemo(() => {
    if (!treeData) return [];
    const normalizedQuery = deferredTreeQuery.trim().toLowerCase();

    return Object.entries(treeData.nodes).filter(([, node]) => {
      const matchesType =
        nodeType === "all" ||
        (nodeType === "notable" && node.isNotable) ||
        (nodeType === "keystone" && node.isKeystone) ||
        (nodeType === "ascendancy" && node.ascendancyId);
      const matchesClass =
        selectedClass === "all" ||
        !node.ascendancyId ||
        classAscendancyIds.has(node.ascendancyId);
      const matchesQuery = !normalizedQuery || node.searchText.includes(normalizedQuery);
      return matchesType && matchesClass && matchesQuery;
    });
  }, [classAscendancyIds, deferredTreeQuery, nodeType, selectedClass, treeData]);

  const visibleNodeIds = useMemo(
    () => new Set(filteredNodeEntries.map(([nodeId]) => nodeId)),
    [filteredNodeEntries],
  );

  const selectedNode = selectedNodeId && treeData ? treeData.nodes[selectedNodeId] : null;
  const hoveredNode = hoveredNodeId && treeData ? treeData.nodes[hoveredNodeId] : null;
  const treeWidth = treeData ? treeData.max_x - treeData.min_x : 1;
  const treeHeight = treeData ? treeData.max_y - treeData.min_y : 1;
  const viewBoxPadding = 900;
  const defaultViewBoxWidth = treeWidth + viewBoxPadding * 2;
  const defaultViewBoxHeight = treeHeight + viewBoxPadding * 2;
  const viewBoxWidth = defaultViewBoxWidth / zoom;
  const viewBoxHeight = defaultViewBoxHeight / zoom;
  const viewBoxCenterX = treeData ? treeData.min_x + treeWidth / 2 + panOffset.x : 0;
  const viewBoxCenterY = treeData ? treeData.min_y + treeHeight / 2 + panOffset.y : 0;
  const viewBox = treeData
    ? `${viewBoxCenterX - viewBoxWidth / 2} ${
        viewBoxCenterY - viewBoxHeight / 2
      } ${viewBoxWidth} ${viewBoxHeight}`
    : "0 0 1 1";
  const visibleLinkPaths = useMemo(() => {
    if (!treeData) return [];

    return treeData.edges
      .map((edge) => {
        if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) return "";

        const from = treeData.nodes[edge.from];
        const to = treeData.nodes[edge.to];
        if (!from || !to) return "";
        if (from.ascendancyId || to.ascendancyId) return "";

        if (Number.isFinite(edge.orbitX) && Number.isFinite(edge.orbitY)) {
          return `M ${from.x} ${from.y} Q ${edge.orbitX} ${edge.orbitY} ${to.x} ${to.y}`;
        }
        return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
      })
      .filter(Boolean);
  }, [treeData, visibleNodeIds]);
  const visibleLinkPath = visibleLinkPaths.join(" ");

  function getEventNodeId(target: EventTarget | null) {
    if (!(target instanceof SVGElement)) return null;
    return target.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null;
  }

  function selectNodeId(nodeId: string | null) {
    if (draggedTreeRef.current) return;
    if (nodeId) setSelectedNodeId(nodeId);
  }

  function handleTreePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;

    lastDragPointRef.current = { x: event.clientX, y: event.clientY };
    draggedTreeRef.current = false;
    pointerDownNodeIdRef.current = getEventNodeId(event.target);
    setIsTreeDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleTreePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const lastDragPoint = lastDragPointRef.current;
    const svgElement = treeSvgRef.current;
    if (!lastDragPoint || !svgElement) return;

    const rect = svgElement.getBoundingClientRect();
    const deltaX = event.clientX - lastDragPoint.x;
    const deltaY = event.clientY - lastDragPoint.y;
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      draggedTreeRef.current = true;
    }

    setPanOffset((currentPanOffset) => ({
      x: currentPanOffset.x - (deltaX * viewBoxWidth) / rect.width,
      y: currentPanOffset.y - (deltaY * viewBoxHeight) / rect.height,
    }));
    lastDragPointRef.current = { x: event.clientX, y: event.clientY };
  }

  function stopTreeDrag(event: React.PointerEvent<SVGSVGElement>) {
    const pressedNodeId = pointerDownNodeIdRef.current;
    lastDragPointRef.current = null;
    pointerDownNodeIdRef.current = null;
    setIsTreeDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    selectNodeId(pressedNodeId);

    window.setTimeout(() => {
      draggedTreeRef.current = false;
    }, 0);
  }

  function handleTreeNodeKeyDown(event: React.KeyboardEvent<SVGGElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectNodeId(getEventNodeId(event.target));
  }

  function handleTreeNodeHover(nodeId: string, event: React.PointerEvent<SVGCircleElement>) {
    const stageRect = event.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!stageRect) return;
    const maxTooltipX = Math.max(12, stageRect.width - 304);
    setHoveredNodeId(nodeId);
    setTooltipPosition({
      x: Math.min(Math.max(event.clientX - stageRect.left + 14, 12), maxTooltipX),
      y: Math.min(Math.max(event.clientY - stageRect.top, 72), stageRect.height - 72),
    });
  }

  if (loadError) {
    return (
      <main className="tree-layout">
        <div className="empty-state">
          <ShieldQuestion size={18} aria-hidden="true" />
          패시브 트리 데이터를 불러오지 못했습니다.
        </div>
      </main>
    );
  }

  if (!treeData) {
    return (
      <main className="tree-layout">
        <div className="tree-loading">패시브 트리 데이터 로딩 중...</div>
      </main>
    );
  }

  return (
    <main className="tree-layout">
      <section className="tree-panel" aria-label="Passive skill tree">
        <section className="tree-toolbar" aria-label="Passive tree filters">
          <label className="search-box tree-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={treeQuery}
              onChange={(event) => setTreeQuery(event.target.value)}
              placeholder="노드 이름 또는 효과 검색"
            />
          </label>

          <label className="select-box">
            <span>직업</span>
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              <option value="all">전체</option>
              {treeData.classes.map((treeClass) => (
                <option key={treeClass.name} value={treeClass.name}>
                  {getLocalizedText(treeClass.nameKr, treeClass.name)}
                </option>
              ))}
            </select>
          </label>

          <label className="select-box">
            <span>노드</span>
            <select
              value={nodeType}
              onChange={(event) => setNodeType(event.target.value as PassiveNodeTypeFilter)}
            >
              <option value="all">전체</option>
              <option value="notable">Notable</option>
              <option value="keystone">Keystone</option>
              <option value="ascendancy">Ascendancy</option>
            </select>
          </label>

          <div className="zoom-control" aria-label="Tree zoom">
            <ZoomOut size={16} aria-hidden="true" />
            <input
              type="range"
              min="0.45"
              max="4"
              step="0.05"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
            <span className="zoom-value">{Math.round(zoom * 100)}%</span>
            <ZoomIn size={16} aria-hidden="true" />
          </div>
        </section>

        <div className="tree-meta">
          <span>{filteredNodeEntries.length.toLocaleString()} nodes</span>
          <span>{visibleLinkPaths.length.toLocaleString()} links</span>
          <span>{treeData.classes.length} classes</span>
        </div>

        <div className="tree-stage">
          <svg
            ref={treeSvgRef}
            className={isTreeDragging ? "dragging" : undefined}
            viewBox={viewBox}
            role="img"
            aria-label="Path of Exile 2 passive skill tree"
            onPointerDown={handleTreePointerDown}
            onPointerMove={handleTreePointerMove}
            onPointerUp={stopTreeDrag}
            onPointerCancel={stopTreeDrag}
            onPointerLeave={stopTreeDrag}
          >
            <defs>
              <radialGradient id="treeNodeFill" cx="42%" cy="35%" r="68%">
                <stop offset="0%" stopColor="#f4d08d" />
                <stop offset="55%" stopColor="#b87330" />
                <stop offset="100%" stopColor="#41220d" />
              </radialGradient>
              <radialGradient id="treeKeystoneFill" cx="42%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#f3e2bd" />
                <stop offset="52%" stopColor="#d09a4d" />
                <stop offset="100%" stopColor="#503018" />
              </radialGradient>
            </defs>

            <image
              className="tree-class-art"
              href={`/passive-tree/assets/background-${getClassBackgroundName(selectedClass)}.webp`}
              x={-4200}
              y={-4200}
              width={8400}
              height={8400}
              preserveAspectRatio="xMidYMid slice"
            />

            <g className="tree-links">{visibleLinkPath ? <path d={visibleLinkPath} /> : null}</g>

            <g
              className="tree-nodes"
              onKeyDown={handleTreeNodeKeyDown}
            >
              {filteredNodeEntries.map(([nodeId, node]) => (
                <circle
                  key={nodeId}
                  className={getNodeClassName(node, selectedNodeId === nodeId)}
                  role="button"
                  tabIndex={0}
                  data-node-id={nodeId}
                  aria-label={`${getLocalizedText(node.nameKr, node.name)} ${getNodeType(node)}`}
                  cx={node.x}
                  cy={node.y}
                  r={getNodeRadius(node)}
                  onClick={() => selectNodeId(nodeId)}
                  onPointerEnter={(event) => handleTreeNodeHover(nodeId, event)}
                  onPointerMove={(event) => handleTreeNodeHover(nodeId, event)}
                  onPointerLeave={() => setHoveredNodeId(null)}
                />
              ))}
            </g>
          </svg>

          {hoveredNode ? (
            <div
              className="tree-tooltip"
              style={{
                left: tooltipPosition.x,
                top: tooltipPosition.y,
              }}
            >
              <span>{getNodeType(hoveredNode)}</span>
              <strong>{getLocalizedText(hoveredNode.nameKr, hoveredNode.name)}</strong>
              <p>{getPassiveNodeSummary(hoveredNode)}</p>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="node-panel" aria-label="Selected passive node">
        {selectedNode ? (
          <>
            <div className="node-panel-header">
              <span>{getNodeType(selectedNode)}</span>
              <h2>{getLocalizedText(selectedNode.nameKr, selectedNode.name)}</h2>
              {selectedNode.nameKr && selectedNode.nameKr !== selectedNode.name ? (
                <p className="node-original">{selectedNode.name}</p>
              ) : null}
              {selectedNode.ascendancyId ? <p>{selectedNode.ascendancyId}</p> : null}
            </div>

            {selectedNode.stats && selectedNode.stats.length > 0 ? (
              <section className="info-section accent">
                <h3>Effects</h3>
                <ul>
                  {selectedNode.stats.map((stat, index) => {
                    const statKr = selectedNode.statsKr?.[index];
                    return (
                      <li key={`${stat}:${index}`} className="translated-stat">
                        <span>{getLocalizedText(statKr, stat)}</span>
                        {statKr && statKr !== stat ? <small>{stat}</small> : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : (
              <p className="node-empty">표시할 효과가 없습니다.</p>
            )}

            {selectedNode.flavourText && selectedNode.flavourText.length > 0 ? (
              <blockquote>
                {selectedNode.flavourText.map((text, index) => {
                  const textKr = selectedNode.flavourTextKr?.[index];
                  return (
                    <span key={`${text}:${index}`} className="translated-flavour">
                      <span>{getLocalizedText(textKr, text)}</span>
                      {textKr && textKr !== text ? <small>{text}</small> : null}
                    </span>
                  );
                })}
              </blockquote>
            ) : null}
          </>
        ) : (
          <div className="saved-empty">트리에서 노드를 선택하세요.</div>
        )}
      </aside>
    </main>
  );
}

type ItemCardProps = {
  item: UniqueItem;
  local: LocalizedItem;
  incomplete: boolean;
  language: Language;
  savedModifierIds: Set<string>;
  onSaveModifier: (item: UniqueItem, modifier: string, modifierIndex: number) => void;
};

function ItemCard({
  item,
  local,
  incomplete,
  language,
  savedModifierIds,
  onSaveModifier,
}: ItemCardProps) {
  return (
    <article className={incomplete ? "item-card incomplete" : "item-card"}>
      <div className="item-card-top">
        <div className="item-thumb">
          {item.imagePath ? (
            <img src={item.imagePath} alt={`${local.name} item art`} loading="lazy" />
          ) : (
            <div className="missing-image compact">
              <BookOpen size={24} aria-hidden="true" />
              No image
            </div>
          )}
        </div>

        <div className="item-summary">
          <div className="item-titlebar">
            <p>{local.baseType}</p>
            <h2>{local.name}</h2>
            <span>{local.category}</span>
          </div>

          {incomplete ? <span className="status-badge">정보 확인 필요</span> : null}

          <div className="quick-facts">
            <InfoSection title="Properties" entries={local.properties} compact />
            <InfoSection title="Requirements" entries={local.requirements} compact />
            <InfoSection
              title="Implicit modifiers"
              entries={local.implicitModifiers}
              compact
              accent
            />
          </div>
        </div>
      </div>

      <ModifierSection
        item={item}
        language={language}
        entries={local.explicitModifiers}
        savedModifierIds={savedModifierIds}
        onSaveModifier={onSaveModifier}
      />

      <div className="card-footer">
        <span>{languageLabel(language)} display</span>
        <a href={local.source} target="_blank" rel="noreferrer" aria-label={`${local.name} source`}>
          <ExternalLink size={15} aria-hidden="true" />
          PoE2DB
        </a>
      </div>
    </article>
  );
}

type ModifierSectionProps = {
  item: UniqueItem;
  language: Language;
  entries: string[];
  savedModifierIds: Set<string>;
  onSaveModifier: (item: UniqueItem, modifier: string, modifierIndex: number) => void;
};

function ModifierSection({
  item,
  language,
  entries,
  savedModifierIds,
  onSaveModifier,
}: ModifierSectionProps) {
  if (entries.length === 0) {
    return (
      <section className="info-section explicit">
        <h3>Explicit modifiers</h3>
        <p className="muted">No explicit modifiers.</p>
      </section>
    );
  }

  return (
    <section className="info-section explicit">
      <h3>Explicit modifiers</h3>
      <ul>
        {entries.map((entry, index) => {
          const id = getSavedModifierId(item, language, entry, index);
          const saved = savedModifierIds.has(id);
          return (
            <li key={id}>
              <button
                type="button"
                className={saved ? "modifier-button saved" : "modifier-button"}
                onClick={() => onSaveModifier(item, entry, index)}
                aria-pressed={saved}
              >
                {entry}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type SavedModifierPanelProps = {
  language: Language;
  savedModifiers: SavedModifier[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onRemoveModifier: (id: string) => void;
};

function SavedModifierPanel({
  language,
  savedModifiers,
  isOpen,
  onToggleOpen,
  onClose,
  onRemoveModifier,
}: SavedModifierPanelProps) {
  return (
    <>
      <button
        type="button"
        className="saved-mobile-trigger"
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        aria-controls="saved-modifier-panel"
      >
        <Bookmark size={17} aria-hidden="true" />
        저장한 속성
        <strong>{savedModifiers.length}</strong>
      </button>

      {isOpen ? <button className="saved-scrim" type="button" onClick={onClose} aria-label="닫기" /> : null}

      <aside
        id="saved-modifier-panel"
        className={isOpen ? "saved-panel open" : "saved-panel"}
        aria-label="Saved explicit modifiers"
      >
      <div className="saved-header">
        <Globe2 size={18} aria-hidden="true" />
        <div>
          <span>{languageLabel(language)} display</span>
          <strong>저장한 속성 {savedModifiers.length}</strong>
        </div>
        <button type="button" className="saved-close" onClick={onClose} aria-label="저장한 속성 닫기">
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      {savedModifiers.length === 0 ? (
        <div className="saved-empty">
          Explicit modifier를 클릭하면 이곳에 따로 저장됩니다.
        </div>
      ) : (
        <ul className="saved-list">
          {savedModifiers.map((modifier) => (
            <li key={modifier.id} className="saved-item">
              <p>{modifier.text}</p>
              <small>
                {modifier.itemName} · {modifier.itemBaseType}
              </small>
              <button
                type="button"
                onClick={() => onRemoveModifier(modifier.id)}
                aria-label={`${modifier.text} 삭제`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      </aside>
    </>
  );
}

type InfoSectionProps = {
  title: string;
  entries: string[];
  accent?: boolean;
  compact?: boolean;
};

function InfoSection({ title, entries, accent = false, compact = false }: InfoSectionProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section
      className={`${accent ? "info-section accent" : "info-section"}${
        compact ? " compact" : ""
      }`}
    >
      <h3>{title}</h3>
      <ul>
        {entries.map((entry) => (
          <li key={entry}>{entry}</li>
        ))}
      </ul>
    </section>
  );
}

export default App;
