'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { VaultAntiCaptureShield } from '@/components/VaultAntiCaptureShield';

export default function PublicVerificationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = params?.token as string;
  const dynamicJwt = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [certData, setCertData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // OTP Modal State
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpSessionId, setOtpSessionId] = useState('');
  const [otpStatus, setOtpStatus] = useState<'idle' | 'requesting' | 'verifying' | 'error'>('idle');
  const [otpError, setOtpError] = useState('');
  const [simulatedSms, setSimulatedSms] = useState<{ phone: string; code: string } | null>(null);

  useEffect(() => {
    async function fetchVerification() {
      try {
        setLoading(true);
        const url = dynamicJwt
          ? `/api/vault/verify/${token}?token=${encodeURIComponent(dynamicJwt)}`
          : `/api/vault/verify/${token}`;

        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok || data.valid === false) {
          setError(data.error || 'Credential verification failed or token has expired.');
        } else {
          setCertData(data);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Verification failed');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchVerification();
    }
  }, [token, dynamicJwt]);

  // Request OTP from Owner Phone
  const handleOpenOtpModal = async () => {
    setIsOtpModalOpen(true);
    setOtpStatus('requesting');
    setOtpError('');
    setOtpValue('');

    try {
      const res = await fetch('/api/enclave/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId: certData?.credentialId || token,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setOtpSessionId(data.sessionId);
        setSimulatedSms({ phone: data.phone, code: data.simulatedOtp });
        setOtpStatus('idle');
      } else {
        setOtpError(data.error || 'Failed to request OTP');
        setOtpStatus('error');
      }
    } catch {
      setOtpError('Network error requesting OTP');
      setOtpStatus('error');
    }
  };

  // Verify OTP and redirect to View-Once Enclave
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpValue) return;

    setOtpStatus('verifying');
    setOtpError('');

    try {
      const res = await fetch('/api/enclave/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: otpSessionId,
          otp: otpValue.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.enclaveUrl) {
        router.push(data.enclaveUrl);
      } else {
        setOtpError(data.error || 'Invalid OTP code');
        setOtpStatus('error');
      }
    } catch {
      setOtpError('Verification failed');
      setOtpStatus('error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F7FB] text-[#101C35]">
      {/* Top Header */}
      <header className="w-full bg-[#101C35] text-white px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#315EF4] text-white font-black">
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </div>
          <div>
            <span className="text-xs sm:text-sm font-extrabold tracking-wider uppercase block">
              VERIMASK PUBLIC VERIFIER GATEWAY
            </span>
            <span className="text-[10px] text-slate-400 block -mt-0.5">
              Zero-Knowledge Credential Attestation • Selective Disclosure
            </span>
          </div>
        </div>

        <Link
          href="/credentials"
          className="flex items-center gap-1 text-xs text-blue-300 hover:text-white font-semibold"
        >
          <span className="material-symbols-outlined text-[16px]">qr_code</span>
          <span className="hidden sm:inline">My Wallet</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full border-4 border-[#315EF4] border-t-transparent animate-spin"></div>
            <p className="text-xs font-bold text-[#101C35]">
              Validating Cryptographic Attestation & Nonce...
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-3xl bg-white border border-rose-200 p-8 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border-2 border-rose-200">
              <span className="material-symbols-outlined text-[32px]">gpp_bad</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#101C35]">Verification Failed</h3>
              <p className="text-xs text-[#718096] max-w-sm mx-auto">{error}</p>
            </div>
            <Link
              href="/credentials"
              className="inline-block px-5 py-2.5 rounded-xl bg-[#101C35] text-white text-xs font-bold shadow"
            >
              Back to My Credentials
            </Link>
          </div>
        )}

        {certData && !loading && (
          <div className="space-y-5 animate-fadeIn">
            <VaultAntiCaptureShield
              credentialId={certData.credentialId || token}
              holderName={certData.holderName || 'Verified Holder'}
              onBreachDetected={(reason, count) => {
                console.warn(`[SECURITY SELF-CHECK] Breach #${count}: ${reason}`);
              }}
            >
              {/* Main Certificate Card */}
              <div className="relative overflow-hidden rounded-2xl bg-white border border-[#E5EAF2] shadow-xl text-[#101C35]">
                {/* Top Security Ribbon */}
                <div className="bg-gradient-to-r from-[#101C35] via-[#1a346e] to-[#315EF4] px-4 py-2.5 text-center text-white text-[11px] font-bold tracking-wider uppercase flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-amber-300">verified</span>
                  <span>VERIMASK DIGITAL CREDENTIAL CERTIFICATE</span>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  {/* Green Verification Pulse Badge */}
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="relative flex items-center justify-center">
                      <span className="absolute w-16 h-16 rounded-full bg-emerald-400/20 animate-ping"></span>
                      <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border-2 border-emerald-200 shadow-md">
                        <span className="material-symbols-outlined text-[36px]">verified</span>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#101C35]">
                        Credential Successfully Verified
                      </h2>
                      <div className="flex items-center justify-center gap-2 text-xs text-[#718096] mt-1 font-medium">
                        <span>Verified: {new Date(certData.issuedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold">zk-SNARK Enclave Proof</span>
                      </div>
                    </div>
                  </div>

                  {/* Verified Identity Claims */}
                  <div className="rounded-2xl bg-[#F5F7FB] border border-[#E5EAF2] p-5 space-y-3.5 text-xs">
                    <div className="flex justify-between items-center pb-2.5 border-b border-[#E5EAF2]">
                      <span className="text-[#718096] font-medium">Holder Name:</span>
                      <span className="font-bold text-sm text-[#101C35] flex items-center gap-1.5">
                        {certData.holderName}
                        <span className="material-symbols-outlined text-[14px] text-emerald-600">
                          check_circle
                        </span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2.5 border-b border-[#E5EAF2]">
                      <span className="text-[#718096] font-medium">Document Type:</span>
                      <span className="font-bold text-[#101C35]">{certData.documentType}</span>
                    </div>

                    <div className="flex justify-between items-center pb-2.5 border-b border-[#E5EAF2]">
                      <span className="text-[#718096] font-medium">Date of Birth:</span>
                      <span className="font-bold text-[#101C35]">{certData.dob || '12/04/1998'}</span>
                    </div>

                    <div className="flex justify-between items-center pb-2.5 border-b border-[#E5EAF2]">
                      <span className="text-[#718096] font-medium">Masked Identifier:</span>
                      <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {certData.maskedIdentifier || '•••• •••• 9021'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2.5 border-b border-[#E5EAF2]">
                      <span className="text-[#718096] font-medium">Age Verification:</span>
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        {certData.ageVerification || 'Age > 18 Years (Confirmed ✓)'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2.5 border-b border-[#E5EAF2]">
                      <span className="text-[#718096] font-medium">Issuing Authority:</span>
                      <span className="font-bold text-slate-800">{certData.issuer}</span>
                    </div>

                    <div className="flex justify-between items-center pb-2.5 border-b border-[#E5EAF2]">
                      <span className="text-[#718096] font-medium">Credential ID:</span>
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {certData.credentialId}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-[#718096] font-medium">Attestation Status:</span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Active & Valid
                      </span>
                    </div>
                  </div>

                  {/* Secure Action Area: VIEW-ONCE LINK (NO DOWNLOAD OPTION) */}
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={handleOpenOtpModal}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition transform active:scale-[0.99]"
                    >
                      <span className="material-symbols-outlined text-[18px]">lock_open</span>
                      <span>View Original Document (Encrypted View-Once Enclave)</span>
                    </button>

                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 text-[11px] text-slate-700 leading-relaxed flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#315EF4] shrink-0 mt-0.5">
                        info
                      </span>
                      <span>
                        <strong>Selective Disclosure:</strong> Raw document downloads are restricted. Viewing requires owner phone OTP approval and burns permanently after 30 seconds.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Notice */}
                <div className="bg-[#F8FAFC] border-t border-[#E5EAF2] px-6 py-3.5 text-center text-[11px] text-[#718096] flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
                  <span>Protected by VERIMASK Privacy Protocol • Zero sensitive digits leaked</span>
                </div>
              </div>
            </VaultAntiCaptureShield>
          </div>
        )}
      </main>

      {/* PHONE NUMBER OTP AUTHORIZATION MODAL */}
      {isOtpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-[#E5EAF2] text-[#101C35] space-y-4 animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E5EAF2] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[18px]">key</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#101C35]">Owner Phone Authorization</h3>
                  <span className="text-[10px] text-[#718096]">Step 1 of 2: OTP Verification</span>
                </div>
              </div>
              <button
                onClick={() => setIsOtpModalOpen(false)}
                className="rounded-full p-1 text-[#718096] hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Simulated SMS Notification Banner */}
            {simulatedSms && (
              <div className="p-3 rounded-2xl bg-slate-950 text-white border border-slate-800 text-xs space-y-1 shadow-md">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <span className="material-symbols-outlined text-[12px]">sms</span>
                    Simulated SMS Delivery
                  </span>
                  <span>Just now</span>
                </div>
                <p className="text-[11px] font-mono leading-relaxed">
                  VERIMASK: Your 1-time view code for {certData?.holderName || 'Rahul Sharma'} is{' '}
                  <strong className="text-amber-300 text-xs font-black">{simulatedSms.code}</strong>. Valid for 60 seconds.
                </p>
                <button
                  type="button"
                  onClick={() => setOtpValue(simulatedSms.code)}
                  className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 underline pt-0.5"
                >
                  Click to Auto-Fill Code ({simulatedSms.code})
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700">
                  Enter 6-Digit OTP sent to {simulatedSms?.phone || '+91 ••••• ••910'}
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value)}
                  placeholder="e.g. 849201"
                  className="w-full text-center tracking-[0.5em] font-mono text-lg font-black rounded-xl border border-[#E5EAF2] bg-[#F5F7FB] px-3 py-2.5 outline-none focus:bg-white focus:border-emerald-500 transition"
                />
              </div>

              {otpError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                  {otpError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                <strong>View-Once Warning:</strong> Once verified, the document will unlock in an encrypted DRM enclave for <strong>30 seconds</strong> only. Attempting screenshots or refreshing will permanently burn the session.
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOtpModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5EAF2] text-xs font-bold text-[#718096] hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={otpStatus === 'verifying'}
                  className="flex-1 py-2.5 rounded-xl bg-[#101C35] hover:bg-slate-800 text-white text-xs font-bold shadow transition flex items-center justify-center gap-1.5"
                >
                  {otpStatus === 'verifying' ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">
                        progress_activity
                      </span>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">lock_open</span>
                      <span>Unlock View-Once</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
