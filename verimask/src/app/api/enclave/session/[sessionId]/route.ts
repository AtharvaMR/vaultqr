import { NextRequest, NextResponse } from 'next/server';
import { getEnclaveSessionById, saveEnclaveSession, getCredentialById } from '@/lib/credentialsStore';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const session = getEnclaveSessionById(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found or expired', burned: true },
        { status: 404 }
      );
    }

    // ATOMIC VIEW-ONCE CHECK
    if (session.burned || session.viewCount > 0) {
      return NextResponse.json(
        {
          success: false,
          burned: true,
          error: 'Atomic View-Once Burn: This document preview has already been viewed and permanently purged from memory.',
        },
        { status: 410 }
      );
    }

    // Mark as viewed and burned on first access
    session.viewCount = 1;
    session.burned = true;
    session.burnReason = 'Atomic View-Once 30s Window Initiated';
    saveEnclaveSession(session);

    // Retrieve credential payload
    const cred = getCredentialById(session.credentialId);
    if (!cred) {
      return NextResponse.json(
        { success: false, error: 'Credential data not found', burned: true },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      burned: false,
      credential: {
        credentialId: cred.credentialId,
        documentType: cred.documentType,
        holderName: cred.holderName,
        dob: cred.dob || '12/04/1998',
        maskedIdentifier: cred.maskedIdentifier,
        issuer: cred.issuer,
        issuedAt: cred.issuedAt,
        previewImage: cred.previewImage || null,
        qualification: cred.qualification,
        institution: cred.institution,
      },
      ttlSeconds: 30,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Enclave retrieval failed';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const session = getEnclaveSessionById(sessionId);

    if (session) {
      session.burned = true;
      session.burnReason = 'Immediate purge triggered by viewer or camera alert';
      saveEnclaveSession(session);
    }

    return NextResponse.json({ success: true, message: 'Session burned.' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Burn failed';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
