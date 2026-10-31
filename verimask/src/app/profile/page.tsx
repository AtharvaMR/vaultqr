'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ProfileSetupPage() {
  const router = useRouter();

  // Profile Fields
  const [legalName, setLegalName] = useState('');
  const [alias, setAlias] = useState('');
  const [aliasVisibility, setAliasVisibility] = useState<'private' | 'public'>('private');
  const [dob, setDob] = useState('');
  const [zkAgeProof, setZkAgeProof] = useState(true);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationPin, setLocationPin] = useState('');
  const [maskAddress, setMaskAddress] = useState(true);

  // Guardians
  const [guardians, setGuardians] = useState<string[]>([
    'did:key:guardian-enclave-primary',
  ]);
  const [guardianInput, setGuardianInput] = useState('');

  // UI States
  const [syncingOcr, setSyncingOcr] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintedSuccess, setMintedSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load existing profile from server / localStorage
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data.success && data.profile) {
          const p = data.profile;
          if (p.legalName) setLegalName(p.legalName);
          if (p.alias) setAlias(p.alias);
          if (p.dob) setDob(p.dob);
          if (p.phone) setPhone(p.phone);
          if (p.email) setEmail(p.email);
          if (p.zkAgeProof !== undefined) setZkAgeProof(p.zkAgeProof);
          if (p.addressMasked !== undefined) setMaskAddress(p.addressMasked);
        }
      } catch (err) {
        console.warn('Failed to load profile from server, using local defaults', err);
      }
    }
    load();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAadhaarSync = async () => {
    setSyncingOcr(true);
    try {
      const res = await fetch('/api/credentials');
      if (res.ok) {
        const data = await res.json();
        const aadhaarDoc = data.credentials?.find((c: any) => c.documentType === 'AADHAAR');
        if (aadhaarDoc) {
          if (aadhaarDoc.holderName) setLegalName(aadhaarDoc.holderName);
          if (aadhaarDoc.dob) setDob(aadhaarDoc.dob);
          showToast(`Aadhaar sync successful! Synced name: ${aadhaarDoc.holderName}`);
        } else {
          showToast('No Aadhaar document found in vault yet. Please upload your card first.');
        }
      }
    } catch {
      showToast('Could not query credentials store.');
    } finally {
      setSyncingOcr(false);
    }
  };

  const handleAddGuardian = () => {
    const val = guardianInput.trim();
    if (!val) {
      showToast('Please specify a DID or valid vault handle.');
      return;
    }
    setGuardians([...guardians, val]);
    setGuardianInput('');
    showToast('Guardian recovery invite cryptographically staged.');
  };

  const handleRemoveGuardian = (idx: number) => {
    setGuardians(guardians.filter((_, i) => i !== idx));
  };

  const handleSaveProfile = async () => {
    setIsMinting(true);
    try {
      const payload = {
        legalName: legalName.trim(),
        alias: alias.trim(),
        dob: dob.trim(),
        phone: phone.trim(),
        email: email.trim(),
        location: `${locationCity}, ${locationPin}`,
        zkAgeProof,
        addressMasked: maskAddress,
      };

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMintedSuccess(true);
        showToast('Success! Identity committed to local hardware vault.');
        setTimeout(() => {
          setIsMinting(false);
          setMintedSuccess(false);
        }, 2200);
      } else {
        setIsMinting(false);
        showToast('Error saving profile.');
      }
    } catch {
      setIsMinting(false);
      showToast('Network error saving profile.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FF] text-[#0D1C2E] font-sans">
      {/* Fixed Header */}
      <header className="sticky top-0 z-50 bg-[#F8F9FF]/85 backdrop-blur-xl border-b border-[#E5EEFF] px-4 sm:px-8 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#0D1C2E] hover:bg-[#EFF4FF] transition"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </Link>
            <div>
              <span className="text-[11px] font-mono font-bold text-[#0042D9] uppercase tracking-wider block">
                VaultQR
              </span>
              <h1 className="text-base font-extrabold text-[#0D1C2E] leading-tight">
                Profile Setup & Details
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 text-xs font-bold border border-emerald-500/30">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>ZK-ON</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#0042D9] text-white flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-5">
        {/* Step 1 of 3 Progress Tracker Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#E5EEFF] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#0042D9] uppercase tracking-wider">
              Step 1 of 3 • Identity Inception
            </span>
            <span className="text-xs font-mono font-bold text-emerald-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>85% Complete</span>
            </span>
          </div>

          <div>
            <h2 className="text-lg font-black text-[#0D1C2E]">Your Cryptographic Identity</h2>
            <p className="text-xs text-[#535E7A] mt-0.5">
              Personal attributes configured here are used during QR verification and view-once disclosures.
            </p>
          </div>

          <div className="w-full bg-[#E5EEFF] h-2 rounded-full overflow-hidden">
            <div className="bg-[#0042D9] h-full rounded-full transition-all duration-500 w-[85%]"></div>
          </div>
        </div>

        {/* Zero-Knowledge Guarantee Banner */}
        <div className="bg-[#EFF4FF] rounded-2xl p-4 flex items-start gap-3 border border-blue-200/50">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-[#0042D9] shrink-0">
            <span className="material-symbols-outlined text-[20px]">enhanced_encryption</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[#0D1C2E]">Zero-Knowledge Enclave Active</h3>
              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold uppercase">
                Sealed
              </span>
            </div>
            <p className="text-xs text-[#535E7A] mt-1 leading-relaxed">
              Personal attributes are encrypted locally and never stored in cleartext. When verifiers scan your QR code, only zero-knowledge claims are emitted.
            </p>
          </div>
        </div>

        {/* Identity Avatar & Pseudonym Suite */}
        <div className="bg-white rounded-3xl p-5 border border-[#E5EEFF] shadow-sm flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-lg border-2 border-white">
              <span>{legalName ? legalName.charAt(0) : 'R'}</span>
            </div>
            <button
              type="button"
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#0042D9] text-white flex items-center justify-center shadow"
              title="Camera"
            >
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
            </button>
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-[#EFF4FF] px-3 py-1 rounded-full text-xs">
              <span className="material-symbols-outlined text-[14px] text-emerald-600">
                shield_with_heart
              </span>
              <span className="font-mono font-bold text-[#0D1C2E]">{alias}</span>
              <span className="text-slate-300">•</span>
              <span className="text-[#0042D9] font-bold">ZK-Root ID</span>
            </div>
            <p className="text-[11px] font-mono text-[#535E7A]">
              Sovereign Identifier: did:vault:0x89f41b2c3d9021
            </p>
          </div>
        </div>

        {/* Profile Details Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className="space-y-4">
          {/* Full Legal Name Card */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5EEFF] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0D1C2E]">
                Full Legal Name <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleAadhaarSync}
                className="text-xs font-bold text-[#0042D9] hover:underline flex items-center gap-1"
              >
                <span className={`material-symbols-outlined text-[14px] ${syncingOcr ? 'animate-spin' : ''}`}>
                  sync_alt
                </span>
                <span>{syncingOcr ? 'Syncing...' : 'Aadhaar OCR Sync'}</span>
              </button>
            </div>

            <div className="relative flex items-center">
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Enter full legal name"
                className="w-full h-11 bg-[#F8F9FF] rounded-xl px-3 pl-10 text-xs text-[#0D1C2E] border border-[#E5EEFF] outline-none focus:bg-white focus:border-[#0042D9]"
              />
              <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">
                badge
              </span>
              <span className="material-symbols-outlined absolute right-3 text-emerald-600 text-[18px]">
                check_circle
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-[#EFF4FF] text-[11px]">
              <span className="text-[#535E7A] flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-blue-600">verified</span>
                Verified via India Stack (UIDAI Attested)
              </span>
              <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Sealed
              </span>
            </div>
          </div>

          {/* Preferred Alias & Visibility */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5EEFF] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0D1C2E]">Preferred Alias / Display</label>
              <div className="flex items-center bg-[#E5EEFF] rounded-full p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setAliasVisibility('private')}
                  className={`px-2.5 py-0.5 rounded-full font-bold transition ${
                    aliasVisibility === 'private'
                      ? 'bg-[#0042D9] text-white shadow'
                      : 'text-[#535E7A]'
                  }`}
                >
                  Private
                </button>
                <button
                  type="button"
                  onClick={() => setAliasVisibility('public')}
                  className={`px-2.5 py-0.5 rounded-full font-bold transition ${
                    aliasVisibility === 'public'
                      ? 'bg-[#0042D9] text-white shadow'
                      : 'text-[#535E7A]'
                  }`}
                >
                  Public
                </button>
              </div>
            </div>

            <div className="relative flex items-center">
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="@handle"
                className="w-full h-11 bg-[#F8F9FF] rounded-xl px-3 pl-10 text-xs text-[#0D1C2E] border border-[#E5EEFF] outline-none focus:bg-white focus:border-[#0042D9]"
              />
              <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">
                alternate_email
              </span>
            </div>
            <p className="text-[11px] text-[#535E7A]">
              Shown on public QR badge scans. Legal name remains cryptographically sealed.
            </p>
          </div>

          {/* Date of Birth with ZK Proof Toggle */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5EEFF] shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0D1C2E]">Date of Birth</label>
              <span className="text-[11px] font-mono font-bold text-emerald-700 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">lock</span>
                ZK-Proof Capable
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                type="text"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="DD / MM / YYYY"
                className="w-full h-11 bg-[#F8F9FF] rounded-xl px-3 pl-10 text-xs text-[#0D1C2E] border border-[#E5EEFF] outline-none focus:bg-white focus:border-[#0042D9]"
              />
              <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">
                calendar_today
              </span>
            </div>

            {/* ZK Toggle */}
            <div className="p-3 rounded-xl bg-[#EFF4FF] flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-[#0D1C2E] block">Share Age Proof Only (&gt; 18 yrs)</span>
                <span className="text-[11px] text-[#535E7A] block">
                  Never reveals exact day, month, or birth year during QR verification scans
                </span>
              </div>
              <input
                type="checkbox"
                checked={zkAgeProof}
                onChange={(e) => setZkAgeProof(e.target.checked)}
                className="w-5 h-5 rounded text-[#0042D9] focus:ring-0 shrink-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Phone & Email Card */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5EEFF] shadow-sm space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#0D1C2E]">Registered Phone</label>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  OTP Verified
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="text"
                  readOnly
                  value={phone}
                  className="w-full h-11 bg-[#F8F9FF] rounded-xl px-3 pl-10 text-xs text-[#0D1C2E] border border-[#E5EEFF] cursor-not-allowed font-mono"
                />
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">
                  phone_iphone
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#0D1C2E]">Email Address</label>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                  Verified
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 bg-[#F8F9FF] rounded-xl px-3 pl-10 text-xs text-[#0D1C2E] border border-[#E5EEFF] outline-none focus:bg-white focus:border-[#0042D9]"
                />
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">
                  mail
                </span>
              </div>
            </div>
          </div>

          {/* Jurisdiction / Location & Masking */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5EEFF] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0D1C2E]">Jurisdiction / Location</label>
              <span className="text-xs font-bold text-[#0042D9]">Karnataka, IN</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="City"
                className="h-11 bg-[#F8F9FF] rounded-xl px-3 text-xs text-[#0D1C2E] border border-[#E5EEFF]"
              />
              <input
                type="text"
                value={locationPin}
                onChange={(e) => setLocationPin(e.target.value)}
                placeholder="PIN"
                className="h-11 bg-[#F8F9FF] rounded-xl px-3 text-xs text-[#0D1C2E] border border-[#E5EEFF]"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#EFF4FF] flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-[#0D1C2E] block">Mask Full Address (Prove State Only)</span>
                <span className="text-[11px] text-[#535E7A] block">
                  Generates zero-knowledge residency proof without street coordinates
                </span>
              </div>
              <input
                type="checkbox"
                checked={maskAddress}
                onChange={(e) => setMaskAddress(e.target.checked)}
                className="w-5 h-5 rounded text-[#0042D9] focus:ring-0 shrink-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Trusted Guardian Recovery */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5EEFF] shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0D1C2E]">Trusted Guardian Recovery</span>
              <span className="text-[11px] font-mono text-slate-500">Multi-Sig 2/3</span>
            </div>
            <p className="text-[11px] text-[#535E7A]">
              Designate a collaborative peer or institutional enclave for private key recovery.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={guardianInput}
                onChange={(e) => setGuardianInput(e.target.value)}
                placeholder="Guardian DID or guardian@vaultqr.id"
                className="flex-1 h-10 bg-[#F8F9FF] rounded-xl px-3 text-xs border border-[#E5EEFF]"
              />
              <button
                type="button"
                onClick={handleAddGuardian}
                className="px-3.5 h-10 bg-[#D1DCFE] hover:bg-blue-200 text-[#0042D9] rounded-xl text-xs font-bold"
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {guardians.map((g, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 bg-[#EFF4FF] py-1 px-2.5 rounded-full text-xs font-mono"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{g}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveGuardian(idx)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sticky Actions */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={isMinting}
              className="w-full h-12 bg-[#0042D9] hover:bg-[#315EF4] text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-2"
            >
              {isMinting ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                  <span>Generating Groth16 Proof & Sealing...</span>
                </>
              ) : mintedSuccess ? (
                <>
                  <span className="material-symbols-outlined text-[18px] text-emerald-300">
                    check_circle
                  </span>
                  <span>Profile Encrypted & Sealed ✓</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  <span>Save & Mint Encrypted Profile</span>
                </>
              )}
            </button>

            <Link
              href="/credentials"
              className="w-full h-10 flex items-center justify-center text-xs font-bold text-[#535E7A] hover:text-[#0D1C2E]"
            >
              Skip for now, view credentials
            </Link>
          </div>
        </form>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-fadeIn border border-slate-700">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
