import { SignJWT, jwtVerify } from 'jose';
import QRCode from 'qrcode';
import crypto from 'crypto';

const VAULT_MASTER_SECRET = new TextEncoder().encode(
  process.env.VAULT_MASTER_SECRET || 'verimask-hackathon-master-secret-key-2026'
);

export type CredentialDocType =
  | 'AADHAAR_CARD'
  | 'PAN_CARD'
  | 'DRIVING_LICENCE'
  | 'BIRTH_CERTIFICATE'
  | 'MARKSHEET_10'
  | 'MARKSHEET_12'
  | 'EDUCATION_CERTIFICATE';

/**
 * Exact public payload returned when a verifier scans the QR code
 */
export interface PublicVerificationPayload {
  valid: boolean;
  credentialId: string; // e.g., "VC-82f19a"
  documentType: CredentialDocType;
  holderName: string;
  verificationStatus: 'VERIFIED' | 'REVOKED' | 'EXPIRED';
  issuer: string;
  issuedAt: string;
  revoked: boolean;
}

/**
 * Internal database record stored in DynamoDB / Supabase
 * Notice: Raw verificationToken is NEVER stored; only its SHA-256 hash is kept.
 */
export interface StoredCredentialRecord {
  credentialId: string;
  userId: string;
  holderName: string;
  documentType: CredentialDocType;
  maskedIdentifier: string; // Always "[ID Redacted]" for sensitive IDs
  verificationStatus: 'VERIFIED' | 'REVOKED' | 'EXPIRED';
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
  tokenHash: string; // SHA-256 hash of the secret verification token
  jwsSignature: string; // Cryptographic signature of the credential claims
}

/**
 * Helper: Computes SHA-256 hex digest
 */
export function sha256Hash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Helper: Timing-safe comparison for User Vault Secret Code
 */
export function verifyUserSecretPin(inputPin: string, storedPinHash: string): boolean {
  const inputHashBuffer = Buffer.from(sha256Hash(inputPin), 'hex');
  const storedHashBuffer = Buffer.from(storedPinHash, 'hex');
  if (inputHashBuffer.length !== storedHashBuffer.length) return false;
  return crypto.timingSafeEqual(inputHashBuffer, storedHashBuffer);
}

/**
 * STEP 1: Called immediately after a document passes OCR & Category Verification.
 * Generates the Credential ID (VC-xxxxxx), Secret Verification Token, and QR Code.
 */
export async function issueCredentialAndQR(params: {
  userId: string;
  holderName: string;
  documentType: CredentialDocType;
  ttlMinutes?: number;
}) {
  const { userId, holderName, documentType, ttlMinutes = 60 * 24 * 30 } = params;

  // 1. Generate unique Credential ID (e.g., "VC-82f19a")
  const credentialId = `VC-${crypto.randomBytes(3).toString('hex')}`;

  // 2. Generate cryptographically unpredictable Secret Verification Token
  const rawVerificationToken = `vtok_${crypto.randomBytes(24).toString('base64url')}`;

  // 3. Hash the token for safe database storage
  const tokenHash = sha256Hash(rawVerificationToken);

  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  // 4. Construct the public verification claims (Zero raw ID numbers!)
  const publicClaims: PublicVerificationPayload = {
    valid: true,
    credentialId,
    documentType,
    holderName,
    verificationStatus: 'VERIFIED',
    issuer: 'Authorized Verification Provider',
    issuedAt,
    revoked: false,
  };

  // 5. Sign the credential claims using JOSE (HS256 / AWS KMS equivalent for MVP)
  const jwsSignature = await new SignJWT({
    ...publicClaims,
    sub: userId,
    maskedId: '[ID Redacted]',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'vc+jwt' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(new Date(expiresAt).getTime() / 1000))
    .sign(VAULT_MASTER_SECRET);

  // 6. Build the public verification URL that the QR code will open
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';
  const verificationUrl = `${appBaseUrl}/verify/${rawVerificationToken}`;

  // 7. Generate QR Code Data URL & SVG using node-qrcode-master ('qrcode')
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 320,
    color: {
      dark: '#0A0A0A',
      light: '#FFFFFF',
    },
  });

  const qrSvg = await QRCode.toString(verificationUrl, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
  });

  // 8. Database record to store
  const recordToStore: StoredCredentialRecord = {
    credentialId,
    userId,
    holderName,
    documentType,
    maskedIdentifier: '[ID Redacted]',
    verificationStatus: 'VERIFIED',
    issuer: 'Authorized Verification Provider',
    issuedAt,
    expiresAt,
    revoked: false,
    tokenHash,
    jwsSignature,
  };

  return {
    recordToStore,
    rawVerificationToken, // Returned to owner UI once to render/download QR
    verificationUrl,
    qrDataUrl,
    qrSvg,
    publicClaims,
  };
}

