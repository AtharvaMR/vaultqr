import { NextRequest, NextResponse } from 'next/server';
import {
  issueCredentialAndQR,
  regenerateQrForCredential,
  CredentialDocType,
  StoredCredentialRecord,
} from '@/lib/vaultQrEngine';

// Global in-memory store for Hackathon MVP (Replace with DynamoDB / Supabase table in production)
declare global {
  var __VERIMASK_CREDENTIALS_BY_ID__: Map<string, StoredCredentialRecord> | undefined;
  var __VERIMASK_TOKEN_HASH_INDEX__: Map<string, string> | undefined; // tokenHash -> credentialId
}

const credentialsById =
  globalThis.__VERIMASK_CREDENTIALS_BY_ID__ ??
  (globalThis.__VERIMASK_CREDENTIALS_BY_ID__ = new Map<string, StoredCredentialRecord>());

const tokenHashIndex =
  globalThis.__VERIMASK_TOKEN_HASH_INDEX__ ??
  (globalThis.__VERIMASK_TOKEN_HASH_INDEX__ = new Map<string, string>());

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'CREATE', userId, holderName, documentType, credentialId } = body;

    // 1. CREATE NEW CREDENTIAL & QR CODE ON UPLOAD
    if (action === 'CREATE') {
      if (!documentType || !holderName) {
        return NextResponse.json(
          { error: 'Missing documentType or holderName.' },
          { status: 400 }
        );
      }

      const issued = await issueCredentialAndQR({
        userId: userId || 'usr_demo_01',
        holderName,
        documentType: documentType as CredentialDocType,
      });

      // Persist record & index by SHA-256 tokenHash
      credentialsById.set(issued.recordToStore.credentialId, issued.recordToStore);
      tokenHashIndex.set(issued.recordToStore.tokenHash, issued.recordToStore.credentialId);

      return NextResponse.json(
        {
          message: 'Special Verification ID and QR Credential generated.',
          credentialId: issued.recordToStore.credentialId,
          verificationToken: issued.rawVerificationToken,
          verificationUrl: issued.verificationUrl,
          qrDataUrl: issued.qrDataUrl,
          publicClaims: issued.publicClaims,
        },
        { status: 201 }
      );
    }

    // 2. REGENERATE QR CODE (Invalidates old QR token immediately)
    if (action === 'REGENERATE') {
      const existing = credentialsById.get(credentialId);
      if (!existing) {
        return NextResponse.json({ error: 'Credential not found.' }, { status: 404 });
      }

      // Delete old token hash from lookup index
      tokenHashIndex.delete(existing.tokenHash);

      const regenerated = await regenerateQrForCredential(existing);
      existing.tokenHash = regenerated.updatedTokenHash;

      credentialsById.set(existing.credentialId, existing);
      tokenHashIndex.set(regenerated.updatedTokenHash, existing.credentialId);

      return NextResponse.json({
        message: 'QR Code regenerated. Previous QR code is now invalid.',
        credentialId: existing.credentialId,
        verificationToken: regenerated.newRawToken,
        verificationUrl: regenerated.verificationUrl,
        qrDataUrl: regenerated.qrDataUrl,
      });
    }

    // 3. REVOKE CREDENTIAL
    if (action === 'REVOKE') {
      const existing = credentialsById.get(credentialId);
      if (!existing) {
        return NextResponse.json({ error: 'Credential not found.' }, { status: 404 });
      }

      existing.revoked = true;
      existing.verificationStatus = 'REVOKED';
      credentialsById.set(existing.credentialId, existing);

      return NextResponse.json({
        message: `Credential ${credentialId} has been revoked.`,
        credentialId,
        revoked: true,
      });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to process credential QR operation.' },
      { status: 500 }
    );
  }
}
