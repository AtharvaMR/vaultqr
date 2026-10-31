import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { verifyDocumentWithOCR, SupportedDocType } from '@/lib/ocrSpaceVerifier';

// In-memory SHA-256 registry for hackathon demo (replace with DynamoDB VaultRegistry / Supabase table in prod)
const uploadedDocumentHashes = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate User via Supabase SSR (with graceful fallback for local testing)
    let holderName = 'Verified User';

    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          {
            cookies: {
              getAll() {
                return request.cookies.getAll();
              },
              setAll() {},
            },
          }
        );

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          holderName = user.user_metadata?.full_name || user.email || 'Verified User';
        }
      }
    } catch (authErr) {
      console.warn('Supabase auth session check (fallback to request holderName):', authErr);
    }

    // 2. Parse Multipart Form Data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const expectedDocType = formData.get('expectedDocType') as SupportedDocType | null;
    const formHolderName = formData.get('holderName') as string | null;

    if (formHolderName && formHolderName.trim()) {
      holderName = formHolderName.trim();
    }

    if (!file || !expectedDocType) {
      return NextResponse.json(
        {
          valid: false,
          errorCode: 'MISSING_PAYLOAD',
          error: 'Missing file or expected document category.',
          message: 'Missing file or expected document category.',
        },
        { status: 400 }
      );
    }

    // Validate MIME Type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json(
        {
          valid: false,
          errorCode: 'UNSUPPORTED_MIME_TYPE',
          error: 'Unsupported file format. Please upload a JPG, PNG, WEBP, or PDF file.',
          message: 'Unsupported file format. Please upload a JPG, PNG, WEBP, or PDF file.',
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 3. Run OCR Verification & Document Mismatch Check
    const result = await verifyDocumentWithOCR(
      fileBuffer,
      file.type,
      expectedDocType,
      holderName
    );

    if (!result.approved) {
      return NextResponse.json(
        {
          valid: false,
          success: false,
          errorCode: result.errorCode,
          detectedType: result.detectedType,
          error: result.message,
          message: result.message,
        },
        { status: result.statusCode }
      );
    }

    // 4. Track Document Uploads (Allow re-upload and updates seamlessly)
    const isReupload = !!(result.documentHash && uploadedDocumentHashes.has(result.documentHash));
    if (result.documentHash) {
      uploadedDocumentHashes.add(result.documentHash);
    }

    // 5. Return Signed VaultQR Verified Certificate with Scannable QR Code
    return NextResponse.json(
      {
        success: true,
        valid: true,
        message: isReupload
          ? `${result.certificate?.documentType || 'Document'} re-verified and updated in Vault.`
          : result.message,
        certificate: result.certificate,
        credentialId: result.credentialId,
        qrCodeUrl: result.qrCodeUrl,
        verifierGatewayUrl: result.verifierGatewayUrl,
        localhostUrl: result.localhostUrl,
        maskedIdentifier: result.maskedIdentifier,
        holderName: result.certificate?.holderName,
        documentHash: result.documentHash,
        isReupload,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error during document verification:', error);
    return NextResponse.json(
      {
        valid: false,
        success: false,
        errorCode: 'SERVER_ERROR',
        error: error.message || 'Internal server error during document verification.',
        message: error.message || 'Internal server error during document verification.',
      },
      { status: 500 }
    );
  }
}
