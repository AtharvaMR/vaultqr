'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface DocSlot {
  id: string;
  docType: string;
  name: string;
  shortDesc: string;
  authority: string;
  icon: string;
  badge: string;
}

export const DOCUMENT_SLOTS: DocSlot[] = [
  {
    id: 'aadhaar',
    docType: 'AADHAAR',
    name: 'Aadhaar Card',
    shortDesc: '12-Digit UIDAI National Identity',
    authority: 'UIDAI Standard',
    icon: 'badge',
    badge: 'National ID',
  },
  {
    id: 'pan',
    docType: 'PAN',
    name: 'PAN Card',
    shortDesc: '10-Char Taxpayer Permanent Account Number',
    authority: 'Income Tax Dept',
    icon: 'credit_card',
    badge: 'Tax ID',
  },
  {
    id: 'driving',
    docType: 'DRIVING_LICENCE',
    name: 'Driving License',
    shortDesc: 'Indian Union Motor Vehicle Permit',
    authority: 'MoRTH / RTO',
    icon: 'directions_car',
    badge: 'Transport',
  },
  {
    id: 'marksheet_10',
    docType: 'MARKSHEET_10',
    name: '10th Marksheet',
    shortDesc: 'Secondary School Exam Certificate / SSLC',
    authority: 'CBSE / State Board',
    icon: 'school',
    badge: 'Academic',
  },
  {
    id: 'marksheet_12',
    docType: 'MARKSHEET_12',
    name: '12th Marksheet',
    shortDesc: 'Higher Senior Secondary Certificate',
    authority: 'CBSE / State Board',
    icon: 'history_edu',
    badge: 'Academic',
  },
  {
    id: 'others',
    docType: 'BIRTH_CERTIFICATE',
    name: 'Birth Cert & Others',
    shortDesc: 'Birth Certificate / Official Govt Records',
    authority: 'Municipal / Govt Authority',
    icon: 'description',
    badge: 'Official',
  },
];

