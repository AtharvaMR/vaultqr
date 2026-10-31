import { NextRequest, NextResponse } from 'next/server';
import { accessRequestsStore } from '@/app/api/access-requests/route';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const req = accessRequestsStore.get(id);

    if (!req) {
      return NextResponse.json(
        { success: false, error: 'Access request not found.' },
        { status: 404 }
      );
    }

    req.status = 'REJECTED';

    return NextResponse.json({
      success: true,
      message: 'Access request rejected by document owner.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Rejection failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
