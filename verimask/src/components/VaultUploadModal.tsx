'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { SupportedDocType } from '@/lib/ocrSpaceVerifier';

export const DOC_OPTIONS: { value: SupportedDocType; label: string }[] = [
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'PAN', label: 'PAN Card' },
  { value: 'DRIVING_LICENCE', label: 'Driving Licence' },
  { value: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
  { value: 'MARKSHEET_10', label: 'Class 10 Marksheet' },
  { value: 'MARKSHEET_12', label: 'Class 12 Marksheet' },
];

interface VaultUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
}

export default function VaultUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: VaultUploadModalProps) {
  const [selectedDocType, setSelectedDocType] = useState<SupportedDocType>('AADHAAR');
  const [holderName, setHolderName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'VERIFIED' | 'REJECTED'>('IDLE');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [certificate, setCertificate] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [gatewayUrl, setGatewayUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [detectedType, setDetectedType] = useState<SupportedDocType | null>(null);

  if (!isOpen) return null;

  const handleUploadAndVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setStatus('REJECTED');
      setFeedbackMessage('Please select a document file to upload.');
      return;
    }

    setStatus('SCANNING');
    setFeedbackMessage('Scanning document and verifying category markers via OCR.space...');
    setCertificate(null);
    setQrCodeUrl(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('expectedDocType', selectedDocType);
      if (holderName.trim()) {
        formData.append('holderName', holderName.trim());
      }

      const response = await fetch('/api/vault/verify-ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setStatus('REJECTED');
        setFeedbackMessage(data.message || data.error || 'Document verification failed.');
        setDetectedType(data.detectedType || null);
        return;
      }
      setDetectedType(null);

      setStatus('VERIFIED');
      setFeedbackMessage(data.message || 'Document authenticated and verified successfully.');
      setCertificate(data.certificate);
      setQrCodeUrl(data.qrCodeUrl || null);
      setGatewayUrl(data.verifierGatewayUrl || '');

      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err: any) {
      setStatus('REJECTED');
      setFeedbackMessage('Network error while verifying document. Please check connection and try again.');
    }
  };

  const copyGatewayLink = () => {
    if (gatewayUrl) {
      navigator.clipboard.writeText(gatewayUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white border border-[#E5EEFF] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5EEFF]">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#0D1C2E]">Upload &amp; Verify Credential</h2>
            <p className="text-xs text-[#535E7A] mt-0.5">
              Upload once. Verify instantly. Reveal selectively with Zero-Knowledge protection.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleUploadAndVerify} className="space-y-4">
          {/* Select Credential Type */}
          <div>
            <label className="block text-xs font-bold text-[#0D1C2E] mb-1">
              Select Credential Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedDocType}
              onChange={(e) => {
                setSelectedDocType(e.target.value as SupportedDocType);
                setStatus('IDLE');
                setFeedbackMessage('');
              }}
              className="w-full h-11 rounded-xl border border-[#E5EEFF] bg-[#F8F9FF] px-3 text-xs font-semibold text-[#0D1C2E] outline-none focus:bg-white focus:border-[#0042D9]"
            >
              {DOC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-[#535E7A] mt-1 block">
              Mismatch protection active: uploading a PAN Card when Aadhaar Card is selected will be rejected.
            </span>
          </div>

          {/* Optional Holder Name */}
          <div>
            <label className="block text-xs font-bold text-[#0D1C2E] mb-1">
              Holder Name (Optional)
            </label>
            <input
              type="text"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              placeholder="e.g. Rahul Sharma (or leave blank for OCR auto-detect)"
              className="w-full h-11 rounded-xl border border-[#E5EEFF] bg-[#F8F9FF] px-3 text-xs text-[#0D1C2E] outline-none focus:bg-white focus:border-[#0042D9]"
            />
          </div>

          {/* Document File Input */}
          <div>
            <label className="block text-xs font-bold text-[#0D1C2E] mb-1">
              Document File (JPG, PNG, or PDF) <span className="text-rose-500">*</span>
            </label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setStatus('IDLE');
                setFeedbackMessage('');
              }}
              className="w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#EFF4FF] file:text-[#0042D9] hover:file:bg-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'SCANNING'}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[#0042D9] to-[#315EF4] hover:opacity-95 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {status === 'SCANNING' ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">
                  progress_activity
                </span>
                <span>Verifying Document &amp; Checking Mismatch...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                <span>Verify &amp; Generate Credential QR</span>
              </>
            )}
          </button>
        </form>

        {/* Rejection Alert Banner (e.g., Aadhaar selected but PAN uploaded) */}
        {status === 'REJECTED' && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-2 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-red-700 font-bold">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>Document Rejected</span>
            </div>
            <p className="leading-relaxed font-medium">{feedbackMessage}</p>
            {detectedType && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDocType(detectedType);
                  setStatus('IDLE');
                  setFeedbackMessage('');
                  setDetectedType(null);
                }}
                className="mt-1 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] flex items-center gap-1.5 shadow"
              >
                <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                <span>Switch to detected category and retry</span>
              </button>
            )}
          </div>
        )}

        {/* Approved Certificate Preview with Scannable QR Code */}
        {status === 'VERIFIED' && certificate && (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-3 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>VaultQR Verified Certificate Issued</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-emerald-200/60 space-y-1.5 font-mono text-[11px]">
              <p><span className="font-sans font-bold text-slate-600">Credential ID:</span> <strong className="text-[#0042D9]">{certificate.credentialId}</strong></p>
              <p><span className="font-sans font-bold text-slate-600">Document Type:</span> {certificate.documentType}</p>
              <p><span className="font-sans font-bold text-slate-600">Holder:</span> {certificate.holderName}</p>
              <p><span className="font-sans font-bold text-slate-600">ID Number:</span> {certificate.maskedIdentifier}</p>
              <p><span className="font-sans font-bold text-slate-600">Status:</span> <span className="font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">{certificate.verificationStatus}</span></p>
            </div>

            {/* Generated QR Code */}
            {qrCodeUrl && (
              <div className="p-3 bg-white rounded-xl border border-emerald-200 flex flex-col items-center text-center space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeUrl}
                  alt="Scannable QR Code"
                  className="w-44 h-44 object-contain rounded-lg shadow-sm"
                />
                <span className="text-[11px] font-bold text-slate-700">
                  Ready to scan with <strong>Google Lens</strong> or <strong>Phone Camera</strong>
                </span>

                <div className="w-full flex items-center gap-1 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={gatewayUrl}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-mono select-all text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={copyGatewayLink}
                    className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold"
                  >
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Link
                href={`/verify/${certificate.credentialId}`}
                target="_blank"
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold text-center flex items-center justify-center gap-1 shadow"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                <span>Open Certificate</span>
              </Link>
              <Link
                href="/credentials"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-[#0D1C2E] hover:bg-slate-800 text-white text-xs font-bold text-center flex items-center justify-center gap-1 shadow"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                <span>View in QR Gate</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
