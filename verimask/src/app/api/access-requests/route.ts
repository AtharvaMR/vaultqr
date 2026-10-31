import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface StoredRequest {
  id: string;
  requestId: string;
  credentialId: string;
  requesterName: string;
  requesterOrg: string;
  requesterEmail: string;
  purpose: string;
  documentType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
  approvedSessionId?: string;
}

export const accessRequestsStore = new Map<string, StoredRequest>();

// Pre-populate with a demo request from Axis Bank as seen in Stitch screens!
accessRequestsStore.set('AR-AXIS-9481', {
  id: 'req-1',
  requestId: 'AR-AXIS-9481',
  credentialId: 'ZK-CERT-IND-84920',
  requesterName: 'Priya Mehta',
  requesterOrg: 'Axis Bank (Loan Verification)',
  requesterEmail: 'verifications@axisbank.com',
  purpose: 'Home Loan KYC & Address Verification',
  documentType: 'Aadhaar Card',
  status: 'PENDING',
  createdAt: '2024-05-20T11:00:00Z',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      credentialId,
      requesterName,
      requesterOrg,
      requesterEmail,
      purpose,
      documentType = 'Identity Document',
    } = body;

    if (!requesterName || !purpose) {
      return NextResponse.json(
        { success: false, error: 'Requester name and purpose are required.' },
        { status: 400 }
      );
    }

    const requestId = `AR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const newRequest: StoredRequest = {
      id: crypto.randomUUID(),
      requestId,
      credentialId: credentialId || 'VC-GENERAL',
      requesterName,
      requesterOrg: requesterOrg || 'Independent Verifier',
      requesterEmail: requesterEmail || 'verifier@example.com',
      purpose,
      documentType,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    accessRequestsStore.set(requestId, newRequest);

    return NextResponse.json({
      success: true,
      message: 'Access request submitted. The document owner has received an authorization prompt.',
      requestId,
      request: newRequest,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to submit request';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    requests: Array.from(accessRequestsStore.values()),
  });
}
