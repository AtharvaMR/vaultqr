import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { saveEnclaveSession, getCredentialById, getUserProfile } from '@/lib/credentialsStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credentialId } = body;

    if (!credentialId) {
      return NextResponse.json(
        { success: false, error: 'Credential ID is required' },
        { status: 400 }
      );
    }

    const cred = getCredentialById(credentialId);
    if (!cred) {
      return NextResponse.json(
        { success: false, error: 'Credential not found in registry' },
        { status: 404 }
      );
    }

    const profile = getUserProfile();
    const rawPhone = profile.phone || '+91 98492 01910';
    const maskedPhone = rawPhone.length > 5 ? rawPhone.slice(0, 3) + ' ••••• ••' + rawPhone.slice(-3) : '+91 ••••• ••910';

    const sessionId = crypto.randomUUID();
    const simulatedOtp = '849201'; // Standard consent OTP

    saveEnclaveSession({
      sessionId,
      credentialId,
      otp: simulatedOtp,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min request window
      viewCount: 0,
      burned: false,
    });

    return NextResponse.json({
      success: true,
      sessionId,
      phone: maskedPhone,
      simulatedOtp,
      message: 'OTP sent to document owner registered mobile number.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'OTP request failed';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
