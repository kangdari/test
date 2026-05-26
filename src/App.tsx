import { useEffect, useMemo, useState } from "react";
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

type AppView = "items" | "passive-tree";

type SavedModifier = {
  id: string;
  text: string;
  itemName: string;
  itemBaseType: string;
  slug: string;
};

type PassiveTreeClass = {
  name: string;
  base_str: number;
  base_dex: number;
  base_int: number;
  ascendancies: { id: string; name: string }[];
};

type PassiveTreeNode = {
  skill: number;
  name: string;
  icon?: string;
  stats?: string[];
  flavourText?: string[];
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  ascendancyId?: string;
  x?: number;
  y?: number;
};

type PassiveTreeEdge = {
  from: string | number;
  to: string | number;
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
  if (selected) classes.push("selected");
  return classes.join(" ");
}

function getNodeAffinity(node: PassiveTreeNode) {
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
  return "neutral";
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

function stripStatMarkup(value: string) {
  return value.replace(/\[([^\]|]+)\|([^\]]+)\]/g, "$2").replace(/\[([^\]]+)\]/g, "$1");
}

function hasTreePosition(node: PassiveTreeNode) {
  return Number.isFinite(node.x) && Number.isFinite(node.y);
}

function readSavedModifiers() {
  try {
    const savedValue = window.localStorage.getItem(savedModifiersStorageKey);
    if (!savedValue) return [];

    const parsedValue = JSON.parse(savedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue.filter((modifier): modifier is SavedModifier => {
      return (
        typeof modifier?.id === "string" &&
        typeof modifier.text === "string" &&
        typeof modifier.itemName === "string" &&
        typeof modifier.itemBaseType === "string" &&
        typeof modifier.slug === "string"
      );
    });
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

  function saveModifier(item: UniqueItem, modifier: string) {
    const local = itemForLanguage(item, language);
    const id = `${item.slug}:${language}:${modifier}`;

    setSavedModifiers((current) => {
      if (current.some((saved) => saved.id === id)) return current;
      return [
        ...current,
        {
          id,
          text: modifier,
          itemName: local.name,
          itemBaseType: local.baseType,
          slug: item.slug,
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
            <h1>{activeView === "items" ? "Unique Items" : "Passive Tree"}</h1>
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
      ) : (
        <PassiveTreeView />
      )}
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

  useEffect(() => {
    let canceled = false;

    fetch("/passive-tree/data.json")
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load passive tree data");
        return response.json() as Promise<PassiveTreeData>;
      })
      .then((data) => {
        if (!canceled) {
          setTreeData(data);
          const firstNotable = Object.entries(data.nodes).find(
            ([, node]) => node.isNotable && hasTreePosition(node),
          );
          const firstPositionedNode = Object.entries(data.nodes).find(([, node]) =>
            hasTreePosition(node),
          );
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
    const normalizedQuery = treeQuery.trim().toLowerCase();

    return Object.entries(treeData.nodes).filter(([, node]) => {
      if (!hasTreePosition(node)) return false;
      const matchesType =
        nodeType === "all" ||
        (nodeType === "notable" && node.isNotable) ||
        (nodeType === "keystone" && node.isKeystone) ||
        (nodeType === "ascendancy" && node.ascendancyId);
      const matchesClass =
        selectedClass === "all" ||
        !node.ascendancyId ||
        classAscendancyIds.has(node.ascendancyId);
      const searchableText = [node.name, ...(node.stats ?? [])].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
      return matchesType && matchesClass && matchesQuery;
    });
  }, [classAscendancyIds, nodeType, selectedClass, treeData, treeQuery]);

  const visibleNodeIds = useMemo(
    () => new Set(filteredNodeEntries.map(([nodeId]) => nodeId)),
    [filteredNodeEntries],
  );

  const selectedNode = selectedNodeId && treeData ? treeData.nodes[selectedNodeId] : null;
  const treeWidth = treeData ? treeData.max_x - treeData.min_x : 1;
  const treeHeight = treeData ? treeData.max_y - treeData.min_y : 1;
  const viewBoxPadding = 1400 / zoom;
  const viewBox = treeData
    ? `${treeData.min_x - viewBoxPadding} ${treeData.min_y - viewBoxPadding} ${
        treeWidth + viewBoxPadding * 2
      } ${treeHeight + viewBoxPadding * 2}`
    : "0 0 1 1";

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
                  {treeClass.name}
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
              min="0.7"
              max="2.2"
              step="0.1"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
            <ZoomIn size={16} aria-hidden="true" />
          </div>
        </section>

        <div className="tree-meta">
          <span>{filteredNodeEntries.length.toLocaleString()} nodes</span>
          <span>{treeData.edges.length.toLocaleString()} links</span>
          <span>{treeData.classes.length} classes</span>
        </div>

        <div className="tree-stage">
          <svg viewBox={viewBox} role="img" aria-label="Path of Exile 2 passive skill tree">
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

            <g className="tree-links">
              {treeData.edges.map((edge) => {
                const fromId = String(edge.from);
                const toId = String(edge.to);
                const from = treeData.nodes[fromId];
                const to = treeData.nodes[toId];
                if (
                  !from ||
                  !to ||
                  !hasTreePosition(from) ||
                  !hasTreePosition(to) ||
                  !visibleNodeIds.has(fromId) ||
                  !visibleNodeIds.has(toId)
                ) {
                  return null;
                }

                return (
                  <path
                    key={`${fromId}-${toId}`}
                    d={
                      Number.isFinite(edge.orbitX) && Number.isFinite(edge.orbitY)
                        ? `M ${from.x} ${from.y} Q ${edge.orbitX} ${edge.orbitY} ${to.x} ${to.y}`
                        : `M ${from.x} ${from.y} L ${to.x} ${to.y}`
                    }
                  />
                );
              })}
            </g>

            <g className="tree-nodes">
              {filteredNodeEntries.map(([nodeId, node]) => (
                <g
                  key={nodeId}
                  className="tree-node-button"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedNodeId(nodeId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedNodeId(nodeId);
                    }
                  }}
                  aria-label={`${node.name} ${getNodeType(node)}`}
                >
                  <circle
                    className={`${getNodeClassName(node, selectedNodeId === nodeId)} ${getNodeAffinity(
                      node,
                    )}`}
                    cx={node.x}
                    cy={node.y}
                    r={getNodeRadius(node)}
                  />
                </g>
              ))}
            </g>
          </svg>
        </div>
      </section>

      <aside className="node-panel" aria-label="Selected passive node">
        {selectedNode ? (
          <>
            <div className="node-panel-header">
              <span>{getNodeType(selectedNode)}</span>
              <h2>{selectedNode.name}</h2>
              {selectedNode.ascendancyId ? <p>{selectedNode.ascendancyId}</p> : null}
            </div>

            {selectedNode.stats && selectedNode.stats.length > 0 ? (
              <section className="info-section accent">
                <h3>Effects</h3>
                <ul>
                  {selectedNode.stats.map((stat) => (
                    <li key={stat}>{stripStatMarkup(stat)}</li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="node-empty">표시할 효과가 없습니다.</p>
            )}

            {selectedNode.flavourText && selectedNode.flavourText.length > 0 ? (
              <blockquote>{selectedNode.flavourText.map(stripStatMarkup).join(" ")}</blockquote>
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
  onSaveModifier: (item: UniqueItem, modifier: string) => void;
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
  onSaveModifier: (item: UniqueItem, modifier: string) => void;
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
        {entries.map((entry) => {
          const saved = savedModifierIds.has(`${item.slug}:${language}:${entry}`);
          return (
            <li key={entry}>
              <button
                type="button"
                className={saved ? "modifier-button saved" : "modifier-button"}
                onClick={() => onSaveModifier(item, entry)}
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
