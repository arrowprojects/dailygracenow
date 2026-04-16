import { NextResponse } from 'next/server';
import pool from '@/lib/database';

// GET /api/verses/untranslated?limit=100
// Returns verses with modern_text IS NULL, ordered by id ascending.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);

  try {
    const result = await pool.query(
      `SELECT v.id, v.verse_number, v.text,
              c.number AS chapter_number,
              b.name AS book_name, b.testament
       FROM verses v
       JOIN chapters c ON c.id = v.chapter_id
       JOIN books b ON b.id = c.book_id
       WHERE v.modern_text IS NULL
       ORDER BY v.id ASC
       LIMIT $1`,
      [limit]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) AS remaining FROM verses WHERE modern_text IS NULL'
    );
    const remaining = parseInt(countResult.rows[0].remaining, 10);

    return NextResponse.json({ data: result.rows, remaining });
  } catch (error) {
    console.error('Error fetching untranslated verses:', error);
    return NextResponse.json({ error: 'Failed to fetch untranslated verses' }, { status: 500 });
  }
}
