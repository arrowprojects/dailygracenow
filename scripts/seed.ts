import pool from '../src/lib/database';
import * as fs from 'fs';
import * as path from 'path';

const BIBLE_DIR = '/Users/jarocho/projectm/jesus/bible';

// Maps file abbreviation → [full name, testament, canonical order]
const BOOKS: Record<string, [string, 'OLD' | 'NEW', number]> = {
  // Old Testament
  GEN:    ['Genesis',          'OLD',  1],
  EXOD:   ['Exodus',           'OLD',  2],
  LEV:    ['Leviticus',        'OLD',  3],
  NUM:    ['Numbers',          'OLD',  4],
  DEUT:   ['Deuteronomy',      'OLD',  5],
  JOSH:   ['Joshua',           'OLD',  6],
  JUDG:   ['Judges',           'OLD',  7],
  RUTH:   ['Ruth',             'OLD',  8],
  ISAM:   ['1 Samuel',         'OLD',  9],
  IISAM:  ['2 Samuel',         'OLD', 10],
  IKING:  ['1 Kings',          'OLD', 11],
  IIKING: ['2 Kings',          'OLD', 12],
  ICHR:   ['1 Chronicles',     'OLD', 13],
  IICHR:  ['2 Chronicles',     'OLD', 14],
  EZRA:   ['Ezra',             'OLD', 15],
  NEH:    ['Nehemiah',         'OLD', 16],
  ESTH:   ['Esther',           'OLD', 17],
  JOB:    ['Job',              'OLD', 18],
  PSALM:  ['Psalms',           'OLD', 19],
  PROV:   ['Proverbs',         'OLD', 20],
  ECCL:   ['Ecclesiastes',     'OLD', 21],
  SONG:   ['Song of Solomon',  'OLD', 22],
  ISA:    ['Isaiah',           'OLD', 23],
  JER:    ['Jeremiah',         'OLD', 24],
  LAM:    ['Lamentations',     'OLD', 25],
  EZEK:   ['Ezekiel',          'OLD', 26],
  DAN:    ['Daniel',           'OLD', 27],
  HOS:    ['Hosea',            'OLD', 28],
  JOEL:   ['Joel',             'OLD', 29],
  AMOS:   ['Amos',             'OLD', 30],
  OBAD:   ['Obadiah',          'OLD', 31],
  JON:    ['Jonah',            'OLD', 32],
  MIC:    ['Micah',            'OLD', 33],
  NAH:    ['Nahum',            'OLD', 34],
  HAB:    ['Habakkuk',         'OLD', 35],
  ZEPH:   ['Zephaniah',        'OLD', 36],
  HAG:    ['Haggai',           'OLD', 37],
  ZECH:   ['Zechariah',        'OLD', 38],
  MAL:    ['Malachi',          'OLD', 39],
  // New Testament
  MATT:   ['Matthew',          'NEW', 40],
  MARK:   ['Mark',             'NEW', 41],
  LUKE:   ['Luke',             'NEW', 42],
  JOHN:   ['John',             'NEW', 43],
  ACTS:   ['Acts',             'NEW', 44],
  ROM:    ['Romans',           'NEW', 45],
  ICOR:   ['1 Corinthians',    'NEW', 46],
  IICOR:  ['2 Corinthians',    'NEW', 47],
  GAL:    ['Galatians',        'NEW', 48],
  EPH:    ['Ephesians',        'NEW', 49],
  PHIL:   ['Philippians',      'NEW', 50],
  COL:    ['Colossians',       'NEW', 51],
  ITHES:  ['1 Thessalonians',  'NEW', 52],
  IITHES: ['2 Thessalonians',  'NEW', 53],
  ITIM:   ['1 Timothy',        'NEW', 54],
  IITIM:  ['2 Timothy',        'NEW', 55],
  TITUS:  ['Titus',            'NEW', 56],
  PHILEM: ['Philemon',         'NEW', 57],
  HEB:    ['Hebrews',          'NEW', 58],
  JAMES:  ['James',            'NEW', 59],
  IPET:   ['1 Peter',          'NEW', 60],
  IIPET:  ['2 Peter',          'NEW', 61],
  IJOHN:  ['1 John',           'NEW', 62],
  IIJOHN: ['2 John',           'NEW', 63],
  IIIJOH: ['3 John',           'NEW', 64],
  JUDE:   ['Jude',             'NEW', 65],
  REV:    ['Revelation',       'NEW', 66],
};

