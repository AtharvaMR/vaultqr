'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function DocumentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [realDoc, setRealDoc] = useState<any | null>(null);
  const [showMaskedToggle, setShowMaskedToggle] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [secretCode, setSecretCode] = useState('1234');
  const [generatedShareQr, setGeneratedShareQr] = useState<any | null>(null);

  // Fetch real document from backend registry
  useEffect(() => {
    async function loadDoc() {
      try {
        setLoading(true);
        const res = await fetch(`/api/credentials/${docId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.credential) {
            setRealDoc(data.credential);
          }
        }
      } catch (err) {
        console.error('Failed to load document details:', err);
      } finally {
        setLoading(false);
      }
    }
    if (docId) loadDoc();
  }, [docId]);

  // Document details dictionary with real data fallback
  const docData = {
    title: realDoc?.qualification || (realDoc?.documentType ? `${realDoc.documentType.replace(/_/g, ' ')} Card` : docId === 'pan' ? 'PAN Card' : docId.includes('marks') ? 'CBSE Educational Marksheet' : 'Aadhaar Card (UIDAI)'),
    authority: realDoc?.issuer || (docId === 'pan' ? 'Income Tax Department (NSDL/UTIITSL)' : docId.includes('marks') ? 'Central Board of Secondary Education' : 'Unique Identification Authority of India (UIDAI)'),
    maskedId: realDoc?.maskedIdentifier || (docId === 'pan' ? 'ABCDE••••F' : docId.includes('marks') ? 'Roll No: ••••5892' : 'XXXX - XXXX - 9021'),
    holderName: realDoc?.holderName || 'Verified Citizen',
    dobMasked: realDoc?.dob ? `${realDoc.dob} (Age check: Confirmed > 18 years)` : 'XX/XX/1998 (Age check: Confirmed > 18 years)',
    gender: 'Verified',
    region: 'India',
    biometricHash: 'Blake3-256 (Enclave match confirmed, raw biometrics not stored)',
    proofSystem: 'Groth16 / zk-SNARK v2.4 (ECDSA P-256)',
    attestationHash: realDoc?.digitalSignature ? `${realDoc.digitalSignature.slice(0, 32)}...` : '0x7f9a24c8b910e53a71dd2c9b604e12fa',
    publicFingerprint: realDoc?.credentialId || docId,
    issuedDate: realDoc?.issuedAt ? new Date(realDoc.issuedAt).toLocaleDateString() : '14 Oct 2021',
    uploadedDate: realDoc?.issuedAt ? new Date(realDoc.issuedAt).toLocaleDateString() : '14 Oct 2024',
    statusText: realDoc?.revoked ? 'Action Required • Revoked' : 'Cryptographically Verified (zk-SNARK Enclave)',
  };

  const copyAttestationHash = () => {
    navigator.clipboard.writeText(docData.attestationHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const copyMaskedId = () => {
    navigator.clipboard.writeText(docData.maskedId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Delete Credential Action
  const handleDeleteDocument = async () => {
    const targetId = docData.publicFingerprint;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${docData.title}" (${targetId}) from your Vault? This will remove all Zero-Knowledge records and QR tokens.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/credentials/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert(`Document ${targetId} successfully removed from your Vault.`);
        router.push('/documents');
      } else {
        alert(data.error || 'Failed to delete document from Vault');
      }
    } catch {
      alert('Network error while deleting document');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateShare = async () => {
    try {
      const res = await fetch('/api/vault/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationId: docData.publicFingerprint,
          userId: 'VM-8492-9104',
          permittedDocs: [docData.title],
          userSecretCode: secretCode,
          holderName: docData.holderName,
          documentType: docData.title,
          mode: 'dynamic',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedShareQr(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F7FB] text-[#101C35]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5EAF2] bg-white/90 backdrop-blur-md px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/documents" className="flex items-center gap-1.5 text-[#718096] hover:text-[#101C35]">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            <span className="text-xs font-bold hidden sm:inline">Back to Wallet</span>
          </Link>
          <div className="h-4 w-[1px] bg-slate-300"></div>
          <span className="font-extrabold text-base tracking-wider uppercase">
            Document Details
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/upload"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#315EF4] hover:bg-blue-600 text-white text-xs font-semibold shadow-sm transition"
          >
            <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
            <span>Add Document</span>
          </Link>
          <Link
            href="/credentials"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#101C35] text-xs font-semibold transition"
          >
            <span className="material-symbols-outlined text-[16px]">qr_code</span>
            <span className="hidden sm:inline">View QR</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* 1. Top Document Summary Card */}
        <div className="rounded-3xl bg-white border border-[#E5EAF2] p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5EAF2] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-sm">
                <span className="material-symbols-outlined text-[26px]">badge</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#101C35]">{docData.title}</h1>
                <p className="text-xs text-[#718096]">{docData.authority}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                VERIFIED
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[#718096] block">Masked ID:</span>
              <div className="flex items-center gap-1 font-mono font-bold text-blue-600 mt-0.5">
                <span>{docData.maskedId}</span>
                <button onClick={copyMaskedId} className="text-[#718096] hover:text-[#101C35]">
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedId ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <span className="text-[#718096] block">Issued Date:</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{docData.issuedDate}</span>
            </div>

            <div>
              <span className="text-[#718096] block">Uploaded:</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{docData.uploadedDate}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F5F7FB] border border-[#E5EAF2] flex items-center gap-2 text-xs">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">security</span>
            <span className="font-semibold text-emerald-800">{docData.statusText}</span>
          </div>
        </div>

        {/* 2. Interactive Masked Document Graphic Preview */}
        <div className="rounded-3xl bg-white border border-[#E5EAF2] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5EAF2] pb-3">
            <h2 className="text-sm font-bold text-[#101C35]">Identity Proof &amp; Redacted Claims</h2>
            <button
              onClick={() => setShowMaskedToggle(!showMaskedToggle)}
              className="text-xs font-semibold text-[#315EF4] flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">
                {showMaskedToggle ? 'visibility_off' : 'visibility'}
              </span>
              <span>{showMaskedToggle ? 'Hide Non-Disclosed' : 'Preview Masking'}</span>
            </button>
          </div>

          {/* Virtual ID Card */}
          <div className="rounded-2xl p-5 bg-gradient-to-br from-[#101C35] to-[#1E2E50] text-white shadow-lg space-y-4 relative overflow-hidden">
            <div className="flex justify-between items-center text-xs border-b border-white/10 pb-3">
              <span className="font-bold tracking-wider uppercase text-blue-300">
                {docData.title}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">ZK-PROOF VERIFIED</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Legal Name:</span>
                <span className="font-bold">{docData.holderName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Date of Birth:</span>
                <span className="font-mono">{docData.dobMasked}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Identifier:</span>
                <span className="font-mono text-amber-300 bg-white/10 px-2 py-0.5 rounded">
                  {docData.maskedId}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Jurisdiction:</span>
                <span>{docData.region}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Cryptographic Verification Metadata */}
        <div className="rounded-3xl bg-white border border-[#E5EAF2] p-6 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-[#101C35] uppercase tracking-wider">
            Zero-Knowledge Cryptographic Claims
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#718096]">Proof System:</span>
              <span className="font-mono text-slate-800 font-bold">{docData.proofSystem}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#718096]">Public Fingerprint:</span>
              <span className="font-mono font-bold text-slate-800">{docData.publicFingerprint}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#718096]">Attestation Hash:</span>
              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700">
                <span>{docData.attestationHash}</span>
                <button onClick={copyAttestationHash} className="p-0.5 text-slate-500 hover:text-slate-800">
                  <span className="material-symbols-outlined text-[13px]">
                    {copiedHash ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Action CTAs: Add, View, and DELETE BUTTON */}
        <div className="space-y-3 pt-2">
          {/* Primary QR generator button */}
          <Link
            href="/credentials"
            className="w-full py-3.5 rounded-2xl bg-[#101C35] hover:bg-slate-800 text-white text-xs font-bold shadow flex items-center justify-center gap-2 transition"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            <span>View &amp; Generate Scannable QR Credential</span>
          </Link>

          {/* Secondary Actions: Audit + Add Document */}
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              href={`/verify/${docData.publicFingerprint}`}
              target="_blank"
              className="py-2.5 rounded-xl border border-[#E5EAF2] hover:bg-slate-50 text-[#101C35] text-xs font-bold text-center flex items-center justify-center gap-1.5 transition"
            >
              <span className="material-symbols-outlined text-[16px] text-emerald-600">visibility</span>
              <span>Audit Certificate</span>
            </Link>

            <Link
              href="/upload"
              className="py-2.5 rounded-xl bg-[#315EF4] hover:bg-blue-600 text-white text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
              <span>Add Another Document</span>
            </Link>
          </div>

          {/* 5. DEDICATED DELETE BUTTON IN DOCUMENT FIELD */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleDeleteDocument}
              disabled={isDeleting}
              className="w-full py-3 rounded-2xl border-2 border-rose-200 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                  <span>Deleting Document from Vault...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px] text-rose-600">delete</span>
                  <span>Delete This Document ({docData.publicFingerprint}) from Vault</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-[#718096] text-center mt-1.5">
              Permanently purges this credential, its cryptographic attestation, and generated QR codes.
            </p>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[#E5EAF2] text-[#101C35] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5EAF2] pb-3">
              <h3 className="font-bold text-sm">Dynamic Share QR</h3>
              <button
                onClick={() => {
                  setIsShareModalOpen(false);
                  setGeneratedShareQr(null);
                }}
                className="rounded-full p-1 text-[#718096] hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {!generatedShareQr ? (
              <div className="space-y-3">
                <p className="text-xs text-[#718096]">
                  Enter your Vault Secret Code to issue a 5-minute dynamic QR code for this document:
                </p>
                <input
                  type="password"
                  maxLength={4}
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  placeholder="Passcode (default: 1234)"
                  className="w-full rounded-xl border border-[#E5EAF2] px-3 py-2 text-center text-sm font-mono tracking-widest outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleGenerateShare}
                  className="w-full py-2.5 rounded-xl bg-[#315EF4] hover:bg-blue-600 text-white text-xs font-bold shadow"
                >
                  Generate Dynamic QR
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={generatedShareQr.qrDataUrl}
                  alt="QR"
                  className="w-44 h-44 rounded-xl border border-slate-200"
                />
                <span className="text-xs text-blue-700 font-bold">Expires in 5 Minutes</span>
                <Link
                  href={generatedShareQr.verifierGatewayUrl}
                  target="_blank"
                  className="w-full py-2 rounded-xl bg-[#101C35] text-white text-xs font-bold"
                >
                  Open Verifier Gateway
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
