import { Pool } from 'pg';

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        // Prefer local socket to avoid password requirements on TCP.
        host: process.env.PGHOST ?? '/tmp',
        port: 5432,
        database: 'neondb',
        user: 'jarocho',
        password: process.env.POSTGRES_PASSWORD || undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);

// Set search_path to p23 on every new connection so all queries target this schema.
pool.on('connect', (client) => {
  client.query('SET search_path TO p23').catch(console.error);
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface Book {
  id: number;
  name: string;
  testament: string;   // 'OLD' | 'NEW'
  abbrev: string;
  book_order: number;
}

export interface Chapter {
  id: number;
  book_id: number;
  number: number;
}

export interface Verse {
  id: number;
  chapter_id: number;
  verse_number: number;
  text: string;
  modern_text: string | null;
}

export interface RandomVerse {
  id: number;
  verse_number: number;
  text: string;
  chapter_number: number;
  book_name: string;
  testament: string;
  abbrev: string;
}

export interface VerseWithRef extends Verse {
  chapter_number: number;
  book_name: string;
  book_id: number;
}

// ── Query functions ───────────────────────────────────────────────────────────

export async function getAllBooks(): Promise<Book[]> {
  const result = await pool.query<Book>(
    'SELECT * FROM books ORDER BY book_order ASC'
  );
  return result.rows;
}

export async function getBookById(id: number): Promise<Book | null> {
  const result = await pool.query<Book>('SELECT * FROM books WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}

export async function getChaptersByBook(bookId: number): Promise<Chapter[]> {
  const result = await pool.query<Chapter>(
    'SELECT * FROM chapters WHERE book_id = $1 ORDER BY number ASC',
    [bookId]
  );
  return result.rows;
}

export async function getVersesByChapter(chapterId: number): Promise<VerseWithRef[]> {
  const result = await pool.query<VerseWithRef>(
    `SELECT v.*, c.number AS chapter_number, b.name AS book_name, b.id AS book_id
     FROM verses v
     JOIN chapters c ON c.id = v.chapter_id
     JOIN books b ON b.id = c.book_id
     WHERE v.chapter_id = $1
     ORDER BY v.verse_number ASC`,
    [chapterId]
  );
  return result.rows;
}

export async function getRandomVerse(): Promise<RandomVerse | null> {
  const result = await pool.query<RandomVerse>(
    `SELECT v.id, v.verse_number, v.text,
            c.number AS chapter_number,
            b.name AS book_name, b.testament, b.abbrev
     FROM verses v
     JOIN chapters c ON c.id = v.chapter_id
     JOIN books b ON b.id = c.book_id
     ORDER BY RANDOM()
     LIMIT 1`
  );
  return result.rows[0] ?? null;
}

export async function getChapterById(chapterId: number): Promise<(Chapter & { book_id: number }) | null> {
  const result = await pool.query(
    'SELECT * FROM chapters WHERE id = $1',
    [chapterId]
  );
  return result.rows[0] ?? null;
}

export async function isSeedComplete(): Promise<boolean> {
  const result = await pool.query('SELECT COUNT(*) FROM books');
  return parseInt(result.rows[0].count, 10) > 0;
}

export default pool;
