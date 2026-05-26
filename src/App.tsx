import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  Globe2,
  Search,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import { items } from "./generated/items";
import type { Language, LocalizedItem, UniqueItem } from "./generated/items";

const defaultItem = items.find((item) => item.slug === "brynhands-mark") ?? items[0];

function slugFromPath() {
  const match = window.location.pathname.match(/^\/items\/([^/]+)\/?$/);
  return match?.[1] ?? defaultItem.slug;
}

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

function App() {
  const [language, setLanguage] = useState<Language>("kr");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedSlug, setSelectedSlug] = useState(slugFromPath);

  useEffect(() => {
    const syncPath = () => setSelectedSlug(slugFromPath());
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort(),
    [],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => category === "all" || item.category === category)
      .filter((item) => !normalizedQuery || item.searchText.includes(normalizedQuery))
      .sort((a, b) => {
        const categoryCompare = a.category.localeCompare(b.category, "ko");
        if (categoryCompare !== 0) return categoryCompare;
        return getLevelValue(a) - getLevelValue(b) || a.kr.name.localeCompare(b.kr.name, "ko");
      });
  }, [category, query]);

  const selectedItem =
    items.find((item) => item.slug === selectedSlug) ?? filteredItems[0] ?? defaultItem;
  const selectedLocal = itemForLanguage(selectedItem, language);

  function selectItem(slug: string) {
    setSelectedSlug(slug);
    const nextPath = `/items/${slug}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
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
              disabled={!selectedItem.en}
            >
              EN
            </button>
          </div>
          <a className="source-link" href={selectedLocal.source} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            PoE2DB
          </a>
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar" aria-label="Item navigation">
          <section className="control-panel">
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

          <details className="mobile-list">
            <summary>
              <span>아이템 목록</span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <ItemList
              items={filteredItems}
              language={language}
              selectedSlug={selectedItem.slug}
              onSelect={selectItem}
            />
          </details>

          <div className="desktop-list">
            <div className="list-heading">
              <span>아이템 목록</span>
              <strong>{filteredItems.length}</strong>
            </div>
            <ItemList
              items={filteredItems}
              language={language}
              selectedSlug={selectedItem.slug}
              onSelect={selectItem}
            />
          </div>
        </aside>

        <ItemDetail item={selectedItem} local={selectedLocal} language={language} />
      </main>
    </div>
  );
}

type ItemListProps = {
  items: UniqueItem[];
  language: Language;
  selectedSlug: string;
  onSelect: (slug: string) => void;
};

function ItemList({ items: listItems, language, selectedSlug, onSelect }: ItemListProps) {
  if (listItems.length === 0) {
    return (
      <div className="empty-state">
        <ShieldQuestion size={18} aria-hidden="true" />
        검색 결과가 없습니다.
      </div>
    );
  }

  return (
    <nav className="item-list">
      {listItems.map((item) => {
        const local = itemForLanguage(item, language);
        return (
          <button
            type="button"
            key={item.slug}
            className={item.slug === selectedSlug ? "item-row selected" : "item-row"}
            onClick={() => onSelect(item.slug)}
          >
            <span className="item-row-title">{local.name}</span>
            <span className="item-row-meta">
              {local.baseType}
              {item.imagePath ? "" : " · 이미지 없음"}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

type ItemDetailProps = {
  item: UniqueItem;
  local: LocalizedItem;
  language: Language;
};

function ItemDetail({ item, local, language }: ItemDetailProps) {
  return (
    <article className="detail-panel">
      <div className="detail-grid">
        <section className="item-card" aria-labelledby="item-title">
          <div className="item-titlebar">
            <p>{local.baseType}</p>
            <h2 id="item-title">{local.name}</h2>
            <span>{local.category}</span>
          </div>

          <div className="item-visual">
            {item.imagePath ? (
              <img src={item.imagePath} alt={`${local.name} item art`} />
            ) : (
              <div className="missing-image">
                <BookOpen size={34} aria-hidden="true" />
                No image
              </div>
            )}
          </div>

          <InfoSection title="Properties" entries={local.properties} />
          <InfoSection title="Requirements" entries={local.requirements} />
          <InfoSection title="Implicit modifiers" entries={local.implicitModifiers} accent />
          <InfoSection title="Explicit modifiers" entries={local.explicitModifiers} accent />

          {local.flavourText ? <blockquote>{local.flavourText}</blockquote> : null}
        </section>

        <aside className="metadata-panel">
          <div className="metadata-header">
            <Globe2 size={18} aria-hidden="true" />
            <div>
              <span>{languageLabel(language)} display</span>
              <strong>{local.sourceKey}</strong>
            </div>
          </div>

          <dl className="fact-list">
            <div>
              <dt>한국어명</dt>
              <dd>{item.kr.name}</dd>
            </div>
            <div>
              <dt>English</dt>
              <dd>{item.en?.name ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Slug</dt>
              <dd>{item.slug}</dd>
            </div>
          </dl>

          <div className="attribute-table">
            <h3>poe2db attributes</h3>
            {local.attributes.length > 0 ? (
              <table>
                <tbody>
                  {local.attributes.map((attribute) => (
                    <tr key={`${attribute.name}-${attribute.value}`}>
                      <th>{attribute.name}</th>
                      <td>{attribute.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No attributes.</p>
            )}
          </div>

          <a className="wide-link" href={local.source} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            원본 페이지 열기
          </a>
        </aside>
      </div>

      <footer className="attribution">
        Item data is sourced from PoE2DB and preserved here as a static reference view.
      </footer>
    </article>
  );
}

type InfoSectionProps = {
  title: string;
  entries: string[];
  accent?: boolean;
};

function InfoSection({ title, entries, accent = false }: InfoSectionProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className={accent ? "info-section accent" : "info-section"}>
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
