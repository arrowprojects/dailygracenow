import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import pool from '@/lib/database';

const MAC_STUDIO_BASE = process.env.MAC_STUDIO_BASE ?? null;

export async function GET(
  req: NextRequest,
  { params }: { params: { file_id: string } }
) {
  const fileId = parseInt(params.file_id, 10);
  if (isNaN(fileId)) return new NextResponse('Bad request', { status: 400 });

  const thumb = req.nextUrl.searchParams.get('thumb') === '1';

  const { rows } = await pool.query<{ file_path: string; thumb_path: string | null }>(
    'SELECT file_path, thumb_path FROM public.site_codex_files WHERE file_id = $1 AND project_id = 23',
    [fileId]
  );
  if (!rows.length) return new NextResponse('Not found', { status: 404 });

  const filePath = (thumb && rows[0].thumb_path) ? rows[0].thumb_path : rows[0].file_path;

  // Remote mode: proxy to Mac Studio codex file endpoint
  if (MAC_STUDIO_BASE) {
    const url = `${MAC_STUDIO_BASE}/api/codex/file?path=${encodeURIComponent(filePath)}&raw=1`;
    const res = await fetch(url);
    if (!res.ok) return new NextResponse('File not found', { status: 404 });
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.webp' ? 'image/webp' : 'image/png';
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': `"${fileId}-${thumb ? 'thumb' : 'full'}"`,
      },
    });
  }

  // Local mode: serve directly from disk
  if (!fs.existsSync(filePath)) return new NextResponse('File not found on disk', { status: 404 });
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp' : 'image/png';
  const stream = fs.createReadStream(filePath);
  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': `"${fileId}-${thumb ? 'thumb' : 'full'}"`,
    },
  });
}
