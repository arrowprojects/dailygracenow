import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://neondb_owner:npg_GUdw3Kni9yRv@ep-fragrant-violet-apx82n9h.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString: DATABASE_URL });

// Belt-and-suspenders: set search_path on every new connection.
// The DATABASE_URL should also include options=-c%20search_path%3Dp23
// but this covers any case where it doesn't.
pool.on('connect', (client) => {
  client.query('SET search_path TO p23, public').catch(() => {});
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

// ── Types ────────────────────────────────────────────────────────────────────

export interface Wallpaper {
  file_id: number;
  file_name: string;
  file_path: string;
  thumb_path: string | null;
}

export interface MenuItem {
  id: number;
  menu_text_str: string;
  menu_link: string | null;
  menu_icon_url: string | null;
  sort_order_int: number;
}

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
     WHERE v.id = (
       SELECT id FROM verses
       OFFSET floor(random() * (SELECT COUNT(*) FROM verses))
       LIMIT 1
     )`
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

export interface GalleryGroup {
  task_id: number;
  task_name: string;
  project_id: number | null;
  project_name: string | null;
  img_count: number;
  cover_id: number;
}

export interface GalleryImage {
  file_id: number;
  file_name: string;
  file_path: string;
  thumb_path: string;
  label: string | null;
}

export async function getGalleryGroups(projectId?: number): Promise<GalleryGroup[]> {
  const params: (string | number)[] = [];
  const projectFilter = projectId !== undefined
    ? `AND t.project_id = $${params.push(projectId)}`
    : '';
  const result = await pool.query<GalleryGroup>(
    `SELECT t.task_id, t.task_name, t.project_id, t.project_name,
            COUNT(cf.file_id)::int AS img_count,
            MIN(cf.file_id) AS cover_id
     FROM public.tasks t
     JOIN public.site_codex_files cf ON cf.task_id = t.task_id
     WHERE (cf.file_path LIKE '%.png' OR cf.file_path LIKE '%.jpg' OR cf.file_path LIKE '%.webp')
       AND cf.thumb_path IS NOT NULL
       AND cf.file_status = 'approved'
       ${projectFilter}
     GROUP BY t.task_id, t.task_name, t.project_id, t.project_name
     HAVING COUNT(cf.file_id) >= 2
     ORDER BY t.task_id DESC`,
    params
  );
  return result.rows;
}

export async function getGalleryImages(taskId: number): Promise<GalleryImage[]> {
  const result = await pool.query<GalleryImage>(
    `SELECT file_id, file_name, file_path, thumb_path, label
     FROM public.site_codex_files
     WHERE task_id = $1
       AND (file_path LIKE '%.png' OR file_path LIKE '%.jpg' OR file_path LIKE '%.webp')
       AND thumb_path IS NOT NULL
       AND file_status = 'approved'
     ORDER BY file_id ASC`,
    [taskId]
  );
  return result.rows;
}

export async function getWallpapers(): Promise<Wallpaper[]> {
  const result = await pool.query<Wallpaper>(
    `SELECT file_id, file_name, file_path, thumb_path
     FROM public.site_codex_files
     WHERE (
       (task_id = 1633 AND file_name LIKE '%_wallpaper.png')
       OR
       (task_id = 1748 AND file_path LIKE '%.png')
     )
       AND thumb_path IS NOT NULL
       AND file_status NOT IN ('rejected', 'missing')
     ORDER BY file_id ASC`
  );
  return result.rows;
}

export async function getDgnMenuItems(): Promise<MenuItem[]> {
  const result = await pool.query<MenuItem>(
    `SELECT id, menu_text_str, menu_link, menu_icon_url, sort_order_int
     FROM public.site_menu
     WHERE site_code = 'dgn'
       AND menu_type_str = 'header'
       AND parent_id IS NULL
       AND is_active_flag = true
       AND delete_flag = 'N'
     ORDER BY sort_order_int ASC`
  );
  return result.rows;
}

export default pool;
