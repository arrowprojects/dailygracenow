import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import pool from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { chapterId: string } }
) {
  try {
    const chapterId = parseInt(params.chapterId, 10);

    if (isNaN(chapterId)) {
      return NextResponse.json({ error: 'Invalid chapter ID' }, { status: 400 });
    }

    const result = await pool.query(
      'SELECT id, verse_number, text, modern_text FROM verses WHERE chapter_id = $1 ORDER BY verse_number ASC',
      [chapterId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching verses:', error);
    return NextResponse.json({ error: 'Failed to fetch verses' }, { status: 500 });
  }
}
