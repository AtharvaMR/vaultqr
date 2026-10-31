import { NextResponse } from 'next/server';
import { getCredentialById, deleteCredential } from '@/lib/credentialsStore';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const credential = getCredentialById(id);

    if (!credential) {
      return NextResponse.json({ success: false, error: 'Credential not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      credential,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