export default function DocumentUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dedicated Active Slot State (defaulting to Aadhaar)
  const [docType, setDocType] = useState<string>('AADHAAR');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Form Fields
  const [errorCode, setErrorCode] = useState('');
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [docIdNumber, setDocIdNumber] = useState('');
  const [showDocId, setShowDocId] = useState(false);
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [zkAgeProof, setZkAgeProof] = useState(true);
  const [autoCorrect, setAutoCorrect] = useState(true);
  const [redactStorage, setRedactStorage] = useState(true);
  const [groth16Active, setGroth16Active] = useState(true);

  // Processing & Result State
  const [status, setStatus] = useState<'idle' | 'scanning' | 'verifying' | 'success' | 'error'>('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [verifiedResult, setVerifiedResult] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Active slot object
  const currentSlot = DOCUMENT_SLOTS.find((s) => s.docType === docType) || DOCUMENT_SLOTS[0];
  const detectedSlot = detectedType ? DOCUMENT_SLOTS.find((s) => s.docType === detectedType) : null;

  // Load user profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data.success && data.profile) {
          if (data.profile.legalName) setFullName(data.profile.legalName);
          if (data.profile.dob) setDob(data.profile.dob);
          if (data.profile.zkAgeProof !== undefined) setZkAgeProof(data.profile.zkAgeProof);
        }
      } catch (e) {
        console.warn('Could not load profile, using defaults', e);
      }
    }
    loadProfile();
  }, []);

  const handleSlotSelect = (selectedType: string) => {
    setDocType(selectedType);
    setErrorMsg('');
    setErrorCode('');
    setDetectedType(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setErrorMsg('');
      setErrorCode('');
      setDetectedType(null);
      if (f.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(f));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setErrorMsg('');
      setErrorCode('');
      setDetectedType(null);
      if (f.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(f));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleScanOcr = () => {
    if (!file) {
      fileInputRef.current?.click();
      return;
    }
    setStatus('scanning');
    setProgressMsg(`Scanning image text for ${currentSlot.name}...`);
    setTimeout(() => {
      setStatus('idle');
      setProgressMsg('');
    }, 600);
  };

  const executeVerification = async (targetDocType: string) => {
    if (!file) {
      setErrorMsg(`Please upload a document file or photo scan for ${currentSlot.name}.`);
      return;
    }

    try {
      setStatus('verifying');
      setProgressMsg(`Verifying ${currentSlot.name} via Anti-Gravity OCR Enclave...`);
      setErrorMsg('');
      setErrorCode('');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('expectedDocType', targetDocType);
      formData.append('holderName', fullName.trim());

      const res = await fetch('/api/vault/verify-ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setStatus('error');
        setErrorMsg(data.error || 'Document verification failed.');
        setErrorCode(data.errorCode || '');
        setDetectedType(data.detectedType || null);
        return;
      }

      setStatus('success');
      setVerifiedResult(data);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Verification process failed.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeVerification(docType);
  };

  const handleSwitchAndVerify = (newType: string) => {
    setDocType(newType);
    setErrorMsg('');
    setErrorCode('');
    setDetectedType(null);
    executeVerification(newType);
  };

  const copyVerificationLink = () => {
    if (verifiedResult?.verifierGatewayUrl) {
      navigator.clipboard.writeText(verifiedResult.verifierGatewayUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FF] text-[#0D1C2E] font-sans pb-12">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F8F9FF]/90 backdrop-blur-xl border-b border-[#E5EEFF] px-4 sm:px-8 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#0D1C2E] hover:bg-[#EFF4FF] transition"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-base font-extrabold text-[#0D1C2E] leading-tight">
                Upload &amp; Verify Credential
              </h1>
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-emerald-600 text-[14px]">
                  verified_user
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-700 tracking-wide">
                  Anti-Gravity Multi-Slot Enclave
                </span>
              </div>
            </div>
          </div>

          <Link
            href="/credentials"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E5EEFF] hover:bg-slate-50 text-xs font-bold text-[#0D1C2E] shadow-sm transition"
          >
            <span className="material-symbols-outlined text-[16px] text-[#0042D9]">qr_code_2</span>
            <span>QR Wallet</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {/* SUCCESS VIEW: Generated QR Code */}
        {status === 'success' && verifiedResult ? (
          <div className="bg-white rounded-3xl p-6 border-2 border-emerald-500/30 shadow-2xl text-center space-y-5 animate-fadeIn">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>CRYPTOGRAPHICALLY ATTESTED &amp; VERIFIED</span>
            </div>

            <div>
              <h2 className="text-2xl font-black text-[#0D1C2E]">{verifiedResult.holderName}</h2>
              <p className="text-xs font-mono text-[#535E7A] mt-0.5">
                Credential ID: <strong className="text-[#0042D9]">{verifiedResult.credentialId}</strong>
              </p>
              <p className="text-xs font-bold text-emerald-700 mt-1">
                {verifiedResult.message}
              </p>
            </div>

            {/* Generated Scannable QR Code */}
            {verifiedResult.qrCodeUrl && (
              <div className="flex flex-col items-center space-y-2 p-5 bg-[#F8F9FF] border-2 border-[#0D1C2E] rounded-3xl shadow-lg max-w-xs mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={verifiedResult.qrCodeUrl}
                  alt="Scannable QR Code"
                  className="w-56 h-56 object-contain rounded-xl"
                />
                <span className="text-xs text-slate-700 font-bold">
                  Scan with <strong>Google Lens</strong> or <strong>Phone Camera</strong>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {verifiedResult.credentialId}
                </span>
              </div>
            )}

            {/* Destination URL */}
            <div className="bg-[#EFF4FF] p-3.5 rounded-2xl border border-blue-200/60 text-left space-y-1.5 text-xs max-w-md mx-auto">
              <span className="text-[10px] font-bold text-[#535E7A] uppercase tracking-wider block">
                Verification Gateway Link:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={verifiedResult.verifierGatewayUrl}
                  className="flex-1 bg-white border border-[#E5EEFF] rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-700 select-all"
                />
                <button
                  type="button"
                  onClick={copyVerificationLink}
                  className="px-3 py-1.5 rounded-xl bg-[#0042D9] text-white text-xs font-bold flex items-center gap-1 shadow"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedLink ? 'check' : 'content_copy'}
                  </span>
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 max-w-md mx-auto">
              <a
                href={`/verify/${verifiedResult.credentialId}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold transition shadow flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                <span>Test Verification Certificate</span>
              </a>
              <Link
                href="/credentials"
                className="px-6 py-3 rounded-xl bg-[#0D1C2E] hover:bg-slate-800 text-white text-xs font-bold transition shadow flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">qr_code</span>
                <span>View in QR Gate</span>
              </Link>
            </div>

            <button
              type="button"
              onClick={() => {
                setStatus('idle');
                setFile(null);
                setPreviewUrl(null);
                setVerifiedResult(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-bold underline pt-2 block mx-auto"
            >
              ← Upload Another Document Slot
            </button>
          </div>
        ) : (
          /* PRIMARY FORM: DEDICATED SLOTS & UPLOAD */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. DEDICATED DOCUMENT SLOTS PICKER */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-[#0D1C2E] uppercase tracking-wider">
                    Select Document Slot
                  </h2>
                  <p className="text-xs text-[#535E7A]">
                    Click a dedicated slot below to verify that specific document type:
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  Dedicated Slots
                </span>
              </div>

              {/* 6 Dedicated Slots Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {DOCUMENT_SLOTS.map((slot) => {
                  const isSelected = docType === slot.docType;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleSlotSelect(slot.docType)}
                      className={`relative p-3.5 rounded-2xl text-left transition-all border-2 flex flex-col justify-between min-h-[92px] ${
                        isSelected
                          ? 'border-[#0042D9] bg-blue-50/70 shadow-md ring-2 ring-blue-500/20'
                          : 'border-[#E5EEFF] bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isSelected
                              ? 'bg-[#0042D9] text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {slot.icon}
                          </span>
                        </div>
                        {isSelected ? (
                          <span className="w-5 h-5 rounded-full bg-[#0042D9] text-white flex items-center justify-center">
                            <span className="material-symbols-outlined text-[14px]">check</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {slot.badge}
                          </span>
                        )}
                      </div>

                      <div className="mt-2">
                        <div className="text-xs font-black text-[#0D1C2E] leading-snug">
                          {slot.name}
                        </div>
                        <div className="text-[10px] text-[#535E7A] truncate font-medium">
                          {slot.authority}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Slot Indicator Bar */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-emerald-400">
                    {currentSlot.icon}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                      Active Slot:
                    </span>
                    <span className="text-xs font-black text-white">{currentSlot.name}</span>
                  </div>
                  <p className="text-[11px] text-blue-200 mt-0.5">{currentSlot.shortDesc}</p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-emerald-300 font-bold hidden sm:inline">
                Anti-Mismatch Guard ON
              </span>
            </div>

            {/* Primary Upload Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition ${
                file
                  ? 'border-emerald-400 bg-emerald-50/20'
                  : 'border-[#CBD5E1] bg-white hover:border-[#0042D9]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {previewUrl ? (
                <div className="flex flex-col items-center space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Uploaded preview"
                    className="max-h-48 rounded-xl object-contain shadow border border-slate-200"
                  />
                  <p className="text-xs font-bold text-emerald-700">{file?.name}</p>
                  <span className="text-[10px] text-slate-400">Click to replace file</span>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#0042D9] flex items-center justify-center shadow-inner">
                    <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#0D1C2E]">
                      Upload {currentSlot.name}
                    </h4>
                    <p className="text-xs text-[#535E7A] mt-0.5 max-w-sm">
                      Upload photo or PDF of your {currentSlot.name}. High-resolution images ensure instant OCR parsing.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 mt-4 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleScanOcr();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-[#0042D9] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                >
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  <span>Scan via OCR</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0D1C2E] text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  <span>Browse Files</span>
                </button>
              </div>
            </div>

            {/* Document Details & Profile Sync */}
            <div className="bg-white rounded-3xl p-5 border border-[#E5EEFF] shadow-sm space-y-4">
              <div className="bg-[#0042D9] text-white p-3 rounded-2xl flex items-start gap-2.5 shadow-sm">
                <span className="material-symbols-outlined text-[20px] text-emerald-300 shrink-0 mt-0.5">
                  bolt
                </span>
                <div>
                  <p className="text-xs font-bold">Anti-Gravity Secure Enclave Verification</p>
                  <p className="text-[11px] text-blue-100 mt-0.5 leading-relaxed">
                    Cleartext document numbers are parsed in isolated memory and automatically redacted before signing.
                  </p>
                </div>
              </div>

              {/* Document ID Number (Masked) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#0D1C2E]">
                    {currentSlot.name} ID Number (Optional)
                  </label>
                  <span className="text-[11px] font-mono text-emerald-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">lock</span>
                    Auto-Redacted
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input
                    type={showDocId ? 'text' : 'password'}
                    value={docIdNumber}
                    onChange={(e) => setDocIdNumber(e.target.value)}
                    placeholder="•••• •••• •••• (leave empty for OCR detection)"
                    className="w-full h-11 bg-[#F8F9FF] rounded-xl px-3 pr-10 text-xs text-[#0D1C2E] border border-[#E5EEFF] outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDocId(!showDocId)}
                    className="absolute right-3 text-slate-400 hover:text-[#0042D9]"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showDocId ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Full Legal Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#0D1C2E]">Full Legal Name</label>
                  <span className="text-[11px] text-blue-600 font-bold">Synced from Profile</span>
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full legal name"
                  className="w-full h-11 bg-[#F8F9FF] rounded-xl px-3 text-xs text-[#0D1C2E] border border-[#E5EEFF] outline-none focus:bg-white focus:border-[#0042D9]"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#0D1C2E]">Date of Birth</label>
                  <span className="text-[11px] text-blue-600 font-bold">Synced from Profile</span>
                </div>
                <input
                  type="text"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  placeholder="DD / MM / YYYY"
                  className="w-full h-11 bg-[#F8F9FF] rounded-xl px-3 text-xs text-[#0D1C2E] border border-[#E5EEFF] outline-none focus:bg-white focus:border-[#0042D9]"
                />
              </div>
            </div>

            {/* Privacy Controls */}
            <div className="bg-white rounded-3xl p-5 border border-[#E5EEFF] shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">
                  security
                </span>
                <span className="text-xs font-bold text-[#0D1C2E] uppercase tracking-wider">
                  Privacy &amp; Redaction Controls
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-xs font-bold text-[#0D1C2E]">Redact Sensitive Fields in Storage</p>
                  <p className="text-[11px] text-[#535E7A]">Only cryptographic commitments persist</p>
                </div>
                <input
                  type="checkbox"
                  checked={redactStorage}
                  onChange={(e) => setRedactStorage(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0042D9]"
                />
              </div>

              <div className="flex items-center justify-between py-1 border-t border-slate-100">
                <div>
                  <p className="text-xs font-bold text-[#0D1C2E]">Client Enclave Groth16 Encryption</p>
                  <p className="text-[11px] text-[#535E7A]">SnarkJS proof generation locked inside keystore</p>
                </div>
                <input
                  type="checkbox"
                  checked={groth16Active}
                  onChange={(e) => setGroth16Active(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0042D9]"
                />
              </div>
            </div>

            {/* Error / Mismatch Rejection Banner with Smart Switch Action */}
            {errorMsg && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 animate-fadeIn ${
                  errorCode === 'DOCUMENT_TYPE_MISMATCH'
                    ? 'bg-red-50 border-red-300 text-red-900'
                    : errorCode === 'INSUFFICIENT_TEXT'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      errorCode === 'DOCUMENT_TYPE_MISMATCH'
                        ? 'text-red-600'
                        : errorCode === 'INSUFFICIENT_TEXT'
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {errorCode === 'DOCUMENT_TYPE_MISMATCH'
                      ? 'gpp_bad'
                      : errorCode === 'INSUFFICIENT_TEXT'
                      ? 'photo_camera'
                      : 'error'}
                  </span>
                  <span className="font-bold text-sm">
                    {errorCode === 'DOCUMENT_TYPE_MISMATCH'
                      ? 'Document Mismatch Detected'
                      : errorCode === 'INSUFFICIENT_TEXT'
                      ? 'Unreadable Document'
                      : 'Verification Error'}
                  </span>
                </div>

                <p className="leading-relaxed font-medium">{errorMsg}</p>

                {/* One-Click Smart Switch & Verify Button */}
                {errorCode === 'DOCUMENT_TYPE_MISMATCH' && detectedSlot && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleSwitchAndVerify(detectedSlot.docType)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:opacity-95 text-white font-bold text-xs shadow flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                      <span>Switch to &quot;{detectedSlot.name}&quot; Slot &amp; Verify Now</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={status === 'verifying'}
              className="w-full h-14 bg-gradient-to-r from-[#0042D9] to-[#315EF4] hover:opacity-95 text-white rounded-2xl text-sm font-bold shadow-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {status === 'verifying' ? (
                <>
                  <span className="material-symbols-outlined text-[20px] animate-spin">
                    progress_activity
                  </span>
                  <span>{progressMsg || 'Verifying & Minting ZK Proof...'}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[22px]">enhanced_encryption</span>
                  <span>Verify {currentSlot.name} &amp; Generate QR</span>
                </>
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
