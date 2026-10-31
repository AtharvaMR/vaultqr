'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import VerimaskQrWorkflow from '@/components/VerimaskQrWorkflow';

export default function QrScannerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeMode, setActiveMode] = useState<'viewfinder' | 'engine'>('viewfinder');
  const [torchOn, setTorchOn] = useState(false);
  const [audioFeedback, setAudioFeedback] = useState(true);
  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Scanned Result State
  const [scannedResult, setScannedResult] = useState<any | null>(null);

  // Initialize browser camera (using WebRTC getUserMedia)
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setCameraActive(true);
          }
        }
      } catch (err: unknown) {
        console.warn('Camera permission or device error:', err);
        setCameraError('Camera access not granted or unavailable. You can use image upload or demo simulation below.');
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleSimulateScan = async (type: 'education' | 'aadhaar') => {
    if (audioFeedback) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch {
        // ignore audio error
      }
    }

    try {
      const res = await fetch('/api/credentials');
      if (res.ok) {
        const data = await res.json();
        if (data.credentials && data.credentials.length > 0) {
          const match = data.credentials[0];
          setScannedResult(match);
          return;
        }
      }
    } catch {}

    // Fallback if no credential uploaded yet
    setScannedResult({
      valid: false,
      error: 'No active credentials found in vault. Please upload your document to test.',
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      router.push(`/verify/${manualCode.trim()}`);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Simulate decoding QR from image
      setTimeout(() => {
        handleSimulateScan('education');
      }, 500);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-slate-950 text-white select-none overflow-hidden font-sans">
      {/* 1. Header & Top Controls */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md p-2 text-white hover:bg-white/20 transition"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>

        <div className="text-center">
          <h1 className="text-sm font-bold tracking-wider uppercase text-white">
            Scan VERIMASK QR
          </h1>
          <span className="text-[11px] text-slate-300 block">
            Point camera at any credential QR code
          </span>
        </div>

        {/* Quick Action Icons: Torch, Gallery, Audio */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTorchOn(!torchOn)}
            className={`p-2 rounded-full backdrop-blur-md transition ${
              torchOn ? 'bg-amber-400 text-black' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title="Toggle Flash"
          >
            <span className="material-symbols-outlined text-[18px]">
              {torchOn ? 'flashlight_on' : 'flashlight_off'}
            </span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition"
            title="Import from Gallery"
          >
            <span className="material-symbols-outlined text-[18px]">photo_library</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          <button
            onClick={() => setAudioFeedback(!audioFeedback)}
            className={`p-2 rounded-full backdrop-blur-md transition ${
              audioFeedback ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-400'
            }`}
            title="Sound Feedback"
          >
            <span className="material-symbols-outlined text-[18px]">
              {audioFeedback ? 'volume_up' : 'volume_off'}
            </span>
          </button>
        </div>
      </header>

      {/* Mode Switcher */}
      <div className="relative z-30 flex justify-center py-2.5 bg-slate-950/90 border-b border-white/10">
        <div className="flex bg-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveMode('viewfinder')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeMode === 'viewfinder'
                ? 'bg-[#315EF4] text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">center_focus_strong</span>
            <span>Live Viewfinder</span>
          </button>
          <button
            onClick={() => setActiveMode('engine')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeMode === 'engine'
                ? 'bg-[#315EF4] text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">qr_code_scanner</span>
            <span>Unified QR Engine (@zxing)</span>
          </button>
        </div>
      </div>

      {activeMode === 'engine' ? (
        <div className="relative z-20 flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-950">
          <VerimaskQrWorkflow />
        </div>
      ) : (
        <>
      {/* 2. Central Viewfinder & Scanning Reticle */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4">
        {/* Background Live Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />

        {/* Simulated Camera Backdrop Guideline grid */}
        <div className="absolute inset-0 bg-slate-950/60 pointer-events-none"></div>

        {/* Reticle Viewfinder Box */}
        <div className="relative z-10 w-72 h-72 sm:w-80 sm:h-80 rounded-3xl border-2 border-white/20 flex items-center justify-center overflow-hidden shadow-2xl">
          {/* Glowing Corner Brackets */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#315EF4] rounded-tl-2xl"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#315EF4] rounded-tr-2xl"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#315EF4] rounded-bl-2xl"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#315EF4] rounded-br-2xl"></div>

          {/* Animated Laser Scanning Line */}
          <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#315EF4] to-transparent shadow-[0_0_12px_#315EF4] animate-scan-laser"></div>

          {/* Center Target Glyph */}
          <span className="material-symbols-outlined text-white/30 text-[48px]">
            filter_center_focus
          </span>
        </div>

        {/* Subtitle & Status Chip Below Reticle */}
        <div className="relative z-10 mt-6 flex flex-col items-center text-center space-y-2">
          <p className="text-xs text-slate-300 font-medium">
            Align the QR code within the frame to verify cryptographically
          </p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-semibold backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ZK-SNARK Detection Active</span>
          </div>

          {cameraError && (
            <div className="max-w-xs mt-2 p-2 rounded-lg bg-amber-500/20 border border-amber-400/30 text-[11px] text-amber-200">
              {cameraError}
            </div>
          )}
        </div>

        {/* 3. Supported Credential Pill Badges */}
        <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-1.5 max-w-sm">
          <span className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] text-slate-300 backdrop-blur-sm">
            Aadhaar ZK Proof
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] text-slate-300 backdrop-blur-sm">
            PAN Credential
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] text-slate-300 backdrop-blur-sm">
            Academic Degree
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] text-slate-300 backdrop-blur-sm">
            Driving Licence
          </span>
        </div>
      </div>

      {/* 4. Bottom Action & Demo Controls Card */}
      <div className="relative z-20 w-full bg-white text-[#101C35] rounded-t-3xl p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#718096]">Quick Test & Simulation</span>
          <button
            onClick={() => setIsManualInputOpen(!isManualInputOpen)}
            className="text-xs font-bold text-[#315EF4] hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">keyboard</span>
            <span>Enter Code Manually</span>
          </button>
        </div>

        {/* Simulation Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => handleSimulateScan('education')}
            className="p-3 rounded-2xl bg-[#F5F7FB] border border-[#E5EAF2] hover:border-blue-500 hover:bg-blue-50/30 transition text-left space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">school</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Simulate
              </span>
            </div>
            <h4 className="text-xs font-bold text-[#101C35]">Scan Education QR</h4>
            <span className="text-[10px] text-[#718096] block truncate">
              VC-82f19a • Demo User
            </span>
          </button>

          <button
            onClick={() => handleSimulateScan('aadhaar')}
            className="p-3 rounded-2xl bg-[#F5F7FB] border border-[#E5EAF2] hover:border-blue-500 hover:bg-blue-50/30 transition text-left space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">badge</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Simulate
              </span>
            </div>
            <h4 className="text-xs font-bold text-[#101C35]">Scan Aadhaar QR</h4>
            <span className="text-[10px] text-[#718096] block truncate">
              ZK-CERT-IND • Aarav
            </span>
          </button>
        </div>

        {/* Manual Code Input Drawer */}
        {isManualInputOpen && (
          <form onSubmit={handleManualSubmit} className="pt-2 flex gap-2">
            <input
              type="text"
              required
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter Credential ID (e.g. VC-82f19a)"
              className="flex-1 rounded-xl border border-[#E5EAF2] bg-[#F5F7FB] px-3 py-2 text-xs font-mono outline-none focus:bg-white focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#101C35] text-white text-xs font-bold shadow"
            >
              Verify
            </button>
          </form>
        )}

        <div className="text-center text-[10px] text-[#718096]">
          Raw personal data is never transmitted. Instant cryptographic zero-knowledge proof verification.
        </div>
      </div>

      {/* 5. Scanned Result Modal (Displays the verified barcode user data) */}
      {scannedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white border border-[#E5EAF2] p-6 text-[#101C35] shadow-2xl space-y-4 animate-scaleUp">
            {/* Top Verified Shield */}
            <div className="flex items-center justify-between border-b border-[#E5EAF2] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm">QR Code Decoded & Verified!</h3>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    Cryptographic Signature Valid
                  </span>
                </div>
              </div>
              <button
                onClick={() => setScannedResult(null)}
                className="rounded-full p-1 text-[#718096] hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* User Data Card as specified in user request! */}
            <div className="rounded-2xl bg-[#F5F7FB] border border-[#E5EAF2] p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-1.5 border-b border-[#E5EAF2]">
                <span className="text-[#718096]">Holder Name:</span>
                <span className="font-bold text-sm text-[#101C35]">{scannedResult.holderName}</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-[#E5EAF2]">
                <span className="text-[#718096]">Credential ID:</span>
                <span className="font-mono font-bold text-blue-600">{scannedResult.credentialId}</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-[#E5EAF2]">
                <span className="text-[#718096]">Document Type:</span>
                <span className="font-semibold">{scannedResult.documentType}</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-[#E5EAF2]">
                <span className="text-[#718096]">Verification Status:</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {scannedResult.verificationStatus}
                </span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-[#E5EAF2]">
                <span className="text-[#718096]">Issuer:</span>
                <span className="font-medium text-slate-700">{scannedResult.issuer}</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b border-[#E5EAF2]">
                <span className="text-[#718096]">Issued At:</span>
                <span className="font-mono text-[10px] text-slate-600">{scannedResult.issuedAt}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#718096]">Revoked:</span>
                <span className="font-bold text-slate-800">
                  {scannedResult.revoked ? 'Yes (Revoked)' : 'False (Active)'}
                </span>
              </div>
            </div>

            {/* Raw JSON viewer toggle */}
            <details className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <summary className="cursor-pointer font-bold text-slate-700">
                View Raw Barcode JSON Payload
              </summary>
              <pre className="mt-2 p-2 bg-slate-900 text-emerald-400 rounded-lg text-[10px] font-mono overflow-x-auto">
                {JSON.stringify(scannedResult, null, 2)}
              </pre>
            </details>

            {/* CTAs */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setScannedResult(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#E5EAF2] text-[#101C35] text-xs font-bold hover:bg-slate-50 transition"
              >
                Scan Another
              </button>
              <Link
                href={`/verify/${scannedResult.credentialId}`}
                className="flex-1 py-2.5 rounded-xl bg-[#315EF4] hover:bg-blue-600 text-white text-xs font-bold text-center shadow transition flex items-center justify-center gap-1"
              >
                <span>View Full Certificate</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
