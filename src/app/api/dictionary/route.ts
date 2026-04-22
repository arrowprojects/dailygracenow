import { NextResponse } from 'next/server';
import pool from '@/lib/database';

export const dynamic = 'force-dynamic';

// GET /api/dictionary?source=kjv|modern&testament=OLD|NEW&page=1&limit=100&q=word
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const testament = searchParams.get('testament') === 'NEW' ? 'NEW' : 'OLD';
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit     = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)));
  const q         = searchParams.get('q')?.trim().toLowerCase() ?? '';
  const offset    = (page - 1) * limit;
  const table     = testament === 'OLD' ? 'dictionary_old' : 'dictionary_new';

  try {
    const where = q ? `WHERE word ILIKE $1` : '';
    const params = q ? [`${q}%`, limit, offset] : [limit, offset];
    const countParams = q ? [`${q}%`] : [];
    const limitIdx = q ? 2 : 1;
    const offsetIdx = q ? 3 : 2;

    const [wordsRes, countRes] = await Promise.all([
      pool.query<{ dict_id: number; word: string }>(
        `SELECT dict_id, word FROM ${table} ${where} ORDER BY word ASC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
      ),
      pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM ${table} ${where}`,
        countParams
      ),
    ]);

    return NextResponse.json({
      success: true,
      words: wordsRes.rows,
      total: parseInt(countRes.rows[0]?.total ?? '0', 10),
      page, limit, testament,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
