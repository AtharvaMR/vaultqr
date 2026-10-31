// ============================================================
// VERIMASK Type Definitions
// ============================================================

export type DocumentType =
  | 'AADHAAR'
  | 'PAN'
  | 'BIRTH_CERTIFICATE'
  | 'DRIVING_LICENCE'
  | 'MARKSHEET_10'
  | 'MARKSHEET_12'
  | 'DEGREE_CERTIFICATE';

export type DocumentStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'OCR_COMPLETED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'REVOKED'
  | 'EXPIRED';

export type VerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING'
  | 'VERIFIED'
  | 'FAILED';

export type AccessRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  phone_verified: boolean;
  verimask_id: string;
  account_type: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  document_type: DocumentType;
  original_filename: string;
  storage_path: string;
  file_hash: string;
  file_size: number | null;
  mime_type: string | null;
  status: DocumentStatus;
  ocr_text: string | null;
  ocr_confidence: number | null;
  extracted_fields: ExtractedFields;
  masked_identifier: string | null;
  issuing_authority: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  verification_method: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractedFields {
  holder_name?: string;
  date_of_birth?: string;
  gender?: string;
  document_number?: string;
  masked_number?: string;
  father_name?: string;
  address?: string;
  state?: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date?: string;
  qualification?: string;
  institution?: string;
  roll_number?: string;
  year?: string;
  percentage?: string;
  grade?: string;
  [key: string]: string | undefined;
}

export interface Credential {
  id: string;
  credential_id: string;
  user_id: string;
  document_id: string;
  document_type: DocumentType;
  holder_name: string;
  claims: CredentialClaims;
  verification_status: string;
  issuer: string;
  issued_at: string;
  expires_at: string | null;
  revoked: boolean;
  revoked_at: string | null;
  signature: string;
  created_at: string;
}

export interface CredentialClaims {
  valid: boolean;
  credentialId: string;
  documentType: DocumentType;
  holderName: string;
  verificationStatus: string;
  issuer: string;
  issuedAt: string;
  revoked: boolean;
  maskedIdentifier?: string;
  ageVerification?: string;
  nationality?: string;
  qualification?: string;
  institution?: string;
  year?: string;
  grade?: string;
}

export interface QRToken {
  id: string;
  credential_id: string;
  token_hash: string;
  verification_url: string;
  qr_data_url: string | null;
  is_dynamic: boolean;
  expires_at: string | null;
  revoked: boolean;
  scan_count: number;
  last_scanned_at: string | null;
  created_at: string;
}

export interface AccessRequest {
  id: string;
  request_id: string;
  credential_id: string;
  document_id: string;
  owner_id: string;
  requester_name: string;
  requester_org: string | null;
  requester_email: string | null;
  purpose: string;
  status: AccessRequestStatus;
  approved_at: string | null;
  rejected_at: string | null;
  expires_at: string | null;
  otp_verified: boolean;
  created_at: string;
}

export interface AccessSession {
  id: string;
  access_request_id: string;
  session_token: string;
  document_id: string;
  expires_at: string;
  viewed: boolean;
  viewed_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface VerificationResult {
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
  qualification?: string;
  institution?: string;
  year?: string;
  expiresAt?: string;
  verifiedAt?: string;
}

// Document type metadata
export const DOCUMENT_TYPE_INFO: Record<DocumentType, {
  label: string;
  icon: string;
  issuingAuthority: string;
  category: 'identity' | 'education';
  fields: string[];
}> = {
  AADHAAR: {
    label: 'Aadhaar Card',
    icon: 'badge',
    issuingAuthority: 'UIDAI',
    category: 'identity',
    fields: ['holder_name', 'date_of_birth', 'gender', 'masked_number', 'address', 'state'],
  },
  PAN: {
    label: 'PAN Card',
    icon: 'credit_card',
    issuingAuthority: 'Income Tax Department',
    category: 'identity',
    fields: ['holder_name', 'date_of_birth', 'father_name', 'masked_number'],
  },
  BIRTH_CERTIFICATE: {
    label: 'Birth Certificate',
    icon: 'child_care',
    issuingAuthority: 'Registrar of Births',
    category: 'identity',
    fields: ['holder_name', 'date_of_birth', 'gender', 'father_name', 'state'],
  },
  DRIVING_LICENCE: {
    label: 'Driving Licence',
    icon: 'directions_car',
    issuingAuthority: 'Regional Transport Office',
    category: 'identity',
    fields: ['holder_name', 'date_of_birth', 'masked_number', 'issue_date', 'expiry_date', 'state'],
  },
  MARKSHEET_10: {
    label: 'Class 10 Marksheet',
    icon: 'school',
    issuingAuthority: 'Board of Education',
    category: 'education',
    fields: ['holder_name', 'roll_number', 'year', 'institution', 'percentage', 'grade'],
  },
  MARKSHEET_12: {
    label: 'Class 12 Marksheet',
    icon: 'school',
    issuingAuthority: 'Board of Education',
    category: 'education',
    fields: ['holder_name', 'roll_number', 'year', 'institution', 'percentage', 'grade'],
  },
  DEGREE_CERTIFICATE: {
    label: 'Degree Certificate',
    icon: 'workspace_premium',
    issuingAuthority: 'University',
    category: 'education',
    fields: ['holder_name', 'qualification', 'institution', 'year', 'grade'],
  },
};
