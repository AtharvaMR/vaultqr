import { NextRequest, NextResponse } from 'next/server';
import { validateScannedToken, StoredCredentialRecord } from '@/lib/vaultQrEngine';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ verificationToken: string }> }
) {
  const { verificationToken } = await context.params;

  const credentialsById = globalThis.__VERIMASK_CREDENTIALS_BY_ID__ ?? new Map<string, StoredCredentialRecord>();
  const tokenHashIndex = globalThis.__VERIMASK_TOKEN_HASH_INDEX__ ?? new Map<string, string>();

  const result = await validateScannedToken(verificationToken, async (suppliedHash) => {
    const credId = tokenHashIndex.get(suppliedHash);
    if (!credId) return null;
    return credentialsById.get(credId) || null;
  });

  return NextResponse.json(result.payload, { status: result.httpStatus });
}
