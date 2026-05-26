import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  Globe2,
  Search,
  ShieldQuestion,
  Sparkles,
  Trash2,
} from "lucide-react";
import { items } from "./generated/items";
import type { Language, LocalizedItem, UniqueItem } from "./generated/items";

type SavedModifier = {
  id: string;
  text: string;
  itemName: string;
  itemBaseType: string;
  slug: string;
};

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

function App() {
  const [language, setLanguage] = useState<Language>("kr");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [savedModifiers, setSavedModifiers] = useState<SavedModifier[]>([]);

  useEffect(() => {
    setCategory("all");
  }, [language]);

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
            <Sparkles size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">Path of Exile 2</p>
            <h1>Unique Items</h1>
          </div>
        </div>

        <div className="header-actions">
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
        </div>
      </header>

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
          onRemoveModifier={removeModifier}
        />
      </main>
    </div>
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
  onRemoveModifier: (id: string) => void;
};

function SavedModifierPanel({
  language,
  savedModifiers,
  onRemoveModifier,
}: SavedModifierPanelProps) {
  return (
    <aside className="saved-panel" aria-label="Saved explicit modifiers">
      <div className="saved-header">
        <Globe2 size={18} aria-hidden="true" />
        <div>
          <span>{languageLabel(language)} display</span>
          <strong>저장한 속성 {savedModifiers.length}</strong>
        </div>
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
