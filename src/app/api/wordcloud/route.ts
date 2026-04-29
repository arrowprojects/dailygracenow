import { NextResponse } from 'next/server';
import pool from '@/lib/database';

export const dynamic = 'force-dynamic';

// GET /api/wordcloud?version=kjv|modern&testament=OLD|NEW&limit=300
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const version   = searchParams.get('version') === 'modern' ? 'modern' : 'kjv';
  const testament = searchParams.get('testament') === 'NEW' ? 'NEW' : 'OLD';
  const limit     = Math.min(500, Math.max(10, parseInt(searchParams.get('limit') ?? '300', 10)));
  const table     = testament === 'OLD' ? `word_cloud_old_${version}` : `word_cloud_new_${version}`;

  try {
    const { rows } = await pool.query<{ word: string; count: number }>(
      `SELECT word, count FROM p23.${table} ORDER BY count DESC LIMIT $1`,
      [limit]
    );
    return NextResponse.json({ success: true, words: rows, testament, version });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
