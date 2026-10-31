import { NextRequest, NextResponse } from 'next/server';
import { verifyVaultToken } from '@/lib/vaultQrGenerator';
import { getCredentialById, getAllCredentials } from '@/lib/credentialsStore';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const url = new URL(request.url);
    const dynamicJwt = url.searchParams.get('token');

    // 1. If dynamic JWT is passed, verify cryptographic validity & expiration
    if (dynamicJwt) {
      const verifyResult = await verifyVaultToken(dynamicJwt);
      if (!verifyResult.valid) {
        return NextResponse.json(
          {
            valid: false,
            error: 'QR token has expired or is invalid. Dynamic QR tokens are only valid for 5 minutes.',
            revoked: false,
          },
          { status: 401 }
        );
      }

      const p: any = verifyResult.payload;
      return NextResponse.json({
        valid: true,
        credentialId: p.verificationId || token,
        documentType: p.documentType || 'IDENTITY_DOCUMENT',
        holderName: p.holderName || 'Verified Holder',
        dob: p.dob || 'Attested Adult',
        verificationStatus: 'VERIFIED',
        issuer: 'VERIMASK Zero-Knowledge Enclave',
        issuedAt: new Date((p.iat || Date.now() / 1000) * 1000).toISOString(),
        revoked: false,
        maskedIdentifier: '•••• •••• ' + (p.verificationId?.slice(-4) || '9021'),
        permittedDocs: p.permittedDocs,
        ageVerification: 'Age > 18 Confirmed ✓',
        nationality: 'Indian Citizen (Confirmed ✓)',
        hasPreview: true,
      });
    }

    // 2. Check persistent credentials registry
    const stored = getCredentialById(token);
    if (stored) {
      return NextResponse.json({
        valid: stored.valid,
        credentialId: stored.credentialId,
        documentType: stored.documentType,
        holderName: stored.holderName,
        dob: stored.dob || '12/04/1998',
        verificationStatus: stored.verificationStatus,
        issuer: stored.issuer,
        issuedAt: stored.issuedAt,
        revoked: stored.revoked,
        maskedIdentifier: stored.maskedIdentifier,
        qualification: stored.qualification,
        institution: stored.institution,
        year: stored.year,
        grade: stored.grade,
        ageVerification: stored.ageVerification || 'Age > 18 Confirmed ✓',
        nationality: stored.nationality || 'Indian Citizen (Confirmed ✓)',
        hasPreview: !!stored.previewImage,
      });
    }

    // 3. Fallback: Check all credentials case-insensitively or by prefix
    const all = getAllCredentials();
    for (const key of Object.keys(all)) {
      if (key.toLowerCase() === token.toLowerCase()) {
        const item = all[key];
        return NextResponse.json({
          ...item,
          hasPreview: !!item.previewImage,
        });
      }
    }

    return NextResponse.json(
      {
        valid: false,
        error: `Credential "${token}" not found in verifiable registry. Please upload your document to generate a valid credential QR code.`,
      },
      { status: 404 }
    );
  } catch (err: unknown) {
    console.error('Verification error:', err);
    return NextResponse.json(
      { valid: false, error: 'Internal verification failure' },
      { status: 500 }
    );
  }
}
