import { NextResponse } from 'next/server';
import { getAllCredentials, getUserProfile, deleteCredential } from '@/lib/credentialsStore';

export async function GET() {
  try {
    const credentials = getAllCredentials();
    const profile = getUserProfile();
    return NextResponse.json({
      success: true,
      credentials: Object.values(credentials),
      profile,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body.id || body.credentialId;
      } catch {}
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Credential ID is required for deletion.' },
        { status: 400 }
      );
    }

    const success = deleteCredential(id);
    if (!success) {
      return NextResponse.json(
        { success: false, error: `Credential "${id}" not found in Vault.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedId: id,
      message: `Credential ${id} permanently removed from Vault.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
