import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { accessRequestsStore } from '@/app/api/access-requests/route';

// Storage for active 30s DRM view sessions
export const activeDrmSessions = new Map<
  string,
  {
    sessionId: string;
    requestId: string;
    documentType: string;
    createdAt: number;
    expiresAt: number;
    burned: boolean;
    viewUrl: string;
  }
>();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { otp = '123456' } = body;

    // Validate OTP (Demo accepts any 6 digits or 123456)
    if (!/^\d{4,6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP code. Must be 4-6 numeric digits.' },
        { status: 400 }
      );
    }

    const req = accessRequestsStore.get(id);
    if (!req) {
      return NextResponse.json(
        { success: false, error: 'Access request not found.' },
        { status: 404 }
      );
    }

    // Generate Ephemeral DRM Session ID (30-second TTL)
    const sessionId = `DRM-${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const expiresAt = now + 30 * 1000; // 30 seconds

    req.status = 'APPROVED';
    req.approvedSessionId = sessionId;

    activeDrmSessions.set(sessionId, {
      sessionId,
      requestId: id,
      documentType: req.documentType,
      createdAt: now,
      expiresAt,
      burned: false,
      // Sample secure watermarked preview render
      viewUrl: `/api/access-sessions/${sessionId}`,
    });

    return NextResponse.json({
      success: true,
      message: 'Access approved with OTP authorization. 30-second DRM view session initiated.',
      sessionId,
      expiresInSeconds: 30,
      viewerUrl: `/verify/drm-view/${sessionId}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Approval failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
