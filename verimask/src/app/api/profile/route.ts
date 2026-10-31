import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile, saveUserProfile } from '@/lib/credentialsStore';

export async function GET() {
  try {
    const profile = getUserProfile();
    return NextResponse.json({ success: true, profile });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch profile';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const updated = saveUserProfile(body);
    return NextResponse.json({ success: true, profile: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update profile';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
