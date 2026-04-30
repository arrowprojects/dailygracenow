'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import cloud from 'd3-cloud';
import type { Book, Chapter, VerseWithRef, RandomVerse } from '@/lib/database';

type View = 'hero' | 'reader' | 'dict-kjv' | 'dict-modern' | 'cloud-kjv' | 'cloud-modern';
type ViewMode = 'kjv' | 'modern' | 'both';

const FONTS: { label: string; value: string; style?: string }[] = [
  // ── Top picks for scripture reading ──────────────────────────────────────
  { label: 'Lora',               value: "'Lora', Georgia, serif" },
  { label: 'Crimson Pro',        value: "'Crimson Pro', Garamond, Georgia, serif" },
  { label: 'Cormorant Garamond', value: "'Cormorant Garamond', Garamond, Georgia, serif" },
  { label: 'EB Garamond',        value: "'EB Garamond', Garamond, Georgia, serif" },
  { label: 'Gentium',            value: "'Gentium Book Plus', Georgia, serif" },
  { label: 'Vollkorn',           value: "'Vollkorn', Georgia, serif" },
  // ── Classic / editorial serifs ────────────────────────────────────────────
  { label: 'Merriweather',       value: "'Merriweather', Georgia, serif" },
  { label: 'Playfair Display',   value: "'Playfair Display', Georgia, serif" },
  { label: 'Libre Baskerville',  value: "'Libre Baskerville', Georgia, serif" },
  { label: 'Source Serif 4',     value: "'Source Serif 4', Georgia, serif" },
  { label: 'Georgia',            value: 'Georgia, serif' },
  // ── Decorative / historical ───────────────────────────────────────────────
  { label: 'Cinzel',             value: "'Cinzel', 'Times New Roman', serif" },
  { label: 'Blackletter',        value: "'UnifrakturMaguntia', cursive" },
  // ── Sans / modern ─────────────────────────────────────────────────────────
  { label: 'Inter',              value: "'Inter', system-ui, sans-serif" },
  { label: 'Noto Sans',          value: "'Noto Sans', system-ui, sans-serif" },
  { label: 'System',             value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" },
  // ── Monospace ─────────────────────────────────────────────────────────────
  { label: 'Mono',               value: "'Courier New', monospace" },
];
type Testament = 'OLD' | 'NEW';

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
}

