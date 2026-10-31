'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import VaultUploadModal from '@/components/VaultUploadModal';
import { createClient } from '@/utils/supabase/client';

export default function DashboardPage() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [profile, setProfile] = useState<any>({
    legalName: '',
    email: '',
    phone: '',
    did: 'did:vault:0x89f41b2c3d9021',
  });
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load real profile and credentials from registry
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [pRes, cRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/credentials'),
        ]);

        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.success && pData.profile) {
            setProfile(pData.profile);
          }
        }

        if (cRes.ok) {
          const cData = await cRes.json();
          if (cData.success && Array.isArray(cData.credentials)) {
            setCredentials(cData.credentials);
          }
        }

        // 3. Fallback to active Supabase session (Google OAuth or Email) if local profile empty
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setProfile((prev: any) => ({
              ...prev,
              email: prev.email || user.email || '',
              legalName: prev.legalName || user.user_metadata?.full_name || user.user_metadata?.name || 'Verified User',
            }));
          }
        } catch {}
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalDocs = credentials.length;
  const verifiedDocs = credentials.filter((c) => !c.revoked).length;
  const revokedDocs = credentials.filter((c) => c.revoked).length;

  const initials = profile.legalName
    ? profile.legalName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'VM';

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F7FB] text-[#101C35]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5EAF2] bg-white/90 backdrop-blur-md px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101C35] text-white shadow-sm">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
            <span className="font-extrabold text-lg tracking-wider text-[#101C35] uppercase">
              VERIMASK
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/credentials"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#315EF4]/10 text-[#315EF4] hover:bg-[#315EF4]/20 transition text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
            <span className="hidden sm:inline">QR Credentials</span>
          </Link>

          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#315EF4] text-white hover:bg-blue-600 transition text-xs font-semibold shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
            <span className="hidden sm:inline">Upload Scan</span>
          </Link>

          <Link
            href="/profile"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-[#101C35] hover:bg-slate-200 transition text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[16px]">person</span>
            <span className="hidden sm:inline">Profile Setup</span>
          </Link>

          {/* User Avatar */}
          <Link href="/profile" className="flex items-center gap-2 pl-1" title="Edit Profile">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#101C35] text-white text-xs font-bold ring-2 ring-blue-500/30">
              {initials}
            </div>
          </Link>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* 1. Header & Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101C35] tracking-tight">
              {profile.legalName ? `Hi, ${profile.legalName}!` : 'Zero-Knowledge Identity Vault'}
            </h1>
            <p className="text-xs sm:text-sm text-[#718096] mt-0.5">
              {totalDocs > 0
                ? `You have ${totalDocs} cryptographically attested ${totalDocs === 1 ? 'credential' : 'credentials'} in your vault.`
                : 'Your cryptographic vault is active. Upload your Aadhaar or PAN card to generate your verifiable QR credentials.'}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Vault Secure
            </span>
          </div>
        </div>

        {/* 2. Identity Status Banner */}
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200/60 p-4 sm:p-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#315EF4] text-white shadow-sm">
              <span className="material-symbols-outlined text-[22px]">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#101C35]">Zero-Knowledge Protection</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    totalDocs > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {totalDocs > 0 ? `${totalDocs} Attested Active` : 'Vault Ready'}
                </span>
              </div>
              <p className="text-xs text-[#718096] mt-0.5">
                Selective disclosure enables verification without exposing raw 12-digit Aadhaar numbers or unmasked identity cards.
              </p>
            </div>
          </div>
          <Link
            href="/credentials"
            className="hidden md:flex items-center gap-1 text-xs font-bold text-[#315EF4] hover:underline whitespace-nowrap"
          >
            <span>View QR Gate</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>

        {/* 3. User Identity Card (Navy Gradient) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#101C35] via-[#16274a] to-[#315EF4] p-6 sm:p-8 text-white shadow-xl">
          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-10 pointer-events-none flex items-center justify-center">
            <span className="material-symbols-outlined text-[280px]">shield</span>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md text-white text-xl font-black border border-white/20 shadow-inner">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                    {profile.legalName || 'Vault Holder'}
                  </h2>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-400/30">
                    {totalDocs > 0 ? 'ATTESTED' : 'UNVERIFIED'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1 font-mono">
                  <span>{profile.alias || 'did:vault:0x89f41b2c3d9021'}</span>
                  <span>•</span>
                  <span>Self-Sovereign Identity</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/credentials"
                className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#101C35] hover:bg-slate-100 transition shadow"
              >
                <span className="material-symbols-outlined text-[18px] text-[#315EF4]">
                  qr_code_2
                </span>
                <span>My QR Credentials</span>
              </Link>
              <Link
                href="/upload"
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition shadow"
              >
                <span className="material-symbols-outlined text-[18px]">add_a_photo</span>
                <span>Upload Document</span>
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition"
              >
                <span className="material-symbols-outlined text-[18px]">badge</span>
                <span>Profile Setup</span>
              </Link>
              <Link
                href="/documents"
                className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition"
              >
                <span className="material-symbols-outlined text-[18px]">folder</span>
                <span>Wallet</span>
              </Link>
            </div>
          </div>

          {/* 4. Personal Info Grid Inside Card */}
          <div className="relative z-10 mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10">
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-3 border border-white/10">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block">Registered Email</span>
              <span className="text-xs font-semibold text-white truncate block mt-0.5">
                {profile.email || 'None Configured'}
              </span>
              <span className="text-[10px] text-slate-300 flex items-center gap-1 mt-1 font-semibold">
                <span className="material-symbols-outlined text-[12px]">lock</span> Encrypted
              </span>
            </div>
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-3 border border-white/10">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block">Mobile Number</span>
              <span className="text-xs font-semibold text-white block mt-0.5">
                {profile.phone || 'None Configured'}
              </span>
              <span className="text-[10px] text-slate-300 flex items-center gap-1 mt-1 font-semibold">
                <span className="material-symbols-outlined text-[12px]">smartphone</span> OTP Ready
              </span>
            </div>
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-3 border border-white/10">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block">Account Tier</span>
              <span className="text-xs font-semibold text-white block mt-0.5">Self-Sovereign</span>
              <span className="text-[10px] text-blue-300 flex items-center gap-1 mt-1 font-semibold">
                <span className="material-symbols-outlined text-[12px]">shield</span> ZK Enclave
              </span>
            </div>
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-3 border border-white/10">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block">Verified Credentials</span>
              <span className="text-xs font-semibold text-white block mt-0.5">
                {totalDocs} {totalDocs === 1 ? 'Document' : 'Documents'}
              </span>
              <span className={`text-[10px] flex items-center gap-1 mt-1 font-semibold ${totalDocs > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                <span className="material-symbols-outlined text-[12px]">
                  {totalDocs > 0 ? 'check_circle' : 'pending'}
                </span>{' '}
                {totalDocs > 0 ? 'Active in Registry' : 'Awaiting Upload'}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Quick Access Modules */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#101C35]">Quick Access</h3>
            <span className="text-[11px] text-[#718096]">Modules</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              href="/credentials"
              className="rounded-2xl bg-white border border-[#E5EAF2] p-4 text-center hover:shadow-md hover:border-[#315EF4] transition flex flex-col items-center group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 text-[#315EF4] flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <span className="material-symbols-outlined text-[20px]">qr_code</span>
              </div>
              <span className="text-xs font-bold text-[#101C35]">QR Bar Gate</span>
              <span className="text-[10px] text-[#718096] mt-0.5">Scannable token</span>
            </Link>

            <Link
              href="/upload"
              className="rounded-2xl bg-white border border-[#E5EAF2] p-4 text-center hover:shadow-md hover:border-[#315EF4] transition flex flex-col items-center group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 text-[#315EF4] flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
              </div>
              <span className="text-xs font-bold text-[#101C35]">Upload Card</span>
              <span className="text-[10px] text-[#718096] mt-0.5">Aadhaar / PAN / Scan</span>
            </Link>

            <Link
              href="/documents"
              className="rounded-2xl bg-white border border-[#E5EAF2] p-4 text-center hover:shadow-md hover:border-[#315EF4] transition flex flex-col items-center group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 text-[#315EF4] flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <span className="material-symbols-outlined text-[20px]">folder</span>
              </div>
              <span className="text-xs font-bold text-[#101C35]">My Documents</span>
              <span className="text-[10px] text-[#718096] mt-0.5">Wallet records</span>
            </Link>

            <Link
              href="/profile"
              className="rounded-2xl bg-white border border-[#E5EAF2] p-4 text-center hover:shadow-md hover:border-[#315EF4] transition flex flex-col items-center group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 text-[#315EF4] flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <span className="material-symbols-outlined text-[20px]">person</span>
              </div>
              <span className="text-xs font-bold text-[#101C35]">Profile Setup</span>
              <span className="text-[10px] text-[#718096] mt-0.5">DID &amp; Credentials</span>
            </Link>
          </div>
        </div>

        {/* 6. Document Statistics */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#101C35]">Document Statistics</h3>
            <Link href="/documents" className="text-xs font-semibold text-[#315EF4] hover:underline">
              Manage Wallet
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white border border-[#E5EAF2] p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-[#718096]">Total Documents</span>
                <p className="text-2xl font-black text-[#101C35] mt-1">{totalDocs}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <span className="material-symbols-outlined text-[20px]">folder_copy</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[#E5EAF2] p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-[#718096]">Verified Active</span>
                <p className="text-2xl font-black text-emerald-600 mt-1">{verifiedDocs}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <span className="material-symbols-outlined text-[20px]">verified</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[#E5EAF2] p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-[#718096]">Revoked Tokens</span>
                <p className="text-2xl font-black text-rose-600 mt-1">{revokedDocs}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                <span className="material-symbols-outlined text-[20px]">block</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-[#E5EAF2] p-4 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-[#718096]">Privacy Shield</span>
                <p className="text-2xl font-black text-blue-600 mt-1">100%</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#315EF4]">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
            </div>
          </div>
        </div>

        {/* 7. Recent Verification Activity Section */}
        <div className="rounded-2xl bg-white border border-[#E5EAF2] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5EAF2] pb-3">
            <h3 className="text-sm font-bold text-[#101C35]">Recent Documents in Vault</h3>
            <Link href="/upload" className="text-xs font-semibold text-[#315EF4] hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Upload New</span>
            </Link>
          </div>

          {credentials.length === 0 ? (
            <div className="text-center py-8 space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#315EF4] mx-auto flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-[24px]">inventory_2</span>
              </div>
              <h4 className="text-sm font-bold text-[#101C35]">No Documents Uploaded Yet</h4>
              <p className="text-xs text-[#718096] max-w-sm mx-auto">
                Upload your Aadhaar card or PAN card. Once uploaded, your Zero-Knowledge credential and scannable QR code will appear here.
              </p>
              <div className="pt-1">
                <Link
                  href="/upload"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#315EF4] hover:bg-blue-600 text-white text-xs font-bold shadow transition"
                >
                  <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                  <span>Upload Your First Document</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#E5EAF2]">
              {credentials.map((c: any) => (
                <div key={c.credentialId} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-[#315EF4] flex items-center justify-center border border-blue-100">
                      <span className="material-symbols-outlined text-[20px]">
                        {c.documentType === 'AADHAAR' ? 'badge' : c.documentType === 'PAN' ? 'credit_card' : 'verified_user'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#101C35]">{c.documentType} Attestation</h4>
                      <span className="text-[10px] text-[#718096] font-mono">
                        {c.credentialId} • {c.holderName || 'Verified Citizen'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      {c.verificationStatus || 'VERIFIED'}
                    </span>
                    <Link
                      href={`/verify/${c.credentialId}`}
                      target="_blank"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                      title="Open Certificate"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 8. Promotional Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-[#101C35] to-[#25459b] p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-base font-extrabold tracking-tight">Your Documents. Your Privacy. Your Control.</h3>
            <p className="text-xs text-slate-300 max-w-lg">
              Verify your identity and credentials instantly without exposing raw documents or sensitive identity numbers.
            </p>
          </div>
          <Link
            href="/credentials"
            className="rounded-xl bg-[#315EF4] hover:bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow transition whitespace-nowrap"
          >
            Generate Instant QR
          </Link>
        </div>
      </main>

      {/* Upload Modal */}
      <VaultUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          // Refresh credentials
          window.location.reload();
        }}
      />
    </div>
  );
}
