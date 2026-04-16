export const dynamic = 'force-dynamic';

import { getAllBooks, getChaptersByBook, getVersesByChapter, getRandomVerse } from '@/lib/database';
import type { Book, Chapter, VerseWithRef, RandomVerse } from '@/lib/database';
import AppShell from '@/components/AppShell';

export default async function Home() {
  let books: Book[] = [];
  let initialChapters: Chapter[] = [];
  let initialVerses: VerseWithRef[] = [];
  let heroVerse: RandomVerse | null = null;

  try {
    [books, heroVerse] = await Promise.all([getAllBooks(), getRandomVerse()]);
    if (books.length > 0) {
      initialChapters = await getChaptersByBook(books[0].id);
      if (initialChapters.length > 0) {
        initialVerses = await getVersesByChapter(initialChapters[0].id);
      }
    }
  } catch (err) {
    console.error('Failed to load initial data:', err);
  }

  return (
    <AppShell
      initialBooks={books}
      initialChapters={initialChapters}
      initialVerses={initialVerses}
      heroVerse={heroVerse}
    />
  );
}
