import { NextResponse } from 'next/server';
import pool from '@/lib/database';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT id, name, abbrev, testament, book_order
      FROM books
      ORDER BY testament ASC, book_order ASC
    `);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ error: 'Failed to fetch books' }, { status: 500 });
  }
}
