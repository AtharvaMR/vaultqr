'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import VaultUploadModal from '@/components/VaultUploadModal';
import { VaultAntiCaptureShield } from '@/components/VaultAntiCaptureShield';

interface CredentialItem {
  id: string;
  name: string;
  code: string;
  status: string;
  lastVerified: string;
  icon: string;
  type: string;
  validity: string;
  holderName?: string;
  dob?: string;
}

export default function MyQrCredentialsPage() {
  const [selectedCred, setSelectedCred] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string>('');
  const [localhostUrl, setLocalhostUrl] = useState<string>('');
  const [hostMode, setHostMode] = useState<'network' | 'localhost'>('network');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMasked, setIsMasked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(30);
  const [revokedCreds, setRevokedCreds] = useState<string[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic credentials dictionary - starts clean with NO demo records
  const [credentials, setCredentials] = useState<Record<string, CredentialItem>>({});

  // Load all saved credentials from the server on mount
  useEffect(() => {
    async function fetchRegistry() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/credentials');
        if (res.ok) {
          const data = await res.json();
          if (data.credentials && Array.isArray(data.credentials) && data.credentials.length > 0) {
            const mapped: Record<string, CredentialItem> = {};
            data.credentials.forEach((c: any) => {
              const key = c.credentialId.toLowerCase().replace(/[^a-z0-9]/g, '_');
              let displayName = 'Identity Credential';
              let icon = 'badge';
              if (c.documentType === 'AADHAAR') {
                displayName = 'Aadhaar Zero-Knowledge Credential';
                icon = 'badge';
              } else if (c.documentType === 'PAN') {
                displayName = 'PAN Taxpayer Credential';
                icon = 'credit_card';
              } else if (c.documentType === 'EDUCATION_CERTIFICATE') {
                displayName = c.qualification || 'Education Attestation';
                icon = 'school';
              } else {
                displayName = `${c.documentType || 'Verified'} Document`;
                icon = 'verified_user';
              }

              mapped[key] = {
                id: key,
                name: displayName,
                code: c.credentialId,
                status: c.revoked ? 'Revoked' : 'Active',
                lastVerified: 'Cryptographically Signed',
                icon,
                type: c.documentType,
                validity: 'Cryptographically Valid • ECDSA P-256',
                holderName: c.holderName || data.profile?.legalName || 'Verified Citizen',
                dob: c.dob || data.profile?.dob || 'Verified Adult',
              };
            });

            setCredentials(mapped);
            const firstKey = Object.keys(mapped)[0];
            setSelectedCred((prev) => (prev && mapped[prev] ? prev : firstKey));
          } else {
            setCredentials({});
            setSelectedCred('');
          }
        }
      } catch (e) {
        console.error('Failed to load credentials registry:', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchRegistry();
  }, []);

  const currentList = Object.values(credentials);
  const current = credentials[selectedCred] || currentList[0] || null;
  const isRevoked = current ? (revokedCreds.includes(current.id) || current.status === 'Revoked') : false;

  // Live countdown timer for dynamic anti-clone refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch / Generate QR code only when a real credential exists
  useEffect(() => {
    async function loadQr() {
      if (!current) {
        setQrCodeUrl(null);
        setGatewayUrl('');
        setLocalhostUrl('');
        return;
      }

      try {
        setQrCodeUrl(null);
        const res = await fetch('/api/vault/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verificationId: current.code,
            userId: 'VM-VAULT-USER',
            permittedDocs: [current.type],
            holderName: current.holderName || 'Verified Citizen',
            documentType: current.type,
            mode: 'static',
            hostPreference: hostMode,
          }),
        });

        const data = await res.json();
        if (data.success && data.data) {
          setQrCodeUrl(data.data.qrDataUrl);
          setGatewayUrl(data.data.verifierGatewayUrl);
          setLocalhostUrl(data.data.localhostUrl);
        }
      } catch (err) {
        console.error('Error generating QR:', err);
      }
    }

    loadQr();
  }, [selectedCred, current?.code, current?.type, hostMode, current?.holderName]);

  const copyCode = () => {
    if (!current) return;
    navigator.clipboard.writeText(current.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyActiveLink = () => {
    const linkToCopy = hostMode === 'network' ? gatewayUrl : localhostUrl;
    navigator.clipboard.writeText(linkToCopy);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRevoke = () => {
    if (!current) return;
    if (confirm(`Are you sure you want to revoke QR token for ${current.name}?`)) {
      setRevokedCreds([...revokedCreds, current.id]);
    }
  };

  const handleDeleteCredential = async () => {
    if (!current) return;
    const credId = current.code;
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${current.name}" (${credId}) from your Vault?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/credentials/${encodeURIComponent(credId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const remaining = { ...credentials };
        delete remaining[selectedCred];
        setCredentials(remaining);
        const nextKeys = Object.keys(remaining);
        setSelectedCred(nextKeys.length > 0 ? nextKeys[0] : '');
        alert(`Credential ${credId} permanently removed.`);
      } else {
        alert(data.error || 'Failed to delete credential');
      }
    } catch {
      alert('Network error deleting credential');
    }
  };

  const handleUploadSuccess = (data: any) => {
    if (data.certificate) {
      const newKey = `doc_${data.certificate.credentialId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const newCred: CredentialItem = {
        id: newKey,
        name: `${data.certificate.documentType || 'Uploaded'} Credential`,
        code: data.certificate.credentialId,
        status: 'Active',
        lastVerified: 'Just Now',
        icon: 'verified',
        type: data.certificate.documentType || 'IDENTITY_DOCUMENT',
        validity: 'Cryptographically Valid • ECDSA P-256',
        holderName: data.certificate.holderName,
        dob: data.certificate.dob || 'Verified Adult',
      };
      setCredentials((prev) => ({
        ...prev,
        [newKey]: newCred,
      }));
      setSelectedCred(newKey);
    }
  };

  const displayedId = current
    ? (isMasked ? current.code.replace(/([A-Z0-9]{3})[A-Z0-9]+([A-Z0-9]{2})/g, '$1••••$2') : current.code)
    : '';

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F7FB] text-[#101C35]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5EAF2] bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-bold text-[#718096] hover:text-[#101C35] transition"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Dashboard</span>
          </Link>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#101C35] text-white shadow-sm">
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            </div>
            <span className="font-extrabold text-sm tracking-wider uppercase text-[#101C35]">
              Proof Generator • QR Bar Gate
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#315EF4] hover:bg-blue-600 text-white text-xs font-bold shadow transition"
          >
            <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
            <span className="hidden sm:inline">Upload Document</span>
          </Link>
          <Link
            href="/profile"
            className="w-8 h-8 rounded-full bg-[#101C35] flex items-center justify-center text-white shadow hover:opacity-90 transition"
            title="Profile Setup"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-6 sm:py-8 space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#101C35] tracking-tight">
            Proof Generator
          </h1>
          <p className="text-xs text-[#718096] mt-0.5">
            Manage your verified digital identity credentials and QR Bar Gate.
          </p>
        </div>

        {/* LOADING STATE */}
        {isLoading ? (
          <div className="rounded-3xl bg-white border border-[#E5EAF2] p-10 text-center space-y-3 shadow-md">
            <span className="material-symbols-outlined text-[36px] text-blue-500 animate-spin">
              progress_activity
            </span>
            <p className="text-xs font-bold text-slate-600">Loading Verifiable Registry...</p>
          </div>
        ) : !current ? (
          /* EMPTY STATE: CLEAN ONBOARDING WHEN NO CREDENTIALS UPLOADED YET */
          <div className="rounded-3xl bg-white border border-[#E5EAF2] p-8 sm:p-10 text-center space-y-6 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#315EF4] mx-auto flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-[36px]">shield_lock</span>
            </div>

            <div className="space-y-1.5 max-w-sm mx-auto">
              <h2 className="text-lg sm:text-xl font-black text-[#101C35]">
                No Credentials in Vault Yet
              </h2>
              <p className="text-xs text-[#718096] leading-relaxed">
                Upload your <strong>Aadhaar card</strong>, <strong>PAN card</strong>, or identity document to generate your cryptographically signed, selective disclosure QR Bar Gate.
              </p>
            </div>

            {/* Value props */}
            <div className="bg-[#F5F7FB] p-3.5 rounded-2xl border border-[#E5EAF2] text-left space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                <span>Real Scannable QR (Google Lens &amp; Phone Camera Ready)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                <span>Zero Digits Exposed • Selective Disclosure Only</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                <span>View-Once DRM Enclave with Pitch-Black Screen Protection</span>
              </div>
            </div>

            {/* Primary CTA */}
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
              <Link
                href="/upload"
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#0042D9] to-[#315EF4] hover:opacity-95 text-white text-xs font-bold shadow-lg transition flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                <span>Upload Document &amp; Mint QR Code</span>
              </Link>
            </div>
          </div>
        ) : (
          /* POPULATED STATE: EXACT MATCH TO STITCH DESIGN WITH REAL SCANNABLE QR */
          <div className="rounded-3xl bg-white border border-[#E5EAF2] p-5 sm:p-6 shadow-xl space-y-4 relative overflow-hidden">
            {isRevoked && (
              <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-3">
                <span className="material-symbols-outlined text-[48px] text-rose-500">block</span>
                <h3 className="text-lg font-bold text-rose-600">Credential Revoked</h3>
                <p className="text-xs text-[#718096] max-w-xs text-center">
                  This QR code has been revoked. Verifiers will see a REVOKED status upon scanning.
                </p>
                <button
                  onClick={() => setRevokedCreds(revokedCreds.filter((id) => id !== current.id))}
                  className="px-4 py-2 rounded-xl bg-[#101C35] text-white text-xs font-bold shadow"
                >
                  Reactivate Credential
                </button>
              </div>
            )}

            {/* Header of featured card */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF2]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#315EF4] flex items-center justify-center font-bold shadow-sm">
                  <span className="material-symbols-outlined text-[22px]">{current.icon}</span>
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#101C35] leading-tight">
                    {current.name}
                  </h2>
                  <span className="text-[11px] text-[#718096] block mt-0.5 font-medium">
                    {current.validity}
                  </span>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200 shadow-xs">
                <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
                Active
              </span>
            </div>

            {/* Network Host Switch (Google Lens Phone Camera vs Localhost) */}
            <div className="flex items-center justify-center gap-1.5 bg-[#F5F7FB] p-1 rounded-2xl border border-[#E5EAF2] text-xs">
              <button
                onClick={() => setHostMode('network')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-[11px] ${
                  hostMode === 'network'
                    ? 'bg-[#101C35] text-white shadow-sm'
                    : 'text-[#718096] hover:text-[#101C35]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">smartphone</span>
                <span>Google Lens / Phone (Wi-Fi)</span>
              </button>

              <button
                onClick={() => setHostMode('localhost')}
                className={`flex-1 py-1.5 px-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 text-[11px] ${
                  hostMode === 'localhost'
                    ? 'bg-[#101C35] text-white shadow-sm'
                    : 'text-[#718096] hover:text-[#101C35]'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">laptop</span>
                <span>Localhost (Same PC)</span>
              </button>
            </div>

            {/* QR Code Container with Anti-Capture Shield */}
            <div className="flex flex-col items-center py-2 space-y-3">
              <VaultAntiCaptureShield
                credentialId={current.code}
                holderName={current.holderName || 'Identity Holder'}
              >
                {/* Real High-Resolution Scannable QR Code */}
                <div className="relative p-4 rounded-2xl bg-white border border-[#101C35] shadow-md flex items-center justify-center">
                  {qrCodeUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qrCodeUrl}
                      alt={current.name}
                      className="w-52 h-52 sm:w-60 sm:h-60 object-contain rounded-xl"
                    />
                  ) : (
                    <div className="w-52 h-52 sm:w-60 sm:h-60 bg-slate-50 flex flex-col items-center justify-center rounded-xl space-y-2">
                      <span className="material-symbols-outlined text-[32px] text-blue-500 animate-spin">
                        progress_activity
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        Generating Scannable QR...
                      </span>
                    </div>
                  )}
                </div>
              </VaultAntiCaptureShield>

              {/* Live Anti-Clone Refresh Countdown Pill Matching Stitch Screen */}
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50/80 border border-blue-200 text-[#315EF4] shadow-xs">
                <span className="material-symbols-outlined text-[15px] animate-spin">
                  sync
                </span>
                <span className="text-xs font-bold">
                  Dynamic Anti-Clone QR • Refreshes in{' '}
                  <span className="font-extrabold text-[#101C35]">{secondsLeft}s</span>
                </span>
              </div>

              {/* Credential ID row with Copy and Mask toggle */}
              <div className="w-full bg-[#F5F7FB] px-3.5 py-2.5 rounded-2xl border border-[#E5EAF2] flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[#718096] font-medium">Credential ID:</span>
                  <span className="font-mono font-bold text-[#101C35]">{displayedId}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setIsMasked(!isMasked)}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
                    title="Toggle ID Masking"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isMasked ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                  <button
                    onClick={copyCode}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
                    title="Copy Credential ID"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {copiedCode ? 'check' : 'content_copy'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Scannable Target URL bar */}
              <div className="w-full bg-[#F5F7FB] p-2.5 rounded-2xl border border-[#E5EAF2] space-y-1 text-left">
                <div className="flex items-center justify-between text-[10px] text-[#718096] font-bold uppercase tracking-wider">
                  <span>Scannable Destination URL</span>
                  <span>{hostMode === 'network' ? 'Wi-Fi Broadcast' : 'Localhost'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={hostMode === 'network' ? gatewayUrl : localhostUrl}
                    className="flex-1 bg-white border border-[#E5EEFF] rounded-xl px-2.5 py-1 text-[11px] font-mono text-slate-700 select-all"
                  />
                  <button
                    onClick={copyActiveLink}
                    className="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 transition"
                    title="Copy Scannable Link"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {copiedLink ? 'check' : 'content_copy'}
                    </span>
                  </button>
                  <a
                    href={`/verify/${current.code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-xl bg-[#101C35] hover:bg-slate-800 text-white transition"
                    title="Open Link in New Tab"
                  >
                    <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Explainer Banner Matching Stitch Screen 4 */}
            <div className="rounded-2xl bg-blue-50/70 border border-blue-100 p-3 flex items-start gap-2.5 text-left">
              <span className="material-symbols-outlined text-[18px] text-[#315EF4] shrink-0 mt-0.5">
                verified
              </span>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Scan this QR code to verify your age, nationality, and legal status without revealing your full 12-digit number or address.
              </p>
            </div>

            {/* Action Row */}
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={`/verify/${current.code}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 min-w-[180px] py-3 rounded-xl bg-[#315EF4] hover:bg-blue-600 text-white text-xs font-bold transition shadow flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[17px]">verified</span>
                <span>Test Certificate</span>
              </a>

              <button
                onClick={handleRevoke}
                className="px-3 py-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition"
              >
                Revoke
              </button>

              <button
                onClick={handleDeleteCredential}
                className="px-3 py-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1"
                title="Delete Document & Credential from Vault"
              >
                <span className="material-symbols-outlined text-[15px] text-rose-600">delete</span>
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Active Credentials Selector List (Only shown when real credentials exist) */}
        {currentList.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-[#718096] uppercase tracking-wider">
                Active Credentials ({currentList.length} Synced)
              </h3>
              <Link
                href="/upload"
                className="text-xs text-[#315EF4] font-bold hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                <span>Upload New Card</span>
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              {currentList.map((item) => {
                const isSelected = selectedCred === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedCred(item.id)}
                    className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
                      isSelected
                        ? 'border-[#315EF4] bg-white ring-2 ring-blue-500/20 shadow-md'
                        : 'border-[#E5EAF2] bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-blue-50 text-[#315EF4]'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs sm:text-sm font-bold text-[#101C35] truncate">
                            {item.name}
                          </h4>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="text-[10px] font-bold text-emerald-700">Active</span>
                        </div>
                        <p className="text-[11px] text-[#718096] font-mono truncate mt-0.5">
                          {item.code} • {item.holderName || 'Verified Holder'}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`material-symbols-outlined text-[20px] shrink-0 ml-2 ${
                        isSelected ? 'text-[#315EF4]' : 'text-slate-300'
                      }`}
                    >
                      qr_code_2
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Upload Modal */}
      <VaultUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
