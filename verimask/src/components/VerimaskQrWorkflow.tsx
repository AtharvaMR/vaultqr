'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import type { CredentialDocType, PublicVerificationPayload } from '@/lib/vaultQrEngine';
import { VaultAntiCaptureShield } from '@/components/VaultAntiCaptureShield';

export default function VerimaskQrWorkflow() {
  const [activeTab, setActiveTab] = useState<'GENERATOR' | 'SCANNER'>('GENERATOR');

  // --- Generator State ---
  const [holderName, setHolderName] = useState('Demo User');
  const [documentType, setDocumentType] = useState<CredentialDocType>('EDUCATION_CERTIFICATE');
  const [generatedData, setGeneratedData] = useState<{
    credentialId: string;
    verificationToken: string;
    verificationUrl: string;
    qrDataUrl: string;
    publicClaims: PublicVerificationPayload;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // --- Scanner State ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const [isCameraScanning, setIsCameraScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<PublicVerificationPayload | null>(null);
  const [scanError, setScanError] = useState<string>('');

  // Stop webcam cleanly when unmounting or switching tabs
  useEffect(() => {
    return () => {
      scannerControlsRef.current?.stop();
    };
  }, []);

  // 1. Generate Credential ID + Secret Verification ID + QR Code
  const handleGenerateCredentialQr = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/credentials/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE',
          holderName,
          documentType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedData(data);
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Regenerate QR Code (rotates Secret Verification Token)
  const handleRegenerateQr = async () => {
    if (!generatedData) return;
    setLoading(true);
    try {
      const res = await fetch('/api/credentials/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REGENERATE',
          credentialId: generatedData.credentialId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedData((prev) =>
          prev
            ? {
                ...prev,
                verificationToken: data.verificationToken,
                verificationUrl: data.verificationUrl,
                qrDataUrl: data.qrDataUrl,
              }
            : null
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Revoke Credential
  const handleRevokeCredential = async () => {
    if (!generatedData) return;
    const res = await fetch('/api/credentials/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'REVOKE',
        credentialId: generatedData.credentialId,
      }),
    });
    if (res.ok) {
      setGeneratedData((prev) =>
        prev
          ? {
              ...prev,
              publicClaims: {
                ...prev.publicClaims,
                valid: false,
                verificationStatus: 'REVOKED',
                revoked: true,
              },
            }
          : null
      );
    }
  };

  // 4. Resolve Scanned URL / Token against Backend API
  const resolveScannedQrText = async (rawScannedText: string) => {
    setScanError('');
    try {
      // Extract token whether QR contains full URL (https://.../verify/vtok_xxx) or raw token
      const tokenMatch = rawScannedText.split('/verify/').pop()?.split('?')[0] || rawScannedText;
      const response = await fetch(`/api/v/${encodeURIComponent(tokenMatch)}`);
      const payload: PublicVerificationPayload = await response.json();
      setScannedResult(payload);
    } catch (err) {
      setScanError('Failed to verify QR credential with server.');
    }
  };

  // 5. Start Live Camera QR Scanning via @zxing/browser (browser-master)
  const startCameraScanner = async () => {
    setScanError('');
    setScannedResult(null);
    setIsCameraScanning(true);

    try {
      const codeReader = new BrowserQRCodeReader();
      if (!videoRef.current) return;

      const controls = await codeReader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        async (result, _error, ctrl) => {
          if (result) {
            // Stop camera immediately after first successful scan
            ctrl.stop();
            setIsCameraScanning(false);
            await resolveScannedQrText(result.getText());
          }
        }
      );
      scannerControlsRef.current = controls;
    } catch (err) {
      setIsCameraScanning(false);
      setScanError('Camera access denied or unavailable. You can also upload a QR image below.');
    }
  };

  // 6. Decode QR from an Uploaded Image File (Fallback for Desktop Testing)
  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError('');
    setScannedResult(null);

    try {
      const imageUrl = URL.createObjectURL(file);
      const codeReader = new BrowserQRCodeReader();
      const result = await codeReader.decodeFromImageUrl(imageUrl);
      URL.revokeObjectURL(imageUrl);
      await resolveScannedQrText(result.getText());
    } catch (err) {
      setScanError('Could not detect a valid QR code in the uploaded image.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white border border-neutral-200 rounded-2xl shadow-sm space-y-6">
      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => {
            scannerControlsRef.current?.stop();
            setIsCameraScanning(false);
            setActiveTab('GENERATOR');
          }}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${
            activeTab === 'GENERATOR'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500'
          }`}
        >
          1. Upload &amp; Generate QR Credential
        </button>
        <button
          onClick={() => setActiveTab('SCANNER')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${
            activeTab === 'SCANNER'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500'
          }`}
        >
          2. Verifier QR Scanner
        </button>
      </div>

      {/* TAB 1: OWNER QR GENERATOR */}
      {activeTab === 'GENERATOR' && (
        <div className="space-y-6">
          <form onSubmit={handleGenerateCredentialQr} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-500 mb-1">
                Holder Name
              </label>
              <input
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-500 mb-1">
                Verified Document Category
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as CredentialDocType)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
              >
                <option value="EDUCATION_CERTIFICATE">Education Certificate</option>
                <option value="MARKSHEET_10">Class 10 Marksheet</option>
                <option value="MARKSHEET_12">Class 12 Marksheet</option>
                <option value="AADHAAR_CARD">Aadhaar Card (Selective Disclosure)</option>
                <option value="PAN_CARD">PAN Card</option>
                <option value="DRIVING_LICENCE">Driving Licence</option>
                <option value="BIRTH_CERTIFICATE">Birth Certificate</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-neutral-900 text-white text-sm font-semibold rounded-lg hover:bg-neutral-800 disabled:opacity-50"
              >
                {loading ? 'Generating Cryptographic ID & QR...' : 'Generate Unique Verify ID & QR Code'}
              </button>
            </div>
          </form>

          {generatedData && (
            <VaultAntiCaptureShield
              credentialId={generatedData.credentialId}
              holderName={generatedData.publicClaims.holderName}
              onBreachDetected={(reason, count) => {
                console.warn(`[SECURITY SELF-CHECK] Breach #${count}: ${reason}`);
              }}
            >
              <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col sm:flex-row items-center gap-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={generatedData.qrDataUrl}
                  alt="VERIMASK Credential QR"
                  className="w-44 h-44 rounded-lg border border-neutral-700 bg-white p-2"
                />

                <div className="flex-1 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {generatedData.publicClaims.verificationStatus}
                    </span>
                    <span className="font-mono text-xs text-neutral-300">
                      ID: {generatedData.credentialId}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 break-all">
                    <span className="font-semibold text-neutral-200">Verify Gateway URL:</span>{' '}
                    {generatedData.verificationUrl}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <a
                      href={generatedData.qrDataUrl}
                      download={`${generatedData.credentialId}.png`}
                      className="px-3 py-1.5 bg-neutral-800 text-white text-xs font-semibold rounded-lg hover:bg-neutral-700 border border-neutral-700"
                    >
                      Download QR PNG
                    </a>
                    <button
                      type="button"
                      onClick={handleRegenerateQr}
                      className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg hover:bg-neutral-700"
                    >
                      Regenerate QR
                    </button>
                    <button
                      type="button"
                      onClick={handleRevokeCredential}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
                    >
                      Revoke Credential
                    </button>
                  </div>
                </div>
              </div>
            </VaultAntiCaptureShield>
          )}
        </div>
      )}

      {/* TAB 2: VERIFIER QR SCANNER */}
      {activeTab === 'SCANNER' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={startCameraScanner}
              className="px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-lg"
            >
              {isCameraScanning ? 'Scanning via Camera...' : 'Start Camera QR Scanner'}
            </button>

            <label className="px-4 py-2 bg-neutral-100 border border-neutral-300 text-neutral-800 text-sm font-semibold rounded-lg cursor-pointer hover:bg-neutral-200">
              Upload QR Image to Scan
              <input
                type="file"
                accept="image/*"
                onChange={handleQrImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Live Video Element for @zxing/browser */}
          <div className={`${isCameraScanning ? 'block' : 'hidden'} overflow-hidden rounded-xl border border-neutral-300 bg-black`}>
            <video ref={videoRef} className="w-full h-64 object-cover" />
          </div>

          {scanError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {scanError}
            </div>
          )}

          {/* Scanned Certificate Output (Exact Required JSON + UI Card) */}
          {scannedResult && (
            <div className="space-y-4">
              <div
                className={`p-4 rounded-xl border ${
                  scannedResult.valid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-red-50 border-red-200 text-red-950'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold">
                    {scannedResult.valid ? 'Verified Credential Certificate' : 'Invalid / Revoked Credential'}
                  </span>
                  <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-white/80">
                    {scannedResult.credentialId}
                  </span>
                </div>
                <p className="text-sm"><strong>Holder Name:</strong> {scannedResult.holderName}</p>
                <p className="text-sm"><strong>Document Type:</strong> {scannedResult.documentType}</p>
                <p className="text-sm"><strong>Status:</strong> {scannedResult.verificationStatus}</p>
                <p className="text-sm"><strong>Issuer:</strong> {scannedResult.issuer}</p>
                <p className="text-sm"><strong>Issued At:</strong> {scannedResult.issuedAt}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 mb-1">
                  Verifier Decoded Payload:
                </p>
                <pre className="p-4 bg-neutral-900 text-emerald-400 rounded-xl text-xs overflow-x-auto">
                  {JSON.stringify(scannedResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
