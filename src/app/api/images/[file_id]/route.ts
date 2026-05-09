import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import pool from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { file_id: string } }
) {
  const fileId = parseInt(params.file_id, 10);
  if (isNaN(fileId)) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const useThumb = request.nextUrl.searchParams.has('thumb');

  try {
    const result = await pool.query(
      'SELECT file_path, thumb_path FROM public.site_codex_files WHERE file_id = $1',
      [fileId]
    );
    if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { file_path, thumb_path } = result.rows[0];
    const diskPath = useThumb && thumb_path ? thumb_path : file_path;

    const data = await readFile(diskPath);
    const ext = diskPath.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      webp: 'image/webp', gif: 'image/gif',
    };
    const contentType = mimeMap[ext] ?? 'application/octet-stream';

    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}