export default function AppShell({ initialBooks, initialChapters, initialVerses, heroVerse }: Props) {
  const [view, setView] = useState<View>('hero');
  const [selectedBook, setSelectedBook] = useState<Book>(initialBooks[0]);
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(initialChapters[0]?.id ?? null);
  const [verses, setVerses] = useState<VerseWithRef[]>(initialVerses);
  const [loading, setLoading] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState(FONTS[1].value); // Lora default
  const [viewMode, setViewMode] = useState<ViewMode>('kjv');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const mainRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentChapterIndex = chapters.findIndex(c => c.id === selectedChapterId);


  // Close dropdown when clicking outside
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
      const chapRes = await fetch(`/api/chapters/${book.id}`);
      const chapData = await chapRes.json();
      const newChapters: Chapter[] = chapData.data ?? [];
      setChapters(newChapters);
      if (newChapters.length > 0) {
        setSelectedChapterId(newChapters[0].id);
        const verseRes = await fetch(`/api/verses/${newChapters[0].id}`);
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
      const res = await fetch(`/api/verses/${chapter.id}`);
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

    // Navigate to the book
    const book = initialBooks.find(b => b.id === result.book_id);
    if (!book) return;

    setSelectedBook(book);
    setLoading(true);
    try {
      const chapRes = await fetch(`/api/chapters/${book.id}`);
      const chapData = await chapRes.json();
      const newChapters: Chapter[] = chapData.data ?? [];
      setChapters(newChapters);

      const chapter = newChapters.find(c => c.number === result.chapter_number);
      if (chapter) {
        setSelectedChapterId(chapter.id);
        const verseRes = await fetch(`/api/verses/${chapter.id}`);
        const verseData = await verseRes.json();
        setVerses(verseData.data ?? []);
        // Scroll to verse after render
        setTimeout(() => {
          const el = document.getElementById(`verse-${result.id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    } finally {
      setLoading(false);
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

  if (view === 'hero') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-6">
        <div className="max-w-2xl w-full text-center space-y-10">
          <h1 className="text-4xl font-bold text-violet-400 tracking-tight">Daily Grace Now</h1>
          {heroVerse ? (
            <blockquote className="space-y-4">
              <p className="text-xl text-[#e5e5e5] leading-relaxed italic" style={{ fontFamily }}>
                &ldquo;{heroVerse.text}&rdquo;
              </p>
              <footer className="text-amber-400 font-semibold text-sm">
                — {heroVerse.book_name} {heroVerse.chapter_number}:{heroVerse.verse_number}
              </footer>
            </blockquote>
          ) : (
            <p className="text-[#555]">No verse available</p>
          )}
          <button
            className="btn btn-primary px-8 py-2.5 text-base mx-auto"
            onClick={() => setView('reader')}
          >
            Open Bible
          </button>

          {/* Dictionary & Word Cloud buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button className="btn btn-outline px-4 py-2 text-sm text-amber-400 border-amber-400/30 hover:border-amber-400/60 hover:bg-amber-400/5"
              onClick={() => setView('dict-kjv')}>KJV Dictionary</button>
            <button className="btn btn-outline px-4 py-2 text-sm text-violet-400 border-violet-400/30 hover:border-violet-400/60 hover:bg-violet-400/5"
              onClick={() => setView('dict-modern')}>Modern Dictionary</button>
            <button className="btn btn-outline px-4 py-2 text-sm text-amber-400 border-amber-400/30 hover:border-amber-400/60 hover:bg-amber-400/5"
              onClick={() => setView('cloud-kjv')}>KJV Word Cloud</button>
            <button className="btn btn-outline px-4 py-2 text-sm text-violet-400 border-violet-400/30 hover:border-violet-400/60 hover:bg-violet-400/5"
              onClick={() => setView('cloud-modern')}>Modern Word Cloud</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'dict-kjv' || view === 'dict-modern') {
    return <DictionaryView label={view === 'dict-kjv' ? 'KJV Dictionary' : 'Modern Dictionary'} version={view === 'dict-kjv' ? 'kjv' : 'modern'} onBack={() => setView('hero')} />;
  }

  if (view === 'cloud-kjv' || view === 'cloud-modern') {
    return <WordCloudView label={view === 'cloud-kjv' ? 'KJV Word Cloud' : 'Modern Word Cloud'} version={view === 'cloud-kjv' ? 'kjv' : 'modern'} onBack={() => setView('hero')} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#0a0a0a] border-r border-[#1e1e1e] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
          <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Daily Grace Now</span>
          <button
            className="text-[#555] hover:text-[#aaa] transition-colors text-xs"
            title="Back to home"
            onClick={() => setView('hero')}
          >
            ✦
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
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

      {/* Reader panel */}
      <main ref={mainRef} className="flex-1 overflow-y-auto bg-[#0d0d0d]">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-[#0d0d0d]/95 backdrop-blur border-b border-[#1e1e1e] px-6 py-3 flex items-center gap-4">

          {/* Prev */}
          <button
            className="btn btn-ghost text-xs disabled:opacity-30 flex-shrink-0"
            disabled={currentChapterIndex <= 0}
            onClick={prevChapter}
          >
            ← Prev
          </button>

          {/* Title + chapter jump */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <h1 className="text-sm font-semibold text-[#e5e5e5]">
              {selectedBook?.name}
            </h1>
            {chapters.length > 0 && (
              <select
                value={selectedChapterId ?? ''}
                onChange={e => {
                  const ch = chapters.find(c => c.id === Number(e.target.value));
                  if (ch) handleSelectChapter(ch);
                }}
                className="bg-[#141414] border border-[#2a2a2a] rounded text-xs text-[#ccc] px-2 py-1 focus:outline-none focus:border-violet-500/60 cursor-pointer"
              >
                {chapters.map(c => (
                  <option key={c.id} value={c.id}>Ch {c.number}</option>
                ))}
              </select>
            )}
          </div>

          {/* Search box */}
          <div ref={searchRef} className="relative flex-1 min-w-0">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={onSearchChange}
              onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
              placeholder="Search scripture…"
              className="w-full bg-[#141414] border border-[#2a2a2a] rounded text-xs text-[#ccc] placeholder-[#444] px-3 py-1.5 focus:outline-none focus:border-violet-500/60 transition-colors"
            />
            {searchLoading && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555] text-xs">…</span>
            )}

            {/* Results dropdown */}
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-[#2a2a2a] rounded shadow-xl max-h-80 overflow-y-auto z-50">
                {searchResults.map(r => (
                  <button
                    key={r.id}
                    className="w-full text-left px-3 py-2.5 hover:bg-[#1e1e1e] border-b border-[#1a1a1a] last:border-0 transition-colors"
                    onClick={() => handleSelectResult(r)}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-violet-400 text-xs font-semibold">
                        {r.book_name} {r.chapter_number}:{r.verse_number}
                      </span>
                      <span className={`text-[10px] px-1 py-0.5 rounded ${r.testament === 'NEW' ? 'bg-amber-900/40 text-amber-400' : 'bg-sky-900/40 text-sky-400'}`}>
                        {r.testament === 'NEW' ? 'NT' : 'OT'}
                      </span>
                    </div>
                    <p className="text-[#888] text-xs leading-snug line-clamp-2">{r.text}</p>
                  </button>
                ))}
                {searchResults.length === 50 && (
                  <p className="text-[#555] text-xs text-center py-2">Showing first 50 results — refine your search</p>
                )}
              </div>
            )}

            {searchOpen && searchResults.length === 0 && !searchLoading && searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-[#2a2a2a] rounded shadow-xl z-50">
                <p className="text-[#555] text-xs text-center py-4">No results found</p>
              </div>
            )}
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 flex-shrink-0 bg-[#141414] border border-[#2a2a2a] rounded p-0.5">
            {(['kjv', 'modern', 'both'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  viewMode === mode
                    ? 'bg-violet-600 text-white'
                    : 'text-[#666] hover:text-[#aaa]'
                }`}
                onClick={() => setViewMode(mode)}
              >
                {mode === 'kjv' ? 'KJV' : mode === 'modern' ? 'Modern' : 'Both'}
              </button>
            ))}
          </div>

          {/* Font controls + Next */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="btn btn-ghost text-xs w-6 h-6 flex items-center justify-center disabled:opacity-30"
              disabled={fontSize <= 12}
              onClick={() => setFontSize(s => Math.max(12, s - 2))}
              title="Decrease font size"
            >
              A−
            </button>
            <button
              className="btn btn-ghost text-xs w-6 h-6 flex items-center justify-center disabled:opacity-30"
              disabled={fontSize >= 28}
              onClick={() => setFontSize(s => Math.min(28, s + 2))}
              title="Increase font size"
            >
              A+
            </button>
            <select
              value={fontFamily}
              onChange={e => setFontFamily(e.target.value)}
              title="Font family"
              className="bg-[#141414] border border-[#2a2a2a] rounded text-xs text-[#ccc] px-2 py-1 focus:outline-none focus:border-violet-500/60 cursor-pointer"
            >
              {FONTS.map(f => (
                <option key={f.label} value={f.value}>{f.label}</option>
              ))}
            </select>
            <button
              className="btn btn-ghost text-xs disabled:opacity-30"
              disabled={currentChapterIndex >= chapters.length - 1}
              onClick={nextChapter}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Verses */}
        <div className={`px-8 py-8 ${viewMode === 'both' ? 'max-w-6xl' : 'max-w-3xl'} mx-auto`}>
          {loading ? (
            <div className="text-[#555] text-sm py-12 text-center">Loading…</div>
          ) : verses.length === 0 ? (
            <div className="text-[#555] text-sm py-12 text-center">No verses found.</div>
          ) : viewMode === 'both' ? (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-2 gap-6 mb-4 pb-2 border-b border-[#1e1e1e]">
                <div className="text-xs font-semibold text-amber-400 uppercase tracking-widest">King James Version</div>
                <div className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Modern English</div>
              </div>
              {verses.map(v => (
                <div id={`verse-${v.id}`} key={v.id} className="grid grid-cols-2 gap-6 mb-4">
                  <p className="leading-relaxed text-[#d0d0d0]" style={{ fontSize, fontFamily }}>
                    <span className="verse-number">{v.verse_number}</span>
                    {v.text}
                  </p>
                  <p className="leading-relaxed" style={{ fontSize, fontFamily }}>
                    <span className="verse-number">{v.verse_number}</span>
                    {v.modern_text
                      ? <span className="text-[#d0d0d0]">{v.modern_text}</span>
                      : <span className="text-[#333] italic">Not yet translated</span>
                    }
                  </p>
                </div>
              ))}
            </>
          ) : (
            verses.map(v => (
              <p id={`verse-${v.id}`} key={v.id} className="mb-4 leading-relaxed text-[#d0d0d0]" style={{ fontSize, fontFamily }}>
                <span className="verse-number">{v.verse_number}</span>
                {viewMode === 'modern'
                  ? (v.modern_text ?? <span className="text-[#333] italic">Not yet translated</span>)
                  : v.text
                }
              </p>
            ))
          )}
        </div>

        {/* Bottom chapter nav */}
        {!loading && verses.length > 0 && (
          <div className={`px-8 pb-8 ${viewMode === 'both' ? 'max-w-6xl' : 'max-w-3xl'} mx-auto flex items-center justify-between border-t border-[#1e1e1e] pt-4`}>
            <button
              className="btn btn-outline text-xs disabled:opacity-30"
              disabled={currentChapterIndex <= 0}
              onClick={prevChapter}
            >
              ← Prev Chapter
            </button>
            <button
              className="btn btn-outline text-xs disabled:opacity-30"
              disabled={currentChapterIndex >= chapters.length - 1}
              onClick={nextChapter}
            >
              Next Chapter →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Dictionary View ───────────────────────────────────────────────────────────

type WordType = 'all' | 'common' | 'person' | 'place' | 'tribe' | 'title' | 'thing' | 'not_in_kjv';

interface DictWord {
  dict_id: number;
  word: string;
  word_type: string;
  definition: string | null;
}

const TYPE_META: Record<string, { label: string; color: string; dot: string }> = {
  common:     { label: 'Common',    color: 'text-[#888] bg-[#1e1e1e] border-[#2a2a2a]',            dot: 'bg-[#666]' },
  person:     { label: 'Person',    color: 'text-violet-300 bg-violet-900/30 border-violet-700/40', dot: 'bg-violet-400' },
  place:      { label: 'Place',     color: 'text-sky-300 bg-sky-900/30 border-sky-700/40',          dot: 'bg-sky-400' },
  tribe:      { label: 'Tribe',     color: 'text-emerald-300 bg-emerald-900/30 border-emerald-700/40', dot: 'bg-emerald-400' },
  title:      { label: 'Title',     color: 'text-amber-300 bg-amber-900/30 border-amber-700/40',   dot: 'bg-amber-400' },
  thing:      { label: 'Thing',     color: 'text-orange-300 bg-orange-900/30 border-orange-700/40', dot: 'bg-orange-400' },
  not_in_kjv: { label: 'Not in KJV', color: 'text-red-300 bg-red-900/20 border-red-700/30',        dot: 'bg-red-400' },
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
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function DictionaryView({ label, version, onBack }: { label: string; version: 'kjv' | 'modern'; onBack: () => void }) {
  const [testament, setTestament] = useState<Testament>('OLD');
  const [words, setWords]         = useState<DictWord[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [q, setQ]                 = useState('');
  const [typeFilter, setTypeFilter] = useState<WordType>('all');
  const [loading, setLoading]     = useState(false);
  const LIMIT = 100;

  const load = useCallback((t: Testament, p: number, search: string, type: WordType) => {
    setLoading(true);
    const params = new URLSearchParams({ version, testament: t, page: String(p), limit: String(LIMIT) });
    if (search) params.set('q', search);
    if (type !== 'all') params.set('type', type);
    fetch(`/api/dictionary?${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setWords(d.words); setTotal(d.total); } })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(testament, page, q, typeFilter); }, [testament, page, q, typeFilter, load]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onSearch(val: string) {
    setQ(val); setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(testament, 1, val, typeFilter), 300);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1e1e1e] px-6 py-3 flex items-center gap-3 bg-[#0a0a0a] flex-wrap">
        <button onClick={onBack} className="text-[#555] hover:text-[#aaa] text-sm transition-colors flex-shrink-0">← Back</button>
        <h1 className="text-sm font-semibold text-[#e5e5e5] flex-shrink-0">{label}</h1>

        {/* Testament toggle */}
        <div className="flex items-center gap-0.5 bg-[#141414] border border-[#2a2a2a] rounded p-0.5 flex-shrink-0">
          {(['OLD', 'NEW'] as Testament[]).map(t => (
            <button key={t} onClick={() => { setTestament(t); setPage(1); }}
              className={`text-[10px] px-3 py-1 rounded transition-colors ${testament === t ? 'bg-amber-600 text-white' : 'text-[#666] hover:text-[#aaa]'}`}>
              {t === 'OLD' ? 'Old Testament' : 'New Testament'}
            </button>
          ))}
        </div>

        {/* Search */}
        <input value={q} onChange={e => onSearch(e.target.value)} placeholder="Search words…"
          className="bg-[#141414] border border-[#2a2a2a] rounded text-xs text-[#ccc] placeholder-[#444] px-3 py-1.5 focus:outline-none focus:border-violet-500/60 w-44 flex-shrink-0" />

        <span className="text-xs text-[#555] ml-auto flex-shrink-0">{total.toLocaleString()} words</span>
      </div>

      {/* Type filter pills */}
      <div className="border-b border-[#161616] px-6 py-2 flex items-center gap-1.5 flex-wrap bg-[#090909]">
        {TYPE_FILTERS.map(f => (
          <button key={f.key}
            onClick={() => { setTypeFilter(f.key); setPage(1); }}
            className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${
              typeFilter === f.key
                ? (f.key === 'all' ? 'bg-[#2a2a2a] border-[#3a3a3a] text-[#e5e5e5]'
                   : `${TYPE_META[f.key]?.color ?? ''} border-current`)
                : 'border-[#222] text-[#555] hover:text-[#888] hover:border-[#333]'
            }`}>
            {f.key !== 'all' && typeFilter === f.key && (
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${TYPE_META[f.key]?.dot ?? ''}`} />
            )}
            {f.label}
          </button>
        ))}
      </div>

      {/* Word list */}
      <div className="flex-1 px-6 py-3 overflow-y-auto">
        {loading ? (
          <p className="text-[#555] text-sm text-center py-12">Loading…</p>
        ) : words.length === 0 ? (
          <p className="text-[#555] text-sm text-center py-12">No words found.</p>
        ) : (
          <ul className="divide-y divide-[#141414]">
            {words.map(w => (
              <li key={w.dict_id} className="py-2.5">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="font-mono text-sm text-[#d0d0d0]">{w.word}</span>
                  <TypeBadge type={w.word_type} />
                </div>
                {w.definition && (
                  <p className="text-xs text-[#888] leading-relaxed max-w-3xl">{w.definition}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-[#1e1e1e] px-6 py-3 flex items-center justify-between bg-[#0a0a0a]">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}
            className="btn btn-ghost text-xs disabled:opacity-30">← Prev</button>
          <span className="text-xs text-[#555]">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}
            className="btn btn-ghost text-xs disabled:opacity-30">Next →</button>
        </div>
      )}
    </div>
  );
}

// ── Word Cloud View ───────────────────────────────────────────────────────────

type CloudWord = { text: string; count: number; x?: number; y?: number; rotate?: number; size?: number };

function WordCloudView({ label, version, onBack }: { label: string; version: 'kjv' | 'modern'; onBack: () => void }) {
  const [testament, setTestament]   = useState<Testament>('OLD');
  const [words, setWords]           = useState<{ word: string; count: number }[]>([]);
  const [loading, setLoading]       = useState(false);
  const [scaleFactor, setScale]     = useState(1.0);
  const [mode, setMode]             = useState<'text' | 'cloud'>('cloud');
  const [laid, setLaid]             = useState<CloudWord[]>([]);
  const [svgSize, setSvgSize]       = useState({ w: 900, h: 600 });
  const containerRef                = useRef<HTMLDivElement>(null);

  const load = useCallback((t: Testament) => {
    setLoading(true);
    fetch(`/api/wordcloud?version=${version}&testament=${t}&limit=300`)
      .then(r => r.json())
      .then(d => { if (d.success) setWords(d.words); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(testament); }, [testament, load]);

  // measure container for SVG dimensions
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

  // log scale font size
  function calcSize(count: number, min = 10, max = 52) {
    if (maxCount === minCount) return ((min + max) / 2) * scaleFactor;
    const ratio = Math.log(count - minCount + 1) / Math.log(maxCount - minCount + 1);
    return Math.round((min + ratio * (max - min)) * scaleFactor);
  }

  function wordColor(count: number) {
    const ratio = Math.log(count - minCount + 1) / Math.log(Math.max(2, maxCount - minCount + 1));
    if (ratio > 0.75) return '#f59e0b';
    if (ratio > 0.5)  return '#a78bfa';
    if (ratio > 0.25) return '#60a5fa';
    return '#4b5563';
  }

  // run d3-cloud layout when words / svgSize / scaleFactor change
  useEffect(() => {
    if (mode !== 'cloud' || words.length === 0) return;
    const input: CloudWord[] = words.map(w => ({ text: w.word, count: w.count }));
    cloud<CloudWord>()
      .size([svgSize.w, svgSize.h])
      .words(input)
      .padding(4)
      .rotate(() => (Math.random() > 0.8 ? 90 : 0))
      .font('sans-serif')
      .fontSize(d => calcSize(d.count ?? 1))
      .on('end', (output) => setLaid(output))
      .start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, svgSize, scaleFactor, mode]);

  const sorted = useMemo(() => [...words].sort((a, b) => a.word.localeCompare(b.word)), [words]);

  const legend = (
    <span className="text-[10px] text-[#555] flex items-center gap-3">
      <span><span className="text-amber-400">■</span> very common</span>
      <span><span className="text-violet-400">■</span> common</span>
      <span><span className="text-blue-400">■</span> moderate</span>
      <span><span className="text-[#4b5563]">■</span> rare</span>
    </span>
  );

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1e1e1e] px-6 py-3 flex items-center gap-4 bg-[#0a0a0a] flex-wrap">
        <button onClick={onBack} className="text-[#555] hover:text-[#aaa] text-sm transition-colors">← Back</button>
        <h1 className="text-sm font-semibold text-[#e5e5e5]">{label}</h1>

        {/* Testament toggle */}
        <div className="flex items-center gap-0.5 bg-[#141414] border border-[#2a2a2a] rounded p-0.5">
          {(['OLD', 'NEW'] as Testament[]).map(t => (
            <button key={t} onClick={() => setTestament(t)}
              className={`text-[10px] px-3 py-1 rounded transition-colors ${testament === t ? 'bg-amber-600 text-white' : 'text-[#666] hover:text-[#aaa]'}`}>
              {t === 'OLD' ? 'Old Testament' : 'New Testament'}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 bg-[#141414] border border-[#2a2a2a] rounded p-0.5">
          {(['cloud', 'text'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`text-[10px] px-3 py-1 rounded transition-colors ${mode === m ? 'bg-violet-700 text-white' : 'text-[#666] hover:text-[#aaa]'}`}>
              {m === 'cloud' ? '☁ Cloud' : '≡ Text'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className="btn btn-ghost text-xs w-6 h-6 flex items-center justify-center disabled:opacity-30"
            disabled={scaleFactor <= 0.4} onClick={() => setScale(s => Math.round((s - 0.2) * 10) / 10)} title="Decrease scale">A−</button>
          <button className="btn btn-ghost text-xs w-6 h-6 flex items-center justify-center disabled:opacity-30"
            disabled={scaleFactor >= 3.0} onClick={() => setScale(s => Math.round((s + 0.2) * 10) / 10)} title="Increase scale">A+</button>
          <span className="ml-3">{legend}</span>
        </div>
      </div>

      {/* Content */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        {loading ? (
          <p className="text-[#555] text-sm text-center py-12">Loading…</p>
        ) : mode === 'cloud' ? (
          // ── d3-cloud SVG layout ──
          <svg width={svgSize.w} height={svgSize.h} className="w-full h-full">
            <g transform={`translate(${svgSize.w / 2},${svgSize.h / 2})`}>
              {laid.map(w => (
                <text key={w.text}
                  textAnchor="middle"
                  transform={`translate(${w.x ?? 0},${w.y ?? 0}) rotate(${w.rotate ?? 0})`}
                  style={{ fontSize: w.size, fill: wordColor(w.count), fontFamily: 'sans-serif', cursor: 'default' }}
                  className="transition-opacity hover:opacity-60">
                  <title>{w.text}: {w.count.toLocaleString()} occurrences</title>
                  {w.text}
                </text>
              ))}
            </g>
          </svg>
        ) : (
          // ── text list (log scale, alphabetical) ──
          <div className="h-full overflow-y-auto px-8 py-8">
            <div className="flex flex-wrap gap-x-4 gap-y-2 items-baseline justify-center">
              {sorted.map(w => (
                <span key={w.word} title={`${w.word}: ${w.count.toLocaleString()} occurrences`}
                  style={{ fontSize: calcSize(w.count), color: wordColor(w.count), lineHeight: 1.3 }}
                  className="cursor-default hover:opacity-70 font-medium transition-opacity">
                  {w.word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
