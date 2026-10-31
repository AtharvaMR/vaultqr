import { NextRequest, NextResponse } from 'next/server';
import { getEnclaveSessionById, saveEnclaveSession } from '@/lib/credentialsStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, otp } = body;

    if (!sessionId || !otp) {
      return NextResponse.json(
        { success: false, error: 'Session ID and OTP are required' },
        { status: 400 }
      );
    }

    const session = getEnclaveSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Access session not found or expired' },
        { status: 404 }
      );
    }

    if (session.burned) {
      return NextResponse.json(
        { success: false, error: 'This access session has already been burned.' },
        { status: 410 }
      );
    }

    // Accept session OTP or default demo OTP 849201
    if (otp !== session.otp && otp !== '849201') {
      return NextResponse.json(
        { success: false, error: 'Invalid OTP. Please check the code sent to the owner phone.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      enclaveUrl: `/enclave/${sessionId}`,
      message: 'Owner authorization confirmed. Redirecting to View-Once Enclave...',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'OTP verification failed';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
