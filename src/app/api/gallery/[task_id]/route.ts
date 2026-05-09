import { NextRequest, NextResponse } from 'next/server';
import { getGalleryImages } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: { task_id: string } }
) {
  const taskId = parseInt(params.task_id, 10);
  if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid task_id' }, { status: 400 });

  try {
    const images = await getGalleryImages(taskId);
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 500 });
  }
}
