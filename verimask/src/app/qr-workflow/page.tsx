'use client';

import React from 'react';
import Link from 'next/link';
import VerimaskQrWorkflow from '@/components/VerimaskQrWorkflow';

export default function QrWorkflowPage() {
  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#101C35] pb-12">
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
              Cryptographic QR Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/scanner"
            className="flex items-center gap-1 text-xs font-bold text-[#315EF4] hover:underline"
          >
            <span className="material-symbols-outlined text-[16px]">filter_center_focus</span>
            <span>Viewfinder Scanner</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-[#101C35] tracking-tight">
            Cryptographic Credential &amp; QR Engine
          </h1>
          <p className="text-xs text-[#718096] max-w-lg mx-auto">
            Generate verifiable credentials signed with ECDSA/JWS, render high-res QR codes, and scan via @zxing live camera or image decode.
          </p>
        </div>

        <VerimaskQrWorkflow />
      </main>
    </div>
  );
}
