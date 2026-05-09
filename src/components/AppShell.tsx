'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import cloud from 'd3-cloud';
import type { Book, Chapter, VerseWithRef, RandomVerse, Wallpaper, MenuItem, GalleryGroup, GalleryImage } from '@/lib/database';

type View = 'hero' | 'reader' | 'dictionary' | 'wordcloud';
type ViewMode = 'kjv' | 'modern' | 'both';
type Testament = 'OLD' | 'NEW';

const FONTS: { label: string; value: string }[] = [
  { label: 'Lora',               value: "'Lora', Georgia, serif" },
  { label: 'Crimson Pro',        value: "'Crimson Pro', Garamond, Georgia, serif" },
  { label: 'Cormorant Garamond', value: "'Cormorant Garamond', Garamond, Georgia, serif" },
  { label: 'EB Garamond',        value: "'EB Garamond', Garamond, Georgia, serif" },
  { label: 'Gentium',            value: "'Gentium Book Plus', Georgia, serif" },
  { label: 'Vollkorn',           value: "'Vollkorn', Georgia, serif" },
  { label: 'Merriweather',       value: "'Merriweather', Georgia, serif" },
  { label: 'Playfair Display',   value: "'Playfair Display', Georgia, serif" },
  { label: 'Libre Baskerville',  value: "'Libre Baskerville', Georgia, serif" },
  { label: 'Source Serif 4',     value: "'Source Serif 4', Georgia, serif" },
  { label: 'Georgia',            value: 'Georgia, serif' },
  { label: 'Cinzel',             value: "'Cinzel', 'Times New Roman', serif" },
  { label: 'Blackletter',        value: "'UnifrakturMaguntia', cursive" },
  { label: 'Inter',              value: "'Inter', system-ui, sans-serif" },
  { label: 'Noto Sans',          value: "'Noto Sans', system-ui, sans-serif" },
  { label: 'System',             value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" },
  { label: 'Mono',               value: "'Courier New', monospace" },
];

interface SearchResult {
  id: number;
  verse_number: number;
  text: string;
  chapter_number: number;
  book_id: number;
  book_name: string;
  testament: string;
}

interface Props {
  initialBooks: Book[];
  initialChapters: Chapter[];
  initialVerses: VerseWithRef[];
  heroVerse: RandomVerse | null;
  wallpapers: Wallpaper[];
  menuItems: MenuItem[];
  galleryGroups: GalleryGroup[];
}

// ── Main Shell ──────────────────────────────────────────────────────────────

export default function AppShell({
  initialBooks,
  initialChapters,
  initialVerses,
  heroVerse,
  wallpapers,
  menuItems,
  galleryGroups,
}: Props) {
  const [view, setView] = useState<View>('hero');
  const [contentOpacity, setContentOpacity] = useState(1);

  // Reader state
  const [selectedBook, setSelectedBook]       = useState<Book>(initialBooks[0]);
  const [chapters, setChapters]               = useState<Chapter[]>(initialChapters);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(initialChapters[0]?.id ?? null);
  const [verses, setVerses]                   = useState<VerseWithRef[]>(initialVerses);
  const [loading, setLoading]                 = useState(false);
  const [fontSize, setFontSize]               = useState(17);
  const [fontFamily, setFontFamily]           = useState(FONTS[0].value);
  const [viewMode, setViewMode]               = useState<ViewMode>('kjv');

  // Reader wallpaper slideshow
  const [readerSlideIdx, setReaderSlideIdx] = useState(() =>
    wallpapers.length > 0 ? Math.floor(Math.random() * wallpapers.length) : 0
  );
  const [readerPlaying, setReaderPlaying] = useState(true);
  const [readerSpeed, setReaderSpeed]     = useState<1 | 2 | 4>(1);
  const readerSlideTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const readerWallpaper = wallpapers[readerSlideIdx] ?? null;

  const READER_INTERVALS: Record<1 | 2 | 4, number> = { 1: 8000, 2: 4000, 4: 2000 };

  useEffect(() => {
    if (readerSlideTimer.current) clearInterval(readerSlideTimer.current);
    if (!readerPlaying || wallpapers.length <= 1) return;
    readerSlideTimer.current = setInterval(() => {
      setReaderSlideIdx(i => (i + 1) % wallpapers.length);
    }, READER_INTERVALS[readerSpeed]);
    return () => { if (readerSlideTimer.current) clearInterval(readerSlideTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerPlaying, readerSpeed, wallpapers.length]);

  // Search state
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const mainRef       = useRef<HTMLElement>(null);
  const searchRef     = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentChapterIndex = chapters.findIndex(c => c.id === selectedChapterId);

  // Smooth view transition
  function navigateTo(newView: View) {
    if (newView === view) return;
    setContentOpacity(0);
    setTimeout(() => {
      setView(newView);
      requestAnimationFrame(() => requestAnimationFrame(() => setContentOpacity(1)));
    }, 240);
  }

  // Close search on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.data ?? []);
      setSearchOpen(true);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  function onSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(q), 300);
  }

  async function handleSelectBook(book: Book) {
    if (book.id === selectedBook?.id) return;
    setSelectedBook(book);
    setLoading(true);
    try {
      const chapRes  = await fetch(`/api/chapters/${book.id}`);
      const chapData = await chapRes.json();
      const newChapters: Chapter[] = chapData.data ?? [];
      setChapters(newChapters);
      if (newChapters.length > 0) {
        setSelectedChapterId(newChapters[0].id);
        const verseRes  = await fetch(`/api/verses/${newChapters[0].id}`);
        const verseData = await verseRes.json();
        setVerses(verseData.data ?? []);
      } else {
        setSelectedChapterId(null);
        setVerses([]);
      }
    } finally {
      setLoading(false);
      mainRef.current?.scrollTo({ top: 0 });
    }
  }

  async function handleSelectChapter(chapter: Chapter) {
    setSelectedChapterId(chapter.id);
    setLoading(true);
    try {
      const res  = await fetch(`/api/verses/${chapter.id}`);
      const data = await res.json();
      setVerses(data.data ?? []);
    } finally {
      setLoading(false);
      mainRef.current?.scrollTo({ top: 0 });
    }
  }

  async function handleSelectResult(result: SearchResult) {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);

    const book = initialBooks.find(b => b.id === result.book_id);
    if (!book) return;

    setSelectedBook(book);
    setLoading(true);
    try {
      const chapRes  = await fetch(`/api/chapters/${book.id}`);
      const chapData = await chapRes.json();
      const newChapters: Chapter[] = chapData.data ?? [];
      setChapters(newChapters);

      const chapter = newChapters.find(c => c.number === result.chapter_number);
      if (chapter) {
        setSelectedChapterId(chapter.id);
        const verseRes  = await fetch(`/api/verses/${chapter.id}`);
        const verseData = await verseRes.json();
        setVerses(verseData.data ?? []);
        setTimeout(() => {
          document.getElementById(`verse-${result.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    } finally {
      setLoading(false);
      if (view !== 'reader') navigateTo('reader');
    }
  }

  function prevChapter() {
    if (currentChapterIndex > 0) handleSelectChapter(chapters[currentChapterIndex - 1]);
  }

  function nextChapter() {
    if (currentChapterIndex < chapters.length - 1) handleSelectChapter(chapters[currentChapterIndex + 1]);
  }

  const oldTestament = initialBooks.filter(b => b.testament === 'OLD');
  const newTestament = initialBooks.filter(b => b.testament === 'NEW');

  // Map menu_link to View — fallback to 'hero' for unknown links
  const viewFromLink = (link: string | null): View => {
    const map: Record<string, View> = { hero: 'hero', reader: 'reader', dictionary: 'dictionary', wordcloud: 'wordcloud' };
    return map[link ?? ''] ?? 'hero';
  };

  return (
    <div className="relative min-h-screen">

      {/* ── Fixed Header ────────────────────────────────────────────────────── */}
      <header className={`site-header ${view === 'hero' ? 'on-hero' : 'on-content'}`}>
        <button className="site-logo" onClick={() => navigateTo('hero')}>
          Daily <span>Grace</span> Now
        </button>
        <nav className="header-nav">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`nav-link ${view === viewFromLink(item.menu_link) ? 'active' : ''}`}
              onClick={() => navigateTo(viewFromLink(item.menu_link))}
            >
              {item.menu_text_str}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Content with fade transition ────────────────────────────────────── */}
      <div style={{ opacity: contentOpacity, transition: 'opacity 0.24s ease' }}>

        {/* HERO + GALLERY (scrollable home) */}
        {view === 'hero' && (
          <>
            <HeroSection
              heroVerse={heroVerse}
              wallpapers={wallpapers}
              onNavigate={navigateTo}
            />
            <GallerySection groups={galleryGroups} />
          </>
        )}

        {/* READER */}
        {view === 'reader' && (
          <>
            {/* Fixed wallpaper slideshow */}
            {readerWallpaper && (
              <>
                <img
                  key={readerWallpaper.file_id}
                  src={`/api/images/${readerWallpaper.file_id}`}
                  alt=""
                  style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 0, animation: 'heroKenBurns 16s ease-in-out forwards' }}
                />
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,10,7,0.68)', zIndex: 1 }} />
              </>
            )}

            {/* Slideshow controls — floating pill bottom-right */}
            {wallpapers.length > 1 && (
              <div style={{
                position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 10,
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                background: 'rgba(12,10,7,0.72)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(200,168,107,0.18)', borderRadius: '9999px',
                padding: '0.35rem 0.75rem', fontSize: '0.72rem', color: 'var(--parchment-dim)',
              }}>
                <button
                  onClick={() => setReaderPlaying(p => !p)}
                  title={readerPlaying ? 'Pause slideshow' : 'Play slideshow'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gold)', fontSize: '0.9rem', lineHeight: 1, padding: '0 0.1rem' }}
                >
                  {readerPlaying ? '⏸' : '▶'}
                </button>
                <span style={{ width: '1px', height: '14px', background: 'rgba(200,168,107,0.25)', margin: '0 0.15rem' }} />
                {([1, 2, 4] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => { setReaderSpeed(s); setReaderPlaying(true); }}
                    style={{
                      background: readerSpeed === s ? 'rgba(200,168,107,0.18)' : 'none',
                      border: 'none', cursor: 'pointer', borderRadius: '9999px',
                      padding: '0.15rem 0.45rem', fontSize: '0.68rem',
                      color: readerSpeed === s ? 'var(--gold)' : 'var(--mist)',
                      fontWeight: readerSpeed === s ? 700 : 400,
                    }}
                  >
                    {s}×
                  </button>
                ))}
                <span style={{ marginLeft: '0.2rem', opacity: 0.5, fontSize: '0.65rem' }}>
                  {readerSlideIdx + 1}/{wallpapers.length}
                </span>
              </div>
            )}
          <div className="flex" style={{ height: 'calc(100vh - 58px)', marginTop: '58px', position: 'relative', zIndex: 2 }}>
            {/* Sidebar */}
            <aside className="sidebar overflow-hidden flex flex-col" style={{ background: 'rgba(12,10,7,0.80)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
              <div className="sidebar-header">Books</div>
              <div className="flex-1 overflow-y-auto py-1">
                <div className="testament-header">Old Testament</div>
                {oldTestament.map(book => (
                  <button
                    key={book.id}
                    className={`book-item ${selectedBook?.id === book.id ? 'active' : ''}`}
                    onClick={() => handleSelectBook(book)}
                  >
                    {book.name}
                  </button>
                ))}
                <div className="testament-header">New Testament</div>
                {newTestament.map(book => (
                  <button
                    key={book.id}
                    className={`book-item ${selectedBook?.id === book.id ? 'active' : ''}`}
                    onClick={() => handleSelectBook(book)}
                  >
                    {book.name}
                  </button>
                ))}
              </div>
            </aside>

            {/* Main reader */}
            <main ref={mainRef} className="flex-1 overflow-y-auto" style={{ background: 'rgba(12,10,7,0.52)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
              {/* Toolbar */}
              <div className="reader-toolbar">
                <button className="btn btn-ghost text-xs disabled:opacity-30" disabled={currentChapterIndex <= 0} onClick={prevChapter}>← Prev</button>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-semibold" style={{ color: 'var(--parchment)' }}>{selectedBook?.name}</span>
                  {chapters.length > 0 && (
                    <select
                      value={selectedChapterId ?? ''}
                      onChange={e => { const ch = chapters.find(c => c.id === Number(e.target.value)); if (ch) handleSelectChapter(ch); }}
                      className="toolbar-select"
                    >
                      {chapters.map(c => <option key={c.id} value={c.id}>Ch {c.number}</option>)}
                    </select>
                  )}
                </div>

                {/* Search */}
                <div ref={searchRef} className="relative flex-1 min-w-0">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={onSearchChange}
                    onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                    placeholder="Search scripture…"
                    className="search-input"
                  />
                  {searchLoading && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--mist)', animation: 'fadePulse 1.2s ease infinite' }}>…</span>
                  )}
                  {searchOpen && searchResults.length > 0 && (
                    <div className="search-dropdown">
                      {searchResults.map(r => (
                        <button key={r.id} className="search-result-btn" onClick={() => handleSelectResult(r)}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>
                              {r.book_name} {r.chapter_number}:{r.verse_number}
                            </span>
                            <span className="text-[10px] px-1 py-0.5 rounded" style={{
                              background: r.testament === 'NEW' ? 'rgba(200,168,107,0.12)' : 'rgba(122,158,128,0.12)',
                              color: r.testament === 'NEW' ? 'var(--gold)' : 'var(--sage)',
                            }}>
                              {r.testament === 'NEW' ? 'NT' : 'OT'}
                            </span>
                          </div>
                          <p className="text-xs leading-snug line-clamp-2" style={{ color: 'var(--parchment-dim)' }}>{r.text}</p>
                        </button>
                      ))}
                      {searchResults.length === 50 && (
                        <p className="text-[10px] text-center py-2" style={{ color: 'var(--mist)' }}>Showing first 50 — refine your search</p>
                      )}
                    </div>
                  )}
                  {searchOpen && searchResults.length === 0 && !searchLoading && searchQuery.length >= 2 && (
                    <div className="search-dropdown">
                      <p className="text-xs text-center py-4" style={{ color: 'var(--mist)' }}>No results found</p>
                    </div>
                  )}
                </div>

                {/* View mode */}
                <div className="toggle-group">
                  {(['kjv', 'modern', 'both'] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      className={`toggle-btn ${viewMode === mode ? 'active-gold' : ''}`}
                      onClick={() => setViewMode(mode)}
                    >
                      {mode === 'kjv' ? 'KJV' : mode === 'modern' ? 'Modern' : 'Both'}
                    </button>
                  ))}
                </div>

                {/* Font controls */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button className="btn btn-ghost text-xs disabled:opacity-30 px-1.5" disabled={fontSize <= 12} onClick={() => setFontSize(s => Math.max(12, s - 2))} title="Smaller">A−</button>
                  <button className="btn btn-ghost text-xs disabled:opacity-30 px-1.5" disabled={fontSize >= 28} onClick={() => setFontSize(s => Math.min(28, s + 2))} title="Larger">A+</button>
                  <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="toolbar-select">
                    {FONTS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                <button className="btn btn-ghost text-xs disabled:opacity-30" disabled={currentChapterIndex >= chapters.length - 1} onClick={nextChapter}>Next →</button>
              </div>

              {/* Verses */}
              <div className={`px-8 py-8 mx-auto ${viewMode === 'both' ? 'max-w-6xl' : 'max-w-3xl'}`}>
                {loading ? (
                  <div className="text-sm py-16 text-center" style={{ color: 'var(--mist)' }}>Loading…</div>
                ) : verses.length === 0 ? (
                  <div className="text-sm py-16 text-center" style={{ color: 'var(--mist)' }}>No verses found.</div>
                ) : viewMode === 'both' ? (
                  <>
                    <div className="grid grid-cols-2 gap-6 mb-4 pb-2" style={{ borderBottom: '1px solid rgba(200,168,107,0.10)' }}>
                      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--gold)' }}>King James Version</div>
                      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--sage)' }}>Modern English</div>
                    </div>
                    {verses.map(v => (
                      <div id={`verse-${v.id}`} key={v.id} className="grid grid-cols-2 gap-6 mb-4">
                        <p className="leading-relaxed" style={{ fontSize, fontFamily, color: 'var(--parchment)', textShadow: '1px 1px 0 #000, 2px 2px 0 #000, 3px 3px 0 #000, 4px 4px 0 #000, 5px 5px 8px rgba(0,0,0,0.7)' }}>
                          <span className="verse-number">{v.verse_number}</span>
                          {v.text}
                        </p>
                        <p className="leading-relaxed" style={{ fontSize, fontFamily, textShadow: '1px 1px 0 #000, 2px 2px 0 #000, 3px 3px 0 #000, 4px 4px 0 #000, 5px 5px 8px rgba(0,0,0,0.7)' }}>
                          <span className="verse-number">{v.verse_number}</span>
                          {v.modern_text
                            ? <span style={{ color: 'var(--parchment)' }}>{v.modern_text}</span>
                            : <span style={{ color: 'var(--grace-surface)', fontStyle: 'italic' }}>Not yet translated</span>
                          }
                        </p>
                      </div>
                    ))}
                  </>
                ) : (
                  verses.map(v => (
                    <p id={`verse-${v.id}`} key={v.id} className="mb-4 leading-relaxed" style={{ fontSize, fontFamily, color: 'var(--parchment)', textShadow: '1px 1px 0 #000, 2px 2px 0 #000, 3px 3px 0 #000, 4px 4px 0 #000, 5px 5px 8px rgba(0,0,0,0.7)' }}>
                      <span className="verse-number">{v.verse_number}</span>
                      {viewMode === 'modern'
                        ? (v.modern_text ?? <span style={{ color: 'var(--grace-surface)', fontStyle: 'italic' }}>Not yet translated</span>)
                        : v.text
                      }
                    </p>
                  ))
                )}
              </div>

              {/* Bottom nav */}
              {!loading && verses.length > 0 && (
                <div className={`px-8 pb-10 mx-auto flex items-center justify-between pt-5 ${viewMode === 'both' ? 'max-w-6xl' : 'max-w-3xl'}`} style={{ borderTop: '1px solid rgba(200,168,107,0.08)' }}>
                  <button className="btn btn-outline text-xs disabled:opacity-30" disabled={currentChapterIndex <= 0} onClick={prevChapter}>← Prev Chapter</button>
                  <button className="btn btn-outline text-xs disabled:opacity-30" disabled={currentChapterIndex >= chapters.length - 1} onClick={nextChapter}>Next Chapter →</button>
                </div>
              )}
            </main>
          </div>
          </> /* end reader wallpaper fragment */
        )}

        {/* DICTIONARY */}
        {view === 'dictionary' && (
          <DictionarySection onNavigate={navigateTo} wallpaper={readerWallpaper} />
        )}

        {/* WORD CLOUD */}
        {view === 'wordcloud' && (
          <WordCloudSection onNavigate={navigateTo} wallpapers={wallpapers} />
        )}
      </div>
    </div>
  );
}

// ── Hero Section ────────────────────────────────────────────────────────────

const SLIDESHOW_INTERVAL = 7000;

function HeroSection({
  heroVerse,
  wallpapers,
  onNavigate,
}: {
  heroVerse: RandomVerse | null;
  wallpapers: Wallpaper[];
  onNavigate: (v: View) => void;
}) {
  const [slideIdx, setSlideIdx]           = useState(0);
  const [imgKey, setImgKey]               = useState(0);
  const slideshowRef                      = useRef<ReturnType<typeof setInterval> | null>(null);

  const startSlideshow = useCallback(() => {
    if (slideshowRef.current) clearInterval(slideshowRef.current);
    slideshowRef.current = setInterval(() => {
      setSlideIdx(i => {
        const next = (i + 1) % wallpapers.length;
        setImgKey(k => k + 1);
        return next;
      });
    }, SLIDESHOW_INTERVAL);
  }, [wallpapers.length]);

  useEffect(() => {
    if (wallpapers.length > 1) startSlideshow();
    return () => { if (slideshowRef.current) clearInterval(slideshowRef.current); };
  }, [startSlideshow, wallpapers.length]);

  const currentWallpaper = wallpapers[slideIdx] ?? null;
  const imgSrc = currentWallpaper ? `/api/images/${currentWallpaper.file_id}` : null;

  return (
    <div className="hero">
      {imgSrc && (
        <img
          key={imgKey}
          src={imgSrc}
          alt=""
          className="hero-img"
        />
      )}
      <div className="hero-overlay" />

      <div className="hero-content">
        {heroVerse ? (
          <>
            <blockquote className="hero-verse">&ldquo;{heroVerse.text}&rdquo;</blockquote>
            <p className="hero-ref">— {heroVerse.book_name} {heroVerse.chapter_number}:{heroVerse.verse_number}</p>
          </>
        ) : (
          <p style={{ color: 'var(--parchment-dim)', marginBottom: '2.75rem' }}>Scripture for every soul</p>
        )}

        <button className="hero-cta" onClick={() => onNavigate('reader')}>
          Open Bible
        </button>

        <div className="hero-secondary-links">
          <button className="hero-secondary-btn" onClick={() => onNavigate('dictionary')}>
            Dictionary
          </button>
          <button className="hero-secondary-btn" onClick={() => onNavigate('wordcloud')}>
            Word Cloud
          </button>
        </div>
      </div>

      {/* Slide dots */}
      {wallpapers.length > 1 && (
        <div className="hero-slide-dots">
          {wallpapers.map((_, i) => (
            <button
              key={i}
              className={`hero-dot ${i === slideIdx ? 'active' : ''}`}
              onClick={() => {
                setSlideIdx(i);
                setImgKey(k => k + 1);
                startSlideshow();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Gallery Section ─────────────────────────────────────────────────────────

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.4;

function GallerySection({ groups }: { groups: GalleryGroup[] }) {
  const [selectedTask, setSelectedTask] = useState<GalleryGroup | null>(null);
  const [images, setImages]             = useState<GalleryImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [lightboxIdx, setLightboxIdx]   = useState<number | null>(null);

  // Group by project
  const byProject = useMemo(() => {
    const map = new Map<string, GalleryGroup[]>();
    for (const g of groups) {
      const key = g.project_name ?? `Project ${g.project_id ?? 'Unknown'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    return map;
  }, [groups]);

  async function openGallery(task: GalleryGroup) {
    setSelectedTask(task);
    setLoadingImages(true);
    try {
      const res  = await fetch(`/api/gallery/${task.task_id}`);
      const data = await res.json();
      setImages(data.images ?? []);
    } finally {
      setLoadingImages(false);
    }
  }

  function closeGallery() {
    setSelectedTask(null);
    setImages([]);
    setLightboxIdx(null);
  }

  if (!groups.length) return null;

  return (
    <section className="gallery-section">
      {selectedTask ? (
        /* ── Gallery detail (masonry) ── */
        <>
          <div className="gallery-breadcrumb">
            <button className="gallery-back-btn" onClick={closeGallery}>← All Galleries</button>
            <span className="gallery-breadcrumb-sep">›</span>
            <span className="gallery-breadcrumb-current">#{selectedTask.task_id} — {selectedTask.task_name}</span>
          </div>

          {loadingImages ? (
            <p className="text-sm text-center py-16" style={{ color: 'var(--mist)' }}>Loading images…</p>
          ) : (
            <div className="masonry">
              {images.map((img, idx) => (
                <div key={img.file_id} className="masonry-item" onClick={() => setLightboxIdx(idx)}>
                  <img
                    src={`/api/images/${img.file_id}?thumb`}
                    alt={img.file_name}
                    className="masonry-img"
                    loading="lazy"
                  />
                  <div className="masonry-item-overlay">
                    <span className="masonry-item-label">{img.file_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lightboxIdx !== null && images.length > 0 && (
            <GalleryLightbox
              images={images}
              index={lightboxIdx}
              onClose={() => setLightboxIdx(null)}
              onNavigate={setLightboxIdx}
            />
          )}
        </>
      ) : (
        /* ── Gallery overview (cards by project) ── */
        <>
          <div className="gallery-section-header">
            <h2 className="gallery-section-title">Image Galleries</h2>
            <span className="gallery-section-count">{groups.length} galleries</span>
          </div>

          {Array.from(byProject.entries()).map(([projectName, tasks]) => (
            <div key={projectName} style={{ marginBottom: '2.5rem' }}>
              <div className="gallery-project-label">{projectName}</div>
              <div className="gallery-card-grid">
                {tasks.map(task => (
                  <div key={task.task_id} className="gallery-card" onClick={() => openGallery(task)}>
                    <img
                      src={`/api/images/${task.cover_id}?thumb`}
                      alt={task.task_name}
                      className="gallery-card-img"
                      loading="lazy"
                    />
                    <div className="gallery-card-overlay">
                      <div className="gallery-card-title">{task.task_name}</div>
                      <div className="gallery-card-count">#{task.task_id} · {task.img_count} images</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

// ── Lightbox ────────────────────────────────────────────────────────────────

function GalleryLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: GalleryImage[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const [zoom, setZoom]         = useState(1);
  const [pan, setPan]           = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [resolution, setResolution] = useState<string | null>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number }>({
    active: false, startX: 0, startY: 0, panX: 0, panY: 0,
  });

  const img = images[index];

  // Reset resolution when image changes
  useEffect(() => { setResolution(null); }, [index]);

  function resetZoom() { setZoom(1); setPan({ x: 0, y: 0 }); }

  function navigate(delta: number) {
    const next = (index + delta + images.length) % images.length;
    onNavigate(next);
    resetZoom();
  }

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
      if (e.key === '-') setZoom(z => { const nz = Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; });
      if (e.key === '0') resetZoom();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, zoom]);

  // Mouse wheel zoom
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom(z => {
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2)));
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });
  }

  // Pan drag
  function onMouseDown(e: React.MouseEvent) {
    if (zoom <= 1) return;
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current.active) return;
    setPan({ x: dragRef.current.panX + e.clientX - dragRef.current.startX, y: dragRef.current.panY + e.clientY - dragRef.current.startY });
  }

  function onMouseUp() { dragRef.current.active = false; setDragging(false); }

  // Double-click zoom toggle
  function onDblClick() {
    if (zoom > 1) { resetZoom(); } else { setZoom(2.5); }
  }

  return (
    <div className="lightbox" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Toolbar */}
      <div className="lightbox-toolbar">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono" style={{ color: 'var(--gold)', opacity: 0.9 }}>
            #{img?.file_id}
          </span>
          <span className="text-xs" style={{ color: 'var(--parchment-dim)', fontFamily: 'var(--font-playfair), serif', fontStyle: 'italic' }}>
            {img?.file_name}
          </span>
          {resolution && (
            <span className="text-xs font-mono" style={{ color: 'var(--mist)' }}>{resolution}</span>
          )}
        </div>
        <button className="lightbox-close" onClick={onClose}>✕</button>
      </div>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button className="lightbox-nav prev" onClick={() => navigate(-1)}>‹</button>
          <button className="lightbox-nav next" onClick={() => navigate(1)}>›</button>
        </>
      )}

      {/* Image */}
      <div
        className="lightbox-zoom-wrap"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={onDblClick}
      >
        <img
          src={`/api/images/${img?.file_id}`}
          alt={img?.file_name}
          className={`lightbox-img ${dragging ? 'dragging' : ''}`}
          style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` }}
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget;
            setResolution(`${el.naturalWidth} × ${el.naturalHeight}`);
          }}
        />
      </div>

      {/* Footer */}
      <div className="lightbox-footer">
        <span className="lightbox-counter">{index + 1} / {images.length}</span>
        <div className="lightbox-zoom-controls">
          <button className="zoom-btn" onClick={() => { setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))); }}>−</button>
          <span className="text-xs" style={{ color: 'var(--parchment-dim)', minWidth: '2.5rem', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button className="zoom-btn" onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}>+</button>
          <button className="zoom-btn" onClick={resetZoom} style={{ marginLeft: '0.2rem' }}>⊡</button>
        </div>
      </div>
    </div>
  );
}

// ── Dictionary Section ──────────────────────────────────────────────────────

type WordType = 'all' | 'common' | 'person' | 'place' | 'tribe' | 'title' | 'thing' | 'not_in_kjv';

interface DictWord {
  dict_id: number;
  word: string;
  word_type: string;
  definition: string | null;
}

const TYPE_META: Record<string, { label: string; badgeClass: string }> = {
  common:     { label: 'Common',     badgeClass: 'badge badge-common' },
  person:     { label: 'Person',     badgeClass: 'badge badge-person' },
  place:      { label: 'Place',      badgeClass: 'badge badge-place' },
  tribe:      { label: 'Tribe',      badgeClass: 'badge badge-tribe' },
  title:      { label: 'Title',      badgeClass: 'badge badge-title' },
  thing:      { label: 'Thing',      badgeClass: 'badge badge-thing' },
  not_in_kjv: { label: 'Not in KJV', badgeClass: 'badge badge-not_in_kjv' },
};

const TYPE_FILTERS: { key: WordType; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'common',    label: 'Common' },
  { key: 'person',    label: 'People' },
  { key: 'place',     label: 'Places' },
  { key: 'tribe',     label: 'Tribes' },
  { key: 'title',     label: 'Titles' },
  { key: 'thing',     label: 'Things' },
  { key: 'not_in_kjv', label: 'Not KJV' },
];

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type];
  if (!meta) return null;
  return <span className={meta.badgeClass}>{meta.label}</span>;
}

function DictionarySection({ onNavigate, wallpaper }: { onNavigate: (v: View) => void; wallpaper: Wallpaper | null }) {
  const [version, setVersion]       = useState<'kjv' | 'modern'>('kjv');
  const [testament, setTestament]   = useState<Testament>('OLD');
  const [words, setWords]           = useState<DictWord[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [q, setQ]                   = useState('');
  const [typeFilter, setTypeFilter] = useState<WordType>('all');
  const [loading, setLoading]       = useState(false);
  const LIMIT = 100;

  const load = useCallback((v: 'kjv'|'modern', t: Testament, p: number, search: string, type: WordType) => {
    setLoading(true);
    const params = new URLSearchParams({ version: v, testament: t, page: String(p), limit: String(LIMIT) });
    if (search) params.set('q', search);
    if (type !== 'all') params.set('type', type);
    fetch(`/api/dictionary?${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setWords(d.words); setTotal(d.total); } })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(version, testament, page, q, typeFilter); }, [version, testament, page, q, typeFilter, load]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onSearch(val: string) {
    setQ(val); setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(version, testament, 1, val, typeFilter), 300);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', paddingTop: '58px', position: 'relative' }}>
      {/* Wallpaper background */}
      {wallpaper && (
        <>
          <img
            src={`/api/images/${wallpaper.file_id}`}
            alt=""
            style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 0 }}
          />
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,10,7,0.68)', zIndex: 1 }} />
        </>
      )}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Top bar */}
      <div className="section-topbar">
        <span className="section-title">Dictionary</span>

        {/* KJV / Modern */}
        <div className="toggle-group">
          {(['kjv', 'modern'] as const).map(v => (
            <button key={v} onClick={() => { setVersion(v); setPage(1); }}
              className={`toggle-btn ${version === v ? 'active-gold' : ''}`}>
              {v === 'kjv' ? 'KJV' : 'Modern'}
            </button>
          ))}
        </div>

        {/* Testament */}
        <div className="toggle-group">
          {(['OLD', 'NEW'] as Testament[]).map(t => (
            <button key={t} onClick={() => { setTestament(t); setPage(1); }}
              className={`toggle-btn ${testament === t ? 'active-sage' : ''}`}>
              {t === 'OLD' ? 'Old Testament' : 'New Testament'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative" style={{ minWidth: '160px' }}>
          <input value={q} onChange={e => onSearch(e.target.value)} placeholder="Search words…" className="search-input" />
        </div>

        <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--mist)' }}>{total.toLocaleString()} words</span>
      </div>

      {/* Type filter pills */}
      <div className="pill-bar">
        {TYPE_FILTERS.map(f => (
          <button key={f.key}
            onClick={() => { setTypeFilter(f.key); setPage(1); }}
            className={`filter-pill ${typeFilter === f.key ? 'active' : ''}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Word list */}
      <div className="flex-1 overflow-y-auto px-7 py-4">
        {loading ? (
          <p className="text-sm text-center py-16" style={{ color: 'var(--mist)' }}>Loading…</p>
        ) : words.length === 0 ? (
          <p className="text-sm text-center py-16" style={{ color: 'var(--mist)' }}>No words found.</p>
        ) : (
          <ul>
            {words.map(w => (
              <li key={w.dict_id} className="word-entry">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--parchment)', fontFamily: 'var(--font-lora), serif' }}>{w.word}</span>
                  <TypeBadge type={w.word_type} />
                </div>
                {w.definition && (
                  <p className="text-xs leading-relaxed max-w-3xl" style={{ color: 'var(--parchment-dim)' }}>{w.definition}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pager-bar">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading} className="btn btn-ghost text-xs disabled:opacity-30">← Prev</button>
          <span className="text-xs" style={{ color: 'var(--mist)' }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading} className="btn btn-ghost text-xs disabled:opacity-30">Next →</button>
        </div>
      )}
      </div> {/* end zIndex wrapper */}
    </div>
  );
}

// ── Word Cloud Section ──────────────────────────────────────────────────────

type CloudWord = { text: string; count: number; x?: number; y?: number; rotate?: number; size?: number };

function WordCloudSection({ onNavigate, wallpapers }: { onNavigate: (v: View) => void; wallpapers: Wallpaper[] }) {
  const [version, setVersion]         = useState<'kjv' | 'modern'>('kjv');
  const [testament, setTestament]     = useState<Testament>('OLD');
  const [words, setWords]             = useState<{ word: string; count: number }[]>([]);
  const [loading, setLoading]         = useState(false);
  const [scaleFactor, setScale]       = useState(1.0);
  const [mode, setMode]               = useState<'cloud' | 'text'>('cloud');
  const [laid, setLaid]               = useState<CloudWord[]>([]);
  const [svgSize, setSvgSize]         = useState({ w: 900, h: 600 });
  const [bgWallpaper, setBgWallpaper] = useState<Wallpaper | null>(null);
  const containerRef                  = useRef<HTMLDivElement>(null);

  // Pick a random wallpaper on mount
  useEffect(() => {
    if (wallpapers.length > 0) {
      setBgWallpaper(wallpapers[Math.floor(Math.random() * wallpapers.length)]);
    }
  }, [wallpapers]);

  const load = useCallback((v: 'kjv'|'modern', t: Testament) => {
    setLoading(true);
    fetch(`/api/wordcloud?version=${v}&testament=${t}&limit=300`)
      .then(r => r.json())
      .then(d => { if (d.success) setWords(d.words); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(version, testament); }, [version, testament, load]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ w: Math.max(400, width), h: Math.max(300, height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const maxCount = words[0]?.count ?? 1;
  const minCount = words[words.length - 1]?.count ?? 1;

  function calcSize(count: number, min = 10, max = 52) {
    if (maxCount === minCount) return ((min + max) / 2) * scaleFactor;
    const ratio = Math.log(count - minCount + 1) / Math.log(maxCount - minCount + 1);
    return Math.round((min + ratio * (max - min)) * scaleFactor);
  }

  function wordColor(count: number) {
    const ratio = Math.log(count - minCount + 1) / Math.log(Math.max(2, maxCount - minCount + 1));
    if (ratio > 0.75) return '#c8a86b'; // gold
    if (ratio > 0.5)  return '#7a9e80'; // sage
    if (ratio > 0.25) return '#d4876a'; // dawn
    return '#5a4a3a';                   // mist-dark
  }

  useEffect(() => {
    if (mode !== 'cloud' || words.length === 0) return;
    const input: CloudWord[] = words.map(w => ({ text: w.word, count: w.count }));
    cloud<CloudWord>()
      .size([svgSize.w, svgSize.h])
      .words(input)
      .padding(4)
      .rotate(() => (Math.random() > 0.8 ? 90 : 0))
      .font('serif')
      .fontSize(d => calcSize(d.count ?? 1))
      .on('end', output => setLaid(output))
      .start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, svgSize, scaleFactor, mode]);

  const sorted = useMemo(() => [...words].sort((a, b) => a.word.localeCompare(b.word)), [words]);

  const legend = (
    <span className="text-[10px] flex items-center gap-3" style={{ color: 'var(--mist)' }}>
      <span><span style={{ color: 'var(--gold)' }}>■</span> very common</span>
      <span><span style={{ color: 'var(--sage)' }}>■</span> common</span>
      <span><span style={{ color: 'var(--dawn)' }}>■</span> moderate</span>
      <span><span style={{ color: '#5a4a3a' }}>■</span> rare</span>
    </span>
  );

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', paddingTop: '58px', position: 'relative' }}>

      {/* Wallpaper background */}
      {bgWallpaper && (
        <>
          <img
            src={`/api/images/${bgWallpaper.file_id}`}
            alt=""
            style={{
              position: 'fixed',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              zIndex: 0,
            }}
          />
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(12,10,7,0.72)',
            zIndex: 1,
          }} />
        </>
      )}

      {/* All content above the wallpaper */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', flex: 1 }}>

      {/* Top bar */}
      <div className="section-topbar">
        <span className="section-title">Word Cloud</span>

        {/* KJV / Modern */}
        <div className="toggle-group">
          {(['kjv', 'modern'] as const).map(v => (
            <button key={v} onClick={() => setVersion(v)}
              className={`toggle-btn ${version === v ? 'active-gold' : ''}`}>
              {v === 'kjv' ? 'KJV' : 'Modern'}
            </button>
          ))}
        </div>

        {/* Testament */}
        <div className="toggle-group">
          {(['OLD', 'NEW'] as Testament[]).map(t => (
            <button key={t} onClick={() => setTestament(t)}
              className={`toggle-btn ${testament === t ? 'active-sage' : ''}`}>
              {t === 'OLD' ? 'Old Testament' : 'New Testament'}
            </button>
          ))}
        </div>

        {/* Cloud / Text mode */}
        <div className="toggle-group">
          {(['cloud', 'text'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`toggle-btn ${mode === m ? 'active-neutral' : ''}`}>
              {m === 'cloud' ? '☁ Cloud' : '≡ List'}
            </button>
          ))}
        </div>

        {/* Scale */}
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost text-xs px-1.5 disabled:opacity-30"
            disabled={scaleFactor <= 0.4} onClick={() => setScale(s => Math.round((s - 0.2) * 10) / 10)}>A−</button>
          <button className="btn btn-ghost text-xs px-1.5 disabled:opacity-30"
            disabled={scaleFactor >= 3.0} onClick={() => setScale(s => Math.round((s + 0.2) * 10) / 10)}>A+</button>
        </div>

        <div className="ml-auto">{legend}</div>
      </div>

      {/* Cloud content */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        {loading ? (
          <p className="text-sm text-center py-16" style={{ color: 'var(--mist)' }}>Loading…</p>
        ) : mode === 'cloud' ? (
          <svg width={svgSize.w} height={svgSize.h} className="w-full h-full">
            <defs>
              <filter id="cloud-3d" x="-10%" y="-10%" width="120%" height="120%">
                {/* Create solid black version of each text shape */}
                <feFlood floodColor="#000" result="black" />
                <feComposite in="black" in2="SourceAlpha" operator="in" result="shadowBase" />
                {/* Stack 6 offset copies for the 3D extrusion */}
                <feOffset in="shadowBase" dx="1" dy="1" result="s1" />
                <feOffset in="shadowBase" dx="2" dy="2" result="s2" />
                <feOffset in="shadowBase" dx="3" dy="3" result="s3" />
                <feOffset in="shadowBase" dx="4" dy="4" result="s4" />
                <feOffset in="shadowBase" dx="5" dy="5" result="s5" />
                <feOffset in="shadowBase" dx="6" dy="6" result="s6" />
                {/* Ambient blur on the deepest layer */}
                <feGaussianBlur in="s6" stdDeviation="2" result="s6blur" />
                <feMerge>
                  <feMergeNode in="s6blur" />
                  <feMergeNode in="s5" />
                  <feMergeNode in="s4" />
                  <feMergeNode in="s3" />
                  <feMergeNode in="s2" />
                  <feMergeNode in="s1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g transform={`translate(${svgSize.w / 2},${svgSize.h / 2})`} filter="url(#cloud-3d)">
              {laid.map(w => (
                <text
                  key={w.text}
                  textAnchor="middle"
                  transform={`translate(${w.x ?? 0},${w.y ?? 0}) rotate(${w.rotate ?? 0})`}
                  style={{ fontSize: w.size, fill: wordColor(w.count), fontFamily: 'serif', cursor: 'default' }}
                  className="transition-opacity hover:opacity-60"
                >
                  <title>{w.text}: {w.count.toLocaleString()} occurrences</title>
                  {w.text}
                </text>
              ))}
            </g>
          </svg>
        ) : (
          <div className="h-full overflow-y-auto px-10 py-10">
            <div className="flex flex-wrap gap-x-4 gap-y-2 items-baseline justify-center">
              {sorted.map(w => (
                <span
                  key={w.word}
                  title={`${w.word}: ${w.count.toLocaleString()} occurrences`}
                  style={{
                    fontSize: calcSize(w.count),
                    color: wordColor(w.count),
                    lineHeight: 1.35,
                    fontFamily: 'serif',
                    textShadow: '1px 1px 0 #000, 2px 2px 0 #000, 3px 3px 0 #000, 4px 4px 0 #000, 5px 5px 0 #000, 6px 6px 10px rgba(0,0,0,0.7)',
                  }}
                  className="cursor-default hover:opacity-70 transition-opacity"
                >
                  {w.word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      </div> {/* end zIndex wrapper */}
    </div>
  );
}
