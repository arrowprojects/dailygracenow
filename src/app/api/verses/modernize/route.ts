import { NextResponse } from 'next/server';
import pool from '@/lib/database';

// POST /api/verses/modernize
// Body: { id: number, modern_text: string }
// Updates a single verse's modern_text.
export async function POST(request: Request) {
  try {
    const body = await request.json() as { id?: number; modern_text?: string };
    const { id, modern_text } = body;

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }
    if (!modern_text || typeof modern_text !== 'string' || !modern_text.trim()) {
      return NextResponse.json({ success: false, error: 'modern_text is required' }, { status: 400 });
    }

    const result = await pool.query(
      'UPDATE verses SET modern_text = $1 WHERE id = $2 RETURNING id',
      [modern_text.trim(), id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: `Verse ${id} not found` }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error updating modern_text:', error);
    return NextResponse.json({ success: false, error: 'Failed to update verse' }, { status: 500 });
  }
}
