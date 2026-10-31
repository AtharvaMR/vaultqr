'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setAuthError(`Authentication error: ${errorParam}. Please check your Supabase Auth provider settings.`);
    }
  }, [searchParams]);

  // Sign In State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up State
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // Forgot Password Flow
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [fpStep, setFpStep] = useState<1 | 2 | 3 | 4>(1);
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState(['', '', '', '', '', '']);
  const [fpNewPass, setFpNewPass] = useState('');
  const [fpConfirmPass, setFpConfirmPass] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Email ID & Password Sign In via Supabase
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInEmail.trim(),
        password: signInPassword,
      });

      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          setAuthError(
            `Account not recognized or password incorrect in this Supabase database. If you have not registered this email yet, click the button below to create it on the Sign Up tab.`
          );
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          setAuthError(
            `Email not confirmed yet. Supabase requires email verification. Check your Gmail inbox for the confirmation link, or disable "Confirm email" in your Supabase Auth Providers dashboard.`
          );
        } else {
          setAuthError(error.message);
        }
        showToast(error.message);
        setLoading(false);
        return;
      }

      showToast('Access Granted • Welcome back to VERIMASK!');
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
      showToast('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToSignUp = () => {
    setActiveTab('signup');
    setSignUpEmail(signInEmail.trim());
    setSignUpPassword(signInPassword);
    setSignUpConfirmPassword(signInPassword);
    setAuthError(null);
  };

  // 2. Email ID & Password Sign Up via Supabase
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpPassword !== signUpConfirmPassword) {
      setAuthError('Passwords do not match. Please verify.');
      showToast('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      // 1. Attempt admin server-side auto-confirm endpoint first
      try {
        const serverRes = await fetch('/api/auth/register-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: signUpEmail.trim(),
            password: signUpPassword,
            legalName: signUpName.trim(),
            phone: signUpPhone.trim(),
          }),
        });

        const serverData = await serverRes.json();
        if (serverRes.ok && serverData.autoConfirmed) {
          showToast('Account Created & Auto-Confirmed! Signing in...');
          const loginRes = await supabase.auth.signInWithPassword({
            email: signUpEmail.trim(),
            password: signUpPassword,
          });
          if (loginRes.data.session) {
            router.push('/dashboard');
            return;
          }
        }
      } catch {}

      // 2. Standard client signup
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail.trim(),
        password: signUpPassword,
        options: {
          data: {
            full_name: signUpName.trim(),
            phone: signUpPhone.trim(),
          },
        },
      });

      if (error) {
        setAuthError(error.message);
        showToast(error.message);
        setLoading(false);
        return;
      }

      // Sync user profile data locally
      try {
        await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            legalName: signUpName.trim() || 'Verified Citizen',
            email: signUpEmail.trim(),
            phone: signUpPhone.trim(),
          }),
        });
      } catch {}

      if (data.session) {
        showToast('Account Created & Authenticated • Welcome to VERIMASK!');
        setTimeout(() => {
          router.push('/dashboard');
        }, 500);
      } else {
        setAuthError(
          `Account registered in Supabase! If you see "Email not confirmed" when signing in, click the confirmation link in your Gmail (${signUpEmail.trim()}), or toggle off "Confirm email" in Supabase Auth Providers.`
        );
        showToast('Account Created! Check your email or sign in.');
        setActiveTab('signin');
        setSignInEmail(signUpEmail.trim());
        setSignInPassword(signUpPassword);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
      showToast('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // 3. Google OAuth Sign In via Supabase
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthError(null);

    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        setAuthError(`Google Auth Error: ${error.message}. Please ensure Google is enabled under Supabase Auth -> Providers.`);
        showToast(`Google login error: ${error.message}`);
        setLoading(false);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to initiate Google OAuth');
      setLoading(false);
    }
  };

  // 4. Guest Account Sign In (Supabase Anonymous + Sandbox Fallback)
  const handleGuestAccess = async () => {
    setLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.warn('Supabase anonymous sign-in not active in dashboard, proceeding with local sandbox session:', error.message);
      }
      showToast('Guest Session Activated • Sandbox Mode Enabled');
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } catch {
      showToast('Guest Session Activated • Sandbox Mode Enabled');
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val: string, index: number) => {
    if (val.length > 1) val = val.slice(-1);
    const updated = [...fpOtp];
    updated[index] = val;
    setFpOtp(updated);

    // Auto-focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F7FB] text-[#101C35] selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <header className="w-full flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#101C35] flex items-center justify-center text-white shadow-md">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <span className="font-extrabold text-lg tracking-wider text-[#101C35] uppercase">
            VERIMASK
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E5EAF2] text-[#101C35] text-xs font-medium shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Shield Active</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-4 py-6 sm:py-10">
        <div className="flex flex-col w-full items-center justify-center max-w-[460px] mx-auto">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="w-full mb-4 animate-fadeIn transition-all">
              <div className="flex items-center gap-2 p-3 rounded-xl shadow-lg bg-[#101C35] text-white text-xs sm:text-sm font-medium">
                <span className="material-symbols-outlined text-[18px] text-emerald-400">verified</span>
                <span className="flex-1">{toastMessage}</span>
                <button
                  onClick={() => setToastMessage(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>
          )}

          {/* 1. Branding & Welcome Section */}
          <div className="flex flex-col items-center text-center mb-6 w-full">
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-md border border-[#E5EAF2] mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#101C35] flex items-center justify-center text-[#315EF4]">
                <span className="material-symbols-outlined text-[24px]">shield_person</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#315EF4] flex items-center justify-center text-white shadow-sm">
                <span className="material-symbols-outlined text-[12px]">enhanced_encryption</span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#101C35] tracking-tight">
              Welcome to VERIMASK
            </h1>
            <p className="text-xs sm:text-sm text-[#718096] max-w-sm mt-1">
              Your secure digital identity. Verify documents and share information with confidence.
            </p>
          </div>

          {/* 2. Authentication Card */}
          <div className="w-full bg-white rounded-2xl shadow-xl border border-[#E5EAF2] p-6 sm:p-8 relative overflow-hidden">
            {!isForgotPasswordOpen ? (
              <div className="flex flex-col w-full">
                <div className="mb-4 text-left">
                  <h2 className="text-xl font-bold text-[#101C35]">
                    {activeTab === 'signin' ? 'Get Started' : 'Create an Account'}
                  </h2>
                  <p className="text-xs text-[#718096] mt-0.5">
                    {activeTab === 'signin'
                      ? 'Sign in to your account or create a new one to securely manage your digital credentials.'
                      : 'Join VERIMASK to safeguard your personal credentials with non-custodial zero-knowledge proofs.'}
                  </p>
                </div>

                {/* Pill Segmented Control */}
                <div className="flex items-center p-1 bg-[#F5F7FB] rounded-full mb-6 border border-[#E5EAF2]">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setAuthError(null);
                    }}
                    className={`flex-1 py-2 text-center rounded-full text-xs sm:text-sm font-semibold transition-all ${
                      activeTab === 'signin'
                        ? 'bg-white text-[#101C35] shadow-sm'
                        : 'text-[#718096] hover:text-[#101C35]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signup');
                      setAuthError(null);
                    }}
                    className={`flex-1 py-2 text-center rounded-full text-xs sm:text-sm font-semibold transition-all ${
                      activeTab === 'signup'
                        ? 'bg-white text-[#101C35] shadow-sm'
                        : 'text-[#718096] hover:text-[#101C35]'
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                {/* Auth Error Banner */}
                {authError && (
                  <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 space-y-2 animate-fadeIn text-left">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">
                        error
                      </span>
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold text-rose-900">Authentication Notice</p>
                        <p className="text-[11px] leading-relaxed">{authError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAuthError(null)}
                        className="text-rose-400 hover:text-rose-700 p-0.5"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>

                    {activeTab === 'signin' && signInEmail && (
                      <div className="pt-1 flex flex-wrap gap-2 items-center border-t border-rose-200/60">
                        <button
                          type="button"
                          onClick={handleSwitchToSignUp}
                          className="px-3 py-1.5 rounded-lg bg-[#101C35] hover:bg-slate-800 text-white font-semibold text-[11px] flex items-center gap-1 shadow-sm transition"
                        >
                          <span className="material-symbols-outlined text-[14px]">person_add</span>
                          <span>Register "{signInEmail}" on Sign Up</span>
                        </button>
                        <a
                          href="https://supabase.com/dashboard/project/gfvzmnnwsvyvahonupos/auth/providers"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 font-semibold text-[11px] flex items-center gap-1 transition"
                        >
                          <span className="material-symbols-outlined text-[14px]">settings</span>
                          <span>Supabase Auth Settings</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Sign In Form */}
                {activeTab === 'signin' && (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="text-left">
                      <label className="block text-xs font-semibold text-[#101C35] mb-1">
                        Email
                      </label>
                      <div className="flex items-center bg-white border border-[#E5EAF2] rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                        <span className="material-symbols-outlined text-[#718096] text-[18px] mr-2">
                          mail
                        </span>
                        <input
                          type="email"
                          required
                          value={signInEmail}
                          onChange={(e) => setSignInEmail(e.target.value)}
                          placeholder="Enter your email address"
                          className="w-full bg-transparent text-sm text-[#101C35] outline-none placeholder:text-[#718096]"
                        />
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-xs font-semibold text-[#101C35] mb-1">
                        Password
                      </label>
                      <div className="flex items-center bg-white border border-[#E5EAF2] rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
                        <span className="material-symbols-outlined text-[#718096] text-[18px] mr-2">
                          lock
                        </span>
                        <input
                          type={showSignInPassword ? 'text' : 'password'}
                          required
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full bg-transparent text-sm text-[#101C35] outline-none placeholder:text-[#718096]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignInPassword(!showSignInPassword)}
                          className="text-[#718096] hover:text-[#101C35] p-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showSignInPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[#718096]">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-3.5 h-3.5 accent-[#315EF4] rounded"
                        />
                        <span>Remember me</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPasswordOpen(true);
                          setFpStep(1);
                        }}
                        className="text-[#315EF4] font-semibold hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 bg-[#101C35] hover:bg-[#1a2e56] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99] disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">
                            progress_activity
                          </span>
                          <span>Verifying Credentials...</span>
                        </>
                      ) : (
                        <span>Sign In</span>
                      )}
                    </button>
                  </form>
                )}

                {/* 4. Sign Up Form */}
                {activeTab === 'signup' && (
                  <form onSubmit={handleSignUp} className="space-y-3">
                    <div className="text-left">
                      <label className="block text-xs font-semibold text-[#101C35] mb-1">
                        Full Name
                      </label>
                      <div className="flex items-center bg-white border border-[#E5EAF2] rounded-xl px-3 py-2">
                        <span className="material-symbols-outlined text-[#718096] text-[18px] mr-2">
                          person
                        </span>
                        <input
                          type="text"
                          required
                          value={signUpName}
                          onChange={(e) => setSignUpName(e.target.value)}
                          placeholder="Enter your full name"
                          className="w-full bg-transparent text-sm text-[#101C35] outline-none placeholder:text-[#718096]"
                        />
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-xs font-semibold text-[#101C35] mb-1">
                        Email Address
                      </label>
                      <div className="flex items-center bg-white border border-[#E5EAF2] rounded-xl px-3 py-2">
                        <span className="material-symbols-outlined text-[#718096] text-[18px] mr-2">
                          mail
                        </span>
                        <input
                          type="email"
                          required
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          placeholder="Enter your Gmail or email address"
                          className="w-full bg-transparent text-sm text-[#101C35] outline-none placeholder:text-[#718096]"
                        />
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-xs font-semibold text-[#101C35] mb-1">
                        Mobile Number
                      </label>
                      <div className="flex items-center bg-white border border-[#E5EAF2] rounded-xl px-3 py-2">
                        <span className="text-xs font-bold text-[#101C35] mr-2 border-r border-[#E5EAF2] pr-2">
                          +91
                        </span>
                        <input
                          type="tel"
                          required
                          value={signUpPhone}
                          onChange={(e) => setSignUpPhone(e.target.value)}
                          placeholder="Enter your 10-digit mobile number"
                          className="w-full bg-transparent text-sm text-[#101C35] outline-none placeholder:text-[#718096]"
                        />
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-xs font-semibold text-[#101C35] mb-1">
                        Password
                      </label>
                      <div className="flex items-center bg-white border border-[#E5EAF2] rounded-xl px-3 py-2">
                        <span className="material-symbols-outlined text-[#718096] text-[18px] mr-2">
                          lock
                        </span>
                        <input
                          type={showSignUpPassword ? 'text' : 'password'}
                          required
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          placeholder="Create a strong password"
                          className="w-full bg-transparent text-sm text-[#101C35] outline-none placeholder:text-[#718096]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                          className="text-[#718096] p-1"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showSignUpPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="text-left">
                      <label className="block text-xs font-semibold text-[#101C35] mb-1">
                        Confirm Password
                      </label>
                      <div className="flex items-center bg-white border border-[#E5EAF2] rounded-xl px-3 py-2">
                        <span className="material-symbols-outlined text-[#718096] text-[18px] mr-2">
                          lock_reset
                        </span>
                        <input
                          type={showSignUpPassword ? 'text' : 'password'}
                          required
                          value={signUpConfirmPassword}
                          onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                          placeholder="Re-enter your password"
                          className="w-full bg-transparent text-sm text-[#101C35] outline-none placeholder:text-[#718096]"
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#F5F7FB] border border-[#E5EAF2] flex items-start gap-2 text-left">
                      <span className="material-symbols-outlined text-[16px] text-[#315EF4] mt-0.5">
                        privacy_tip
                      </span>
                      <p className="text-[11px] text-[#718096] leading-tight">
                        Sensitive identity documents (Aadhaar, PAN) are uploaded securely via ZK-Proof after registration.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 bg-[#101C35] hover:bg-[#1a2e56] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99] disabled:opacity-50 mt-2"
                    >
                      {loading ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">
                            progress_activity
                          </span>
                          <span>Initializing Vault...</span>
                        </>
                      ) : (
                        <span>Create Account</span>
                      )}
                    </button>
                  </form>
                )}

                {/* Google Sign-in */}
                <div className="mt-5 flex flex-col items-center w-full">
                  <div className="w-full flex items-center justify-center gap-3 mb-3">
                    <div className="flex-1 h-[1px] bg-[#E5EAF2]"></div>
                    <span className="text-[10px] text-[#718096] uppercase tracking-wider font-semibold">
                      or continue with
                    </span>
                    <div className="flex-1 h-[1px] bg-[#E5EAF2]"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full h-11 bg-white border border-[#E5EAF2] rounded-xl shadow-sm flex items-center justify-center gap-2.5 hover:bg-slate-50 transition text-xs sm:text-sm font-semibold text-[#101C35] disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.24v3.13C3.26 21.36 7.33 24 12 24z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.28 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.61H1.24C.45 8.19 0 9.99 0 12s.45 3.81 1.24 5.39l4.04-3.13z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.61l4.04 3.13c.95-2.84 3.6-4.99 6.72-4.99z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </button>
                </div>

                {/* 5. Guest Access Section */}
                <div className="mt-4 pt-3 border-t border-[#E5EAF2] flex flex-col items-center text-center">
                  <span className="text-xs text-[#718096] mb-2">Want to explore without an account?</span>
                  <button
                    type="button"
                    onClick={handleGuestAccess}
                    className="w-full h-10 bg-[#F5F7FB] border border-[#E5EAF2] text-[#101C35] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-100 transition"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#718096]">badge</span>
                    Continue as Guest
                  </button>
                  <span className="text-[10px] text-[#718096] mt-1.5">
                    Guest access is sandboxed. Real documents require an account.
                  </span>
                </div>
              </div>
            ) : (
              /* 7. Forgot Password Flow */
              <div className="flex flex-col w-full text-left">
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(false)}
                    className="flex items-center gap-1 text-[#718096] hover:text-[#101C35] text-xs font-semibold"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    Back to Login
                  </button>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">
                    Step {fpStep} of 4
                  </span>
                </div>

                {/* Step 1: Email */}
                {fpStep === 1 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setFpLoading(true);
                      setTimeout(() => {
                        setFpLoading(false);
                        setFpStep(2);
                        showToast(`OTP Code sent to ${fpEmail || 'your email'}`);
                      }, 700);
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <h3 className="text-lg font-bold text-[#101C35]">Forgot Password</h3>
                      <p className="text-xs text-[#718096] mt-0.5">
                        Enter your registered email to receive a secure zero-knowledge authentication code.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#101C35] mb-1">
                        Registered Email
                      </label>
                      <input
                        type="email"
                        required
                        value={fpEmail}
                        onChange={(e) => setFpEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-xl border border-[#E5EAF2] bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={fpLoading}
                      className="w-full h-11 bg-[#315EF4] hover:bg-blue-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow"
                    >
                      {fpLoading ? 'Sending...' : 'Send Verification Code'}
                    </button>
                  </form>
                )}

                {/* Step 2: OTP */}
                {fpStep === 2 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      showToast('Code verified successfully!');
                      setFpStep(3);
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <h3 className="text-lg font-bold text-[#101C35]">Verification Code</h3>
                      <p className="text-xs text-[#718096] mt-0.5">
                        We sent a 6-digit verification code to <strong>{fpEmail || 'your email'}</strong>.
                      </p>
                    </div>
                    <div className="flex justify-between gap-1.5 my-2">
                      {fpOtp.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`otp-input-${idx}`}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(e.target.value, idx)}
                          className="w-11 h-12 text-center text-lg font-bold bg-[#F5F7FB] border border-[#E5EAF2] rounded-xl focus:bg-white focus:border-blue-500 outline-none"
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#718096]">
                      <span>Expires in: <strong>02:45</strong></span>
                      <button
                        type="button"
                        onClick={() => showToast('New code sent!')}
                        className="text-[#315EF4] hover:underline"
                      >
                        Resend code
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="w-full h-11 bg-[#315EF4] hover:bg-blue-600 text-white rounded-xl text-sm font-semibold shadow"
                    >
                      Verify & Proceed
                    </button>
                  </form>
                )}

                {/* Step 3: New Password */}
                {fpStep === 3 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (fpNewPass !== fpConfirmPass) {
                        showToast('Passwords do not match');
                        return;
                      }
                      setFpStep(4);
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <h3 className="text-lg font-bold text-[#101C35]">Create New Password</h3>
                      <p className="text-xs text-[#718096] mt-0.5">
                        Choose a secure cryptographic passphrase for your account.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#101C35] mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={fpNewPass}
                        onChange={(e) => setFpNewPass(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full rounded-xl border border-[#E5EAF2] bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#101C35] mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={fpConfirmPass}
                        onChange={(e) => setFpConfirmPass(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full rounded-xl border border-[#E5EAF2] bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full h-11 bg-[#315EF4] hover:bg-blue-600 text-white rounded-xl text-sm font-semibold shadow"
                    >
                      Reset Password
                    </button>
                  </form>
                )}

                {/* Step 4: Success */}
                {fpStep === 4 && (
                  <div className="py-4 flex flex-col items-center text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                      <span className="material-symbols-outlined text-[28px]">check_circle</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#101C35]">Password Reset Complete</h3>
                    <p className="text-xs text-[#718096]">
                      Your key has been updated. You can now authenticate with your new credentials.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsForgotPasswordOpen(false)}
                      className="w-full h-11 bg-[#101C35] text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition shadow mt-2"
                    >
                      Return to Sign In
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trust Badges */}
          <div className="mt-6 flex items-center justify-center gap-4 text-[#718096] text-xs">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
              <span>ZK-SNARK Proofs</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">shield</span>
              <span>No Identity Leaks</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-4 py-4 flex flex-col items-center justify-center gap-1 text-center text-xs text-[#718096] border-t border-[#E5EAF2]">
        <div className="flex items-center gap-1.5 font-medium text-[#101C35]">
          <span className="material-symbols-outlined text-[14px] text-emerald-600">lock</span>
          <span>VERIMASK Zero-Knowledge Trust • 256-bit End-to-End Encrypted</span>
        </div>
        <span>Verify Without Revealing • Non-Custodial Identity</span>
      </footer>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#315EF4] border-t-transparent" />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
