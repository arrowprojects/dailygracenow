import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import pool from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { bookId: string } }
) {
  try {
    const bookId = parseInt(params.bookId, 10);

    if (isNaN(bookId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    const result = await pool.query(
      'SELECT id, number FROM chapters WHERE book_id = $1 ORDER BY number ASC',
      [bookId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
  }
}
