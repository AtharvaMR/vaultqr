import { NextRequest, NextResponse } from 'next/server';
import { generateDynamicVaultQR, generateCredentialQR } from '@/lib/vaultQrGenerator';
import { getCredentialById } from '@/lib/credentialsStore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      verificationId,
      userId = 'VM-USER-8492',
      permittedDocs = ['AADHAAR'],
      userSecretCode = '1234',
      storedSecretHash,
      holderName = 'Verified Citizen',
      documentType = 'IDENTITY_DOCUMENT',
      mode = 'static', // 'static' or 'dynamic'
      hostPreference = 'network', // 'network' for mobile/Google Lens scan, 'localhost' for same PC
    } = body;

    if (!verificationId) {
      return NextResponse.json(
        { success: false, error: 'verificationId is required' },
        { status: 400 }
      );
    }

    const defaultStoredHash = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
    const effectiveSecretHash = storedSecretHash || defaultStoredHash;

    // Check if we have richer metadata in store
    const stored = getCredentialById(verificationId);
    const effectiveHolderName = stored?.holderName || holderName;
    const effectiveDocType = stored?.documentType || documentType;
    const effectiveDob = stored?.dob || 'Verified Adult';
    const effectiveMaskedId = stored?.maskedIdentifier || '•••• •••• ' + verificationId.slice(-4);

    if (mode === 'dynamic') {
      const qrResult = await generateDynamicVaultQR(
        {
          verificationId,
          userId,
          permittedDocs,
          holderName: effectiveHolderName,
          documentType: effectiveDocType,
        },
        userSecretCode,
        effectiveSecretHash,
        hostPreference
      );

      return NextResponse.json({
        success: true,
        data: qrResult,
      });
    } else {
      // Static QR Code for document certificate
      const qrResult = await generateCredentialQR(
        {
          valid: true,
          credentialId: verificationId,
          documentType: effectiveDocType,
          holderName: effectiveHolderName,
          verificationStatus: 'VERIFIED',
          issuer: stored?.issuer || 'VERIMASK Attestation Provider',
          issuedAt: stored?.issuedAt || new Date().toISOString(),
          revoked: false,
          maskedIdentifier: effectiveMaskedId,
          ageVerification: 'Age > 18 Confirmed ✓',
          nationality: 'Indian Citizen (Confirmed ✓)',
          dob: effectiveDob,
        },
        'dual',
        hostPreference
      );

      return NextResponse.json({
        success: true,
        data: qrResult,
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Share generation failed';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
