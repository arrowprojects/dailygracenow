import { NextResponse } from 'next/server';
import pool from '@/lib/database';

export const dynamic = 'force-dynamic';

// GET /api/dictionary?version=kjv|modern&testament=OLD|NEW&page=1&limit=100&q=word&type=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const version   = searchParams.get('version') === 'modern' ? 'modern' : 'kjv';
  const testament = searchParams.get('testament') === 'NEW' ? 'NEW' : 'OLD';
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit     = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '100', 10)));
  const q         = searchParams.get('q')?.trim().toLowerCase() ?? '';
  const type      = searchParams.get('type')?.trim().toLowerCase() ?? '';
  const offset    = (page - 1) * limit;
  const table     = testament === 'OLD' ? `dictionary_old_${version}` : `dictionary_new_${version}`;

  const VALID_TYPES = ['common', 'person', 'place', 'tribe', 'title', 'thing', 'not_in_kjv'];

  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;

    if (q) {
      conditions.push(`word ILIKE $${idx++}`);
      params.push(`${q}%`);
    }
    if (type && VALID_TYPES.includes(type)) {
      conditions.push(`word_type = $${idx++}`);
      params.push(type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataParams  = [...params, limit, offset];
    const countParams = [...params];

    const [wordsRes, countRes] = await Promise.all([
      pool.query<{ dict_id: number; word: string; word_type: string; definition: string | null }>(
        `SELECT dict_id, word, word_type, definition FROM p23.${table} ${where} ORDER BY word ASC LIMIT $${idx} OFFSET $${idx + 1}`,
        dataParams
      ),
      pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM p23.${table} ${where}`,
        countParams
      ),
    ]);

    return NextResponse.json({
      success: true,
      words: wordsRes.rows,
      total: parseInt(countRes.rows[0]?.total ?? '0', 10),
      page, limit, testament, version,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
