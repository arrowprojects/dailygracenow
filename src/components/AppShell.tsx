'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Book, Chapter, VerseWithRef, RandomVerse } from '@/lib/database';

type View = 'hero' | 'reader';
type ViewMode = 'kjv' | 'modern' | 'both';

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
  const currentChapter = chapters[currentChapterIndex] ?? null;

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
          <h1 className="text-4xl font-bold text-violet-400 tracking-tight">Daily Jesus</h1>
          {heroVerse ? (
            <blockquote className="space-y-4">
              <p className="text-xl text-[#e5e5e5] leading-relaxed italic">
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#0a0a0a] border-r border-[#1e1e1e] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between">
          <span className="text-xs font-semibold text-violet-400 uppercase tracking-widest">Daily Jesus</span>
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
                  <p className="leading-relaxed text-[#d0d0d0]" style={{ fontSize }}>
                    <span className="verse-number">{v.verse_number}</span>
                    {v.text}
                  </p>
                  <p className="leading-relaxed" style={{ fontSize }}>
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
              <p id={`verse-${v.id}`} key={v.id} className="mb-4 leading-relaxed text-[#d0d0d0]" style={{ fontSize }}>
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
