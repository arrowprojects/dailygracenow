import { NextResponse } from 'next/server';
import pool from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: Record<string, unknown> = {
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DATABASE_URL_HOST: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] ?? 'not set',
    build_ts: new Date().toISOString(),
  };

  try {
    const r = await pool.query('SELECT COUNT(*) FROM books');
    results.books_count = r.rows[0].count;
  } catch (e) {
    results.books_error = String(e);
  }

  try {
    const r = await pool.query('SELECT COUNT(*) FROM public.site_release_files');
    results.release_files_count = r.rows[0].count;
  } catch (e) {
    results.release_files_error = String(e);
  }

  return NextResponse.json(results);
}