// Parse "GEN01.txt" → { abbrev: 'GEN', chapter: 1 }
function parseFileName(filename: string): { abbrev: string; chapter: number } | null {
  const match = filename.match(/^([A-Z]+)(\d+)\.txt$/);
  if (!match) return null;
  return { abbrev: match[1], chapter: parseInt(match[2], 10) };
}

// Parse a chapter file, joining continuation lines onto their verse.
// Each verse starts with "chapter:verse  text"; subsequent lines without
// that pattern are continuations of the previous verse.
function parseChapterFile(filePath: string): Array<{ verseNumber: number; text: string }> {
  // eslint-disable-next-line no-control-regex
  const content = fs.readFileSync(filePath, 'utf-8').replace(/\x00/g, '');
  const lines = content.split(/\r?\n/);
  const verses: Array<{ verseNumber: number; text: string }> = [];
  const verseStart = /^\s*\d+:(\d+)\s+(.+)$/;

  for (const line of lines) {
    const m = line.match(verseStart);
    if (m) {
      verses.push({ verseNumber: parseInt(m[1], 10), text: m[2].trim() });
    } else {
      const trimmed = line.trim();
      if (trimmed && verses.length > 0) {
        verses[verses.length - 1].text += ' ' + trimmed;
      }
    }
  }
  return verses;
}

async function seedDatabase() {
  console.log('Starting database seed...');

  try {
    // Recreate tables in p23 schema
    await pool.query('DROP TABLE IF EXISTS p23.verses CASCADE');
    await pool.query('DROP TABLE IF EXISTS p23.chapters CASCADE');
    await pool.query('DROP TABLE IF EXISTS p23.books CASCADE');

    await pool.query(`
      CREATE TABLE p23.books (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        abbrev VARCHAR(10) NOT NULL UNIQUE,
        testament VARCHAR(10) NOT NULL,
        book_order INTEGER NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE p23.chapters (
        id SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES p23.books(id),
        number INTEGER NOT NULL,
        UNIQUE(book_id, number)
      )
    `);
    await pool.query(`
      CREATE TABLE p23.verses (
        id SERIAL PRIMARY KEY,
        chapter_id INTEGER NOT NULL REFERENCES p23.chapters(id),
        verse_number INTEGER NOT NULL,
        text TEXT NOT NULL,
        UNIQUE(chapter_id, verse_number)
      )
    `);

    // Insert books
    const bookIdMap: Record<string, number> = {};
    const sortedBooks = Object.entries(BOOKS).sort((a, b) => a[1][2] - b[1][2]);
    console.log(`Inserting ${sortedBooks.length} books...`);
    for (const [abbrev, [name, testament, order]] of sortedBooks) {
      const r = await pool.query(
        'INSERT INTO p23.books (name, abbrev, testament, book_order) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, abbrev, testament, order]
      );
      bookIdMap[abbrev] = r.rows[0].id;
    }

    // Process chapter files
    const files = fs.readdirSync(BIBLE_DIR).filter(f => f.endsWith('.txt')).sort();
    let chaptersInserted = 0;
    let versesInserted = 0;
    let skipped = 0;

    for (const file of files) {
      const parsed = parseFileName(file);
      if (!parsed) { skipped++; continue; }
      const { abbrev, chapter } = parsed;
      const bookId = bookIdMap[abbrev];
      if (!bookId) { console.log(`Unknown book abbreviation: ${abbrev} (${file})`); skipped++; continue; }

      const filePath = path.join(BIBLE_DIR, file);
      const verses = parseChapterFile(filePath);
      if (verses.length === 0) { console.log(`No verses parsed in ${file}`); skipped++; continue; }

      const chapRes = await pool.query(
        'INSERT INTO p23.chapters (book_id, number) VALUES ($1, $2) RETURNING id',
        [bookId, chapter]
      );
      const chapterId = chapRes.rows[0].id;
      chaptersInserted++;

      for (const { verseNumber, text } of verses) {
        await pool.query(
          'INSERT INTO p23.verses (chapter_id, verse_number, text) VALUES ($1, $2, $3)',
          [chapterId, verseNumber, text]
        );
        versesInserted++;
      }
    }

    console.log('\nSeeding complete!');
    console.log(`  Books:    ${sortedBooks.length}`);
    console.log(`  Chapters: ${chaptersInserted}`);
    console.log(`  Verses:   ${versesInserted}`);
    if (skipped > 0) console.log(`  Skipped:  ${skipped} files`);

  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
