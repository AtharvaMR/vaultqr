import { NextRequest, NextResponse } from 'next/server';
import { activeDrmSessions } from '@/app/api/access-requests/[id]/approve/route';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const session = activeDrmSessions.get(sessionId);

    if (!session) {
      return NextResponse.json(
        {
          error: 'Access session expired or invalid. Document access is restricted.',
          status: 'EXPIRED',
        },
        { status: 410 }
      );
    }

    const now = Date.now();
    if (now > session.expiresAt || session.burned) {
      activeDrmSessions.delete(sessionId);
      return NextResponse.json(
        {
          error: 'This View-Once session has burned or reached its 30-second TTL.',
          status: 'BURNED',
        },
        { status: 410 }
      );
    }

    // Mark as burned upon retrieval (Atomic View-Once Burn)
    session.burned = true;

    return NextResponse.json({
      success: true,
      documentType: session.documentType,
      watermarkText: `CONFIDENTIAL • VERIMASK DRM • EXPIRES IN 30s • ${new Date().toISOString()}`,
      timeRemainingMs: Math.max(0, session.expiresAt - now),
      // Mock secure base64 SVG canvas stream preview
      mockDocumentUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" style="background:%23f8f9ff"><rect width="100%" height="100%" fill="%23f8f9ff"/><text x="50" y="80" font-family="sans-serif" font-size="20" font-weight="bold" fill="%23101C35">CONFIDENTIAL IDENTITY DOCUMENT</text><text x="50" y="120" font-family="sans-serif" font-size="14" fill="%23434655">Holder: Aarav Sharma</text><text x="50" y="150" font-family="sans-serif" font-size="14" fill="%23434655">Document: Aadhaar Identity Proof</text><text x="50" y="180" font-family="sans-serif" font-size="14" fill="%2316A36A">Attestation: Digitally Signed by UIDAI</text><text x="50" y="240" font-family="sans-serif" font-size="12" fill="%23EF4444">WATERMARK: STRICT VIEW-ONCE RESTRICTED PREVIEW</text></svg>',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Session retrieval error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
