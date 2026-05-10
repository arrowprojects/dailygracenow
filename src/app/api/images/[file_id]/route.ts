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

  // 1. Check if this file has been processed + uploaded to S3 via runway
  //    Use the most recent release that has an S3 URL for this file.
  const { rows: s3Rows } = await pool.query<{ web_s3: string; hero_s3: string }>(
    `SELECT (variants->>'web_s3') AS web_s3, (variants->>'hero_s3') AS hero_s3
     FROM public.site_release_files
     WHERE source_file_id = $1
       AND variants ? 'web_s3'
     ORDER BY id DESC
     LIMIT 1`,
    [fileId]
  );

  if (s3Rows.length > 0 && s3Rows[0].web_s3) {
    // Redirect to S3/CDN URL — immutable, edge-cached
    const cdnUrl = thumb ? s3Rows[0].web_s3 : (s3Rows[0].hero_s3 || s3Rows[0].web_s3);
    return NextResponse.redirect(cdnUrl, {
      status: 302,
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  }

  // 2. Fall back to local disk paths
  const { rows } = await pool.query<{ file_path: string; thumb_path: string | null }>(
    'SELECT file_path, thumb_path FROM public.site_codex_files WHERE file_id = $1 AND project_id = 23',
    [fileId]
  );
  if (!rows.length) return new NextResponse('Not found', { status: 404 });

  const filePath = (thumb && rows[0].thumb_path) ? rows[0].thumb_path : rows[0].file_path;

  // 3. Remote mode: proxy to Mac Studio codex file endpoint
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

  // 4. Local mode: serve directly from disk (dev only)
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
