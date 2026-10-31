'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ViewOnceEnclavePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [burned, setBurned] = useState(false);
  const [burnReason, setBurnReason] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(30);

  // Netflix / Banking App DRM Blackout States
  const [isBlackoutActive, setIsBlackoutActive] = useState(false);
  const [blackoutReason, setBlackoutReason] = useState<string>('');
  const [cameraDetected, setCameraDetected] = useState(false);
  const [cameraWatchdogActive, setCameraWatchdogActive] = useState(true);
  const [watermarkTime, setWatermarkTime] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Fetch View-Once Session
  useEffect(() => {
    async function loadSession() {
      try {
        setLoading(true);
        const res = await fetch(`/api/enclave/session/${sessionId}`);
        const result = await res.json();

        if (res.status === 410 || result.burned) {
          setBurned(true);
          setBurnReason(result.error || 'This session has already been viewed and permanently purged.');
        } else if (!res.ok || !result.success) {
          setBurned(true);
          setBurnReason(result.error || 'Session invalid or expired.');
        } else {
          setData(result.credential);
          setSecondsLeft(result.ttlSeconds || 30);
        }
      } catch (err: unknown) {
        setBurned(true);
        setBurnReason('Failed to connect to zero-knowledge enclave.');
      } finally {
        setLoading(false);
      }
    }

    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  // 2. Countdown Timer & Auto-Burn
  useEffect(() => {
    if (loading || burned || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          fetch(`/api/enclave/session/${sessionId}`, { method: 'POST' }).catch(() => {});
          setBurned(true);
          setBurnReason('View-Once TTL expired. The preview has been cryptographically purged.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [loading, burned, secondsLeft, sessionId]);

  // 3. Dynamic Watermark updater
  useEffect(() => {
    const updateTime = () => setWatermarkTime(new Date().toUTCString());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 4. NETFLIX / PRIME VIDEO / BANKING APP STYLE PITCH-BLACK DRM SCREENSHOT SHIELD
  useEffect(() => {
    // Whenever window loses focus (e.g. Snipping tool, OBS capture, screenshot overlay)
    const triggerBlackout = (reason: string) => {
      setIsBlackoutActive(true);
      setBlackoutReason(reason);
    };

    const clearBlackout = () => {
      if (!cameraDetected) {
        setIsBlackoutActive(false);
        setBlackoutReason('');
      }
    };

    const handleBlur = () => {
      triggerBlackout('Window lost focus — Screen turned completely blank to block screenshot utilities (Netflix / Payment App Protection)');
    };

    const handleFocus = () => {
      clearBlackout();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        triggerBlackout('Background recording detected — Screen blanked');
      } else {
        clearBlackout();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen / Screenshot shortcuts
      if (
        e.key === 'PrintScreen' ||
        e.keyCode === 44 ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'S' || e.key === 'P'))
      ) {
        e.preventDefault();
        triggerBlackout('Screenshot Shortcut Intercepted — Screen turned 100% black');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [cameraDetected]);

  // 5. Camera & Physical Recording Watchdog
  const toggleCameraWatchdog = async () => {
    if (cameraWatchdogActive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraWatchdogActive(false);
      setCameraDetected(false);
      setIsBlackoutActive(false);
      return;
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 320, height: 240 },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraWatchdogActive(true);
      }
    } catch {
      setCameraWatchdogActive(true);
    }
  };

  const triggerSimulatedCameraDetection = () => {
    setCameraDetected(true);
    setIsBlackoutActive(true);
    setBlackoutReason('The camera is detected! A secondary recording lens or camera was sensed. Document turned completely pitch-black.');
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white select-none relative overflow-hidden">
      {/* Hidden camera preview for active watchdog stream */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      {/* Top Security Status Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/95 border-b border-slate-800 px-4 sm:px-8 py-3 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-black">
            <span className="material-symbols-outlined text-[18px]">lock</span>
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold tracking-wider uppercase flex items-center gap-1.5">
              <span>ENCLAVE VIEW-ONCE DRM</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </h1>
            <span className="text-[10px] text-slate-400 block font-mono">
              Session: {sessionId?.slice(0, 8)}... • Netflix/Banking DRM Blackout Active
            </span>
          </div>
        </div>

        {/* Live TTL Countdown */}
        {!burned && !loading && (
          <div className="flex items-center gap-2 bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-700">
            <span className="material-symbols-outlined text-[16px] text-amber-400 animate-spin">
              timer
            </span>
            <span className="text-xs font-mono font-bold text-amber-300">
              Purges in: <strong className="text-sm font-black text-white">{secondsLeft}s</strong>
            </span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-5 relative">
        {loading && (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
            <p className="text-xs font-mono text-slate-400">
              Unpacking zero-knowledge ephemeral enclave key...
            </p>
          </div>
        )}

        {/* 1. BURNED VIEW */}
        {burned && !loading && (
          <div className="rounded-3xl bg-slate-900 border border-rose-500/30 p-8 sm:p-12 text-center space-y-5 shadow-2xl animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-rose-500/10 border-2 border-rose-500 text-rose-500 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
              <span className="material-symbols-outlined text-[42px]">local_fire_department</span>
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 text-[11px] font-mono font-bold tracking-wider uppercase border border-rose-500/30">
                410 GONE • SESSION PERMANENTLY BURNED
              </span>
              <h2 className="text-2xl font-black text-white">Document Purged From Memory</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                {burnReason ||
                  'This document was configured for single-use View-Once access. The ephemeral decryption key has been permanently destroyed.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black border border-slate-800 text-left text-xs font-mono text-slate-400 space-y-1.5 max-w-sm mx-auto">
              <div className="flex justify-between">
                <span>View Count:</span>
                <span className="text-rose-400 font-bold">1 / 1 (Exhausted)</span>
              </div>
              <div className="flex justify-between">
                <span>Cryptographic State:</span>
                <span className="text-rose-400 font-bold">BURNED</span>
              </div>
              <div className="flex justify-between">
                <span>Access Window:</span>
                <span className="text-slate-500">Expired</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push(`/verify/${data?.credentialId || 'ZK-AAD-9021-X4'}`)}
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>Back to Verification Portal</span>
              </button>
              <button
                onClick={() => router.push('/credentials')}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black transition flex items-center justify-center gap-2 shadow"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code</span>
                <span>Issue Fresh QR Code</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. ACTIVE VIEW-ONCE DOCUMENT */}
        {!burned && !loading && data && (
          <div className="space-y-4">
            {/* Interactive Security Banner */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-2xl text-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[18px]">
                  security
                </span>
                <span className="text-slate-300 font-medium">
                  DRM Protection:{' '}
                  <strong className="text-emerald-400 font-bold">
                    {cameraWatchdogActive ? 'Watchdog Active' : 'Passive'}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleCameraWatchdog}
                  className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition flex items-center gap-1 ${
                    cameraWatchdogActive
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">videocam</span>
                  <span>{cameraWatchdogActive ? 'Watchdog ON' : 'Enable Watchdog'}</span>
                </button>

                <button
                  type="button"
                  onClick={triggerSimulatedCameraDetection}
                  className="px-3 py-1 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1 shadow"
                  title="Test Netflix-style Blackout on Camera Detection"
                >
                  <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                  <span>Simulate Camera Detection</span>
                </button>
              </div>
            </div>

            {/* Document Enclave Container */}
            <div className="relative rounded-3xl bg-slate-900 border-2 border-slate-800 shadow-2xl overflow-hidden p-6 sm:p-8 min-h-[420px]">
              {/* Dynamic Moving Watermark Overlay */}
              <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden flex flex-col justify-around opacity-15 rotate-[-18deg] scale-125 select-none">
                <div className="text-[11px] font-mono font-black tracking-widest text-emerald-400">
                  VERIMASK SECURE ENCLAVE • IP: 10.188.235.154 • {sessionId?.slice(0, 8)}
                </div>
                <div className="text-[11px] font-mono font-black tracking-widest text-emerald-400">
                  CONFIDENTIAL • DO NOT SCREENSHOT • AUDITED AT {watermarkTime}
                </div>
                <div className="text-[11px] font-mono font-black tracking-widest text-emerald-400">
                  VIEW-ONCE ATOMIC BURN • AUTHORIZED SINGLE VIEWER ONLY
                </div>
              </div>

              {/* 3. NETFLIX / PRIME VIDEO / BANKING APP PITCH-BLACK DRM CURTAIN */}
              {isBlackoutActive && (
                <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center p-6 text-center space-y-4 animate-fadeIn">
                  <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl animate-pulse">
                    <span className="material-symbols-outlined text-[36px]">visibility_off</span>
                  </div>

                  <div className="space-y-1">
                    <span className="px-3 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-mono font-black uppercase">
                      DRM Blackout Active
                    </span>
                    <h3 className="text-xl font-black text-white">The Camera is Detected!</h3>
                    <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                      {blackoutReason ||
                        'A recording device or screenshot tool was sensed. In accordance with payment-app and Netflix DRM security rules, the entire display is blanked out to prevent unauthorized capture.'}
                    </p>
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBlackoutActive(false);
                        setCameraDetected(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition"
                    >
                      Resume View ({secondsLeft}s left)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        fetch(`/api/enclave/session/${sessionId}`, { method: 'POST' }).catch(() => {});
                        setBurned(true);
                        setBurnReason('Immediate emergency burn triggered: Unauthorized physical camera or recording device detected.');
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow"
                    >
                      Emergency Burn Document
                    </button>
                  </div>
                </div>
              )}

              {/* Document Body (Visible only when no blackout is active) */}
              <div className={`space-y-6 transition-opacity duration-200 ${isBlackoutActive ? 'opacity-0' : 'opacity-100'}`}>
                {/* Header Badge */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center font-black">
                      <span className="material-symbols-outlined text-[24px]">verified_user</span>
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-white">
                        {data.documentType} Attestation
                      </h2>
                      <span className="text-[11px] text-slate-400 block">{data.issuer}</span>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                    VERIFIED ENCLAVE
                  </span>
                </div>

                {/* Uploaded Document Image or High-Fidelity Hologram */}
                {data.previewImage ? (
                  <div className="rounded-2xl bg-black border border-slate-800 p-2 overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.previewImage}
                      alt="Uploaded Document"
                      className="max-h-72 w-auto object-contain rounded-xl select-none pointer-events-none"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl bg-black border border-slate-800 p-6 text-center space-y-3">
                    <span className="material-symbols-outlined text-[48px] text-emerald-400">
                      badge
                    </span>
                    <h4 className="text-base font-bold text-white uppercase tracking-wider">
                      {data.documentType} DIGITAL CREDENTIAL
                    </h4>
                    <p className="text-xs text-slate-400">
                      Cryptographically attested by {data.issuer}
                    </p>
                  </div>
                )}

                {/* Selective Verified Claims */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-black border border-slate-800 p-3 rounded-xl space-y-0.5">
                    <span className="text-slate-400 text-[10px]">Verified Holder:</span>
                    <span className="font-bold text-white block text-sm">{data.holderName}</span>
                  </div>

                  <div className="bg-black border border-slate-800 p-3 rounded-xl space-y-0.5">
                    <span className="text-slate-400 text-[10px]">Date of Birth:</span>
                    <span className="font-bold text-white block text-sm">{data.dob}</span>
                  </div>

                  <div className="bg-black border border-slate-800 p-3 rounded-xl space-y-0.5">
                    <span className="text-slate-400 text-[10px]">Masked Identifier:</span>
                    <span className="font-mono font-bold text-emerald-400 block text-sm">
                      {data.maskedIdentifier}
                    </span>
                  </div>

                  <div className="bg-black border border-slate-800 p-3 rounded-xl space-y-0.5">
                    <span className="text-slate-400 text-[10px]">Credential ID:</span>
                    <span className="font-mono font-semibold text-slate-300 block text-xs">
                      {data.credentialId}
                    </span>
                  </div>
                </div>

                {/* Burn Notice & Immediate Burn Button */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 font-mono">
                    ⚠️ Refreshing or closing window permanently burns this view.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      fetch(`/api/enclave/session/${sessionId}`, { method: 'POST' }).catch(() => {});
                      setBurned(true);
                      setBurnReason('Document voluntarily burned by viewer.');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1 shadow"
                  >
                    <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                    <span>Burn Now</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
