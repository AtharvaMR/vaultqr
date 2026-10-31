import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UserProfile {
  legalName: string;
  alias: string;
  dob: string;
  phone: string;
  email: string;
  location: string;
  zkAgeProof: boolean;
  addressMasked: boolean;
  avatarUrl?: string;
  did: string;
}

export interface StoredCredential {
  valid: boolean;
  credentialId: string;
  documentType: string;
  holderName: string;
  dob?: string;
  verificationStatus: string;
  issuer: string;
  issuedAt: string;
  revoked: boolean;
  maskedIdentifier: string;
  ageVerification?: string;
  nationality?: string;
  qualification?: string;
  institution?: string;
  year?: string;
  grade?: string;
  previewImage?: string; // Base64 data URL for View-Once DRM Enclave
  digitalSignature?: string;
}

export interface EnclaveSession {
  sessionId: string;
  credentialId: string;
  otp: string;
  createdAt: number;
  expiresAt: number;
  viewCount: number;
  burned: boolean;
  burnReason?: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const REGISTRY_FILE = path.join(DATA_DIR, 'credentialsRegistry.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'enclaveSessions.json');
const PROFILE_FILE = path.join(DATA_DIR, 'userProfile.json');

export const DEFAULT_PROFILE: UserProfile = {
  legalName: '',
  alias: '@vault_user',
  dob: '',
  phone: '',
  email: '',
  location: '',
  zkAgeProof: false,
  addressMasked: true,
  did: 'did:vault:0x89f41b2c3d9021',
};

// No pre-seeded demo credentials - clean vault ready for real user uploads
const INITIAL_CREDENTIALS: Record<string, StoredCredential> = {};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 1. User Profile Store
export function getUserProfile(): UserProfile {
  ensureDataDir();
  try {
    if (fs.existsSync(PROFILE_FILE)) {
      const content = fs.readFileSync(PROFILE_FILE, 'utf-8');
      return { ...DEFAULT_PROFILE, ...JSON.parse(content) };
    }
  } catch (e) {
    console.error('Error reading user profile:', e);
  }
  return { ...DEFAULT_PROFILE };
}

export function saveUserProfile(profile: Partial<UserProfile>): UserProfile {
  ensureDataDir();
  try {
    const current = getUserProfile();
    const updated = { ...current, ...profile };
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  } catch (e) {
    console.error('Error saving user profile:', e);
    return { ...DEFAULT_PROFILE, ...profile };
  }
}

// 2. Credentials Store
export function getAllCredentials(): Record<string, StoredCredential> {
  ensureDataDir();
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const content = fs.readFileSync(REGISTRY_FILE, 'utf-8');
      const loaded = JSON.parse(content || '{}');
      return loaded || {};
    }
  } catch (e) {
    console.error('Error reading credentials registry:', e);
  }
  return {};
}

export function getCredentialById(id: string): StoredCredential | null {
  const all = getAllCredentials();
  if (all[id]) return all[id];

  // Case-insensitive / prefix fallback lookup
  const cleanId = id.trim().toLowerCase();
  for (const key of Object.keys(all)) {
    if (key.toLowerCase() === cleanId || all[key].credentialId.toLowerCase() === cleanId) {
      return all[key];
    }
  }
  return null;
}

export function saveCredential(credential: StoredCredential): void {
  ensureDataDir();
  try {
    const all = getAllCredentials();
    all[credential.credentialId] = credential;
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving credential:', e);
  }
}

export function deleteCredential(id: string): boolean {
  ensureDataDir();
  try {
    const all = getAllCredentials();
    const cleanId = id.trim().toLowerCase();
    let targetKey: string | null = null;

    for (const key of Object.keys(all)) {
      if (key.toLowerCase() === cleanId || all[key]?.credentialId?.toLowerCase() === cleanId) {
        targetKey = key;
        break;
      }
    }

    if (targetKey) {
      delete all[targetKey];
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(all, null, 2), 'utf-8');
      return true;
    }
  } catch (e) {
    console.error('Error deleting credential:', e);
  }
  return false;
}

export function clearAllCredentials(): void {
  ensureDataDir();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify({}, null, 2), 'utf-8');
}

// 3. Enclave Sessions Store
export function getEnclaveSessions(): Record<string, EnclaveSession> {
  ensureDataDir();
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const content = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      return JSON.parse(content || '{}');
    }
  } catch (e) {
    console.error('Error reading enclave sessions:', e);
  }
  return {};
}

export function saveEnclaveSession(session: EnclaveSession): void {
  ensureDataDir();
  try {
    const all = getEnclaveSessions();
    all[session.sessionId] = session;
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving enclave session:', e);
  }
}

export function getEnclaveSessionById(sessionId: string): EnclaveSession | null {
  const all = getEnclaveSessions();
  return all[sessionId] || null;
}

export function burnEnclaveSession(sessionId: string, reason: string = 'View-Once TTL expired or user burned'): void {
  const session = getEnclaveSessionById(sessionId);
  if (session) {
    session.burned = true;
    session.burnReason = reason;
    saveEnclaveSession(session);
  }
}
