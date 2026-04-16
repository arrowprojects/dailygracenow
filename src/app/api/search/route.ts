import { NextResponse } from 'next/server';
import pool from '@/lib/database';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  try {
    const result = await pool.query(
      `SELECT
        v.id, v.verse_number, v.text,
        c.number AS chapter_number,
        b.id AS book_id, b.name AS book_name, b.testament
      FROM verses v
      JOIN chapters c ON c.id = v.chapter_id
      JOIN books b ON b.id = c.book_id
      WHERE v.text ILIKE $1
         OR b.name ILIKE $2
      ORDER BY b.book_order ASC, c.number ASC, v.verse_number ASC
      LIMIT 50`,
      [`%${q}%`, `%${q}%`]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
