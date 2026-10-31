import { SignJWT, jwtVerify } from 'jose';
import QRCode from 'qrcode';
import crypto from 'crypto';

const VAULT_MASTER_SECRET = new TextEncoder().encode(
  process.env.VAULT_MASTER_SECRET || 'hackathon-super-secret-key-32bytes'
);

export const LOCAL_LAN_IP = '10.188.235.154';
export const DEFAULT_PORT = '3050';

export function getEffectiveAppUrl(hostPreference?: 'network' | 'localhost' | string): string {
  if (hostPreference === 'localhost') {
    return 'http://localhost:3050';
  }
  if (hostPreference && hostPreference.startsWith('http')) {
    return hostPreference;
  }
  // Default to LAN IP so physical mobile phones and Google Lens can reach the server over Wi-Fi
  return `http://${LOCAL_LAN_IP}:${DEFAULT_PORT}`;
}

export interface ShareSessionPayload {
  verificationId: string;
  userId: string;
  permittedDocs: string[];
  holderName?: string;
  documentType?: string;
}

export interface VerifiedCertificatePayload {
  valid: boolean;
  credentialId: string;
  documentType: string;
  holderName: string;
  verificationStatus: string;
  issuer: string;
  issuedAt: string;
  revoked: boolean;
  maskedIdentifier?: string;
  ageVerification?: string;
  nationality?: string;
  dob?: string;
}

/**
 * 1. Generates a Dynamic, Time-Bound QR Code
 */
export async function generateDynamicVaultQR(
  payload: ShareSessionPayload,
  userSecretCode: string,
  storedSecretHash: string,
  hostPreference?: 'network' | 'localhost' | string
) {
  // Verify user's Vault Secret Code first
  const inputHash = crypto.createHash('sha256').update(userSecretCode).digest('hex');
  if (inputHash !== storedSecretHash) {
    throw new Error('Invalid Vault Secret Code');
  }

  const ephemeralSessionId = crypto.randomUUID();

  // Sign a short-lived token (Valid for 5 minutes / 300 seconds)
  const dynamicToken = await new SignJWT({
    ...payload,
    sessionId: ephemeralSessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(VAULT_MASTER_SECRET);

  const baseUrl = getEffectiveAppUrl(hostPreference);
  const verifierGatewayUrl = `${baseUrl}/verify/${payload.verificationId}?token=${dynamicToken}`;
  const localhostUrl = `http://localhost:3050/verify/${payload.verificationId}?token=${dynamicToken}`;

  // Render high-contrast QR code
  const qrDataUrl = await QRCode.toDataURL(verifierGatewayUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#0A0A0A',
      light: '#FFFFFF',
    },
  });

  return {
    ephemeralSessionId,
    verificationId: payload.verificationId,
    verifierGatewayUrl,
    localhostUrl,
    qrDataUrl,
    expiresInSeconds: 300,
  };
}

/**
 * 2. Generates a Verified Credential QR Code
 */
export async function generateCredentialQR(
  certData: VerifiedCertificatePayload,
  format: 'url' | 'raw_json' | 'dual' = 'dual',
  hostPreference?: 'network' | 'localhost' | string
) {
  const baseUrl = getEffectiveAppUrl(hostPreference);
  const verifierGatewayUrl = `${baseUrl}/verify/${certData.credentialId}`;
  const localhostUrl = `http://localhost:3050/verify/${certData.credentialId}`;

  const qrContent = format === 'raw_json' ? JSON.stringify(certData) : verifierGatewayUrl;

  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#101C35',
      light: '#FFFFFF',
    },
  });

  const qrSvg = await QRCode.toString(qrContent, {
    type: 'svg',
    margin: 2,
    color: {
      dark: '#101C35',
      light: '#FFFFFF',
    },
  });

  return {
    qrDataUrl,
    qrSvg,
    verifierGatewayUrl,
    localhostUrl,
    rawPayload: certData,
  };
}

/**
 * 3. Verify Dynamic or Static JWT token
 */
export async function verifyVaultToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, VAULT_MASTER_SECRET);
    return { valid: true, payload };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Invalid or expired token';
    return { valid: false, error: errorMessage };
  }
}