/**
 * STEP 2: Regenerates a fresh Secret Verification Token & QR Code for an existing Credential
 * (Invalidates the old QR code immediately by replacing tokenHash)
 */
export async function regenerateQrForCredential(record: StoredCredentialRecord) {
  if (record.revoked) {
    throw new Error('Cannot regenerate QR for a revoked credential.');
  }

  const newRawToken = `vtok_${crypto.randomBytes(24).toString('base64url')}`;
  const newTokenHash = sha256Hash(newRawToken);

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';
  const verificationUrl = `${appBaseUrl}/verify/${newRawToken}`;

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 320,
    color: {
      dark: '#0A0A0A',
      light: '#FFFFFF',
    },
  });

  return {
    updatedTokenHash: newTokenHash,
    newRawToken,
    verificationUrl,
    qrDataUrl,
  };
}

/**
 * STEP 3: Verifies a scanned QR token and returns the exact required payload
 */
export async function validateScannedToken(
  rawToken: string,
  lookupByTokenHash: (hash: string) => Promise<StoredCredentialRecord | null>
): Promise<{ httpStatus: number; payload: PublicVerificationPayload; error?: string }> {
  const suppliedHash = sha256Hash(rawToken);
  const record = await lookupByTokenHash(suppliedHash);

  // 1. Token does not exist
  if (!record) {
    return {
      httpStatus: 404,
      error: 'Invalid or unrecognized QR verification token.',
      payload: {
        valid: false,
        credentialId: 'UNKNOWN',
        documentType: 'EDUCATION_CERTIFICATE',
        holderName: 'Unknown',
        verificationStatus: 'REVOKED',
        issuer: 'Authorized Verification Provider',
        issuedAt: new Date(0).toISOString(),
        revoked: true,
      },
    };
  }

  // 2. Check Revocation
  if (record.revoked || record.verificationStatus === 'REVOKED') {
    return {
      httpStatus: 200,
      payload: {
        valid: false,
        credentialId: record.credentialId,
        documentType: record.documentType,
        holderName: record.holderName,
        verificationStatus: 'REVOKED',
        issuer: record.issuer,
        issuedAt: record.issuedAt,
        revoked: true,
      },
    };
  }

  // 3. Check Expiry & Cryptographic JWS Signature
  try {
    await jwtVerify(record.jwsSignature, VAULT_MASTER_SECRET);
  } catch (err) {
    return {
      httpStatus: 200,
      payload: {
        valid: false,
        credentialId: record.credentialId,
        documentType: record.documentType,
        holderName: record.holderName,
        verificationStatus: 'EXPIRED',
        issuer: record.issuer,
        issuedAt: record.issuedAt,
        revoked: false,
      },
    };
  }

  // 4. Valid Credential — Return exact permitted claims
  return {
    httpStatus: 200,
    payload: {
      valid: true,
      credentialId: record.credentialId,
      documentType: record.documentType,
      holderName: record.holderName,
      verificationStatus: 'VERIFIED',
      issuer: record.issuer,
      issuedAt: record.issuedAt,
      revoked: false,
    },
  };
}
