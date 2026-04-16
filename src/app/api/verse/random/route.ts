import { NextResponse } from 'next/server';
import pool from '@/lib/database';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const testament = searchParams.get('testament')?.toUpperCase();
  const testamentFilter = testament === 'OLD' || testament === 'NEW' ? testament : null;

  try {
    const result = await pool.query(
      `SELECT
        v.text,
        v.verse_number,
        c.number as chapter_number,
        b.name as book_name,
        b.abbrev as book_abbrev,
        b.testament
      FROM verses v
      JOIN chapters c ON v.chapter_id = c.id
      JOIN books b ON c.book_id = b.id
      ${testamentFilter ? 'WHERE b.testament = $1' : ''}
      ORDER BY RANDOM()
      LIMIT 1`,
      testamentFilter ? [testamentFilter] : []
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No verses found' }, { status: 404 });
    }

    const verse = result.rows[0];
    const ref = `${verse.book_name} ${verse.chapter_number}:${verse.verse_number}`;

    return NextResponse.json({
      reference: ref,
      text: verse.text,
      book: verse.book_name,
      testament: verse.testament,
      chapter: verse.chapter_number,
      verse: verse.verse_number,
    });
  } catch (error) {
    console.error('Error fetching random verse:', error);
    return NextResponse.json({ error: 'Failed to fetch random verse' }, { status: 500 });
  }
}
