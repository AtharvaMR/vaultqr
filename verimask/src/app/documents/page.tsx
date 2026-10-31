'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import VaultUploadModal from '@/components/VaultUploadModal';

interface DocumentItem {
  id: string;
  type: string;
  title: string;
  authority: string;
  status: 'VERIFIED' | 'PENDING' | 'ACTION_REQUIRED';
  maskedId: string;
  uploadedDate: string;
  metaInfo?: string;
  issueNote?: string;
}

export default function MyDocumentsPage() {
  const [filter, setFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'ACTION_REQUIRED'>('ALL');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load real documents from server registry
  const loadDocs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/credentials');
      if (res.ok) {
        const data = await res.json();
        if (data.credentials && Array.isArray(data.credentials)) {
          const mapped: DocumentItem[] = data.credentials.map((c: any) => ({
            id: c.credentialId,
            type: c.documentType,
            title: c.qualification || `${c.documentType.replace(/_/g, ' ')} Attestation`,
            authority: c.issuer || 'Verification Authority',
            status: c.revoked ? 'ACTION_REQUIRED' : 'VERIFIED',
            maskedId: c.maskedIdentifier || '•••• •••• 9021',
            uploadedDate: new Date(c.issuedAt || Date.now()).toLocaleDateString(),
            metaInfo: c.ageVerification || 'Zero-Knowledge Proof Active',
          }));
          setDocuments(mapped);
        }
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleDeleteDocument = async (docId: string, docTitle: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${docTitle}" (${docId}) from your Vault?`
    );
    if (!confirmed) return;

    setDeletingId(docId);
    try {
      const res = await fetch(`/api/credentials/${encodeURIComponent(docId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        setToastMessage(`Document ${docId} successfully removed from Vault.`);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert(data.error || 'Failed to delete document');
      }
    } catch {
      alert('Network error while deleting document');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDocs = documents.filter((doc) => {
    if (filter === 'ALL') return true;
    return doc.status === filter;
  });

  const handleUploadSuccess = () => {
    loadDocs();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F7FB] text-[#101C35]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5EAF2] bg-white/90 backdrop-blur-md px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-[#718096] hover:text-[#101C35] transition">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#101C35] text-white">
              <span className="material-symbols-outlined text-[18px]">folder</span>
            </div>
            <span className="font-extrabold text-base tracking-wider uppercase">
              My Documents Wallet
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/credentials"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-[#101C35] hover:bg-slate-200 transition text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
            <span className="hidden sm:inline">QR Credentials</span>
          </Link>
          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#315EF4] text-white hover:bg-blue-600 transition text-xs font-semibold shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
            <span>Upload Document</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-between shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-600 hover:text-emerald-900">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#101C35] tracking-tight">
              My Documents
            </h1>
            <p className="text-xs text-[#718096] mt-0.5">
              All your verified credentials in one secure place. View details or delete documents at will.
            </p>
          </div>
          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#101C35] text-white hover:bg-slate-800 transition text-xs font-bold shadow self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add New Document</span>
          </Link>
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 border-b border-[#E5EAF2] pb-3 text-xs font-medium overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL', label: `All (${documents.length})` },
            { id: 'VERIFIED', label: `Verified (${documents.filter((d) => d.status === 'VERIFIED').length})` },
            { id: 'PENDING', label: `Pending (${documents.filter((d) => d.status === 'PENDING').length})` },
            { id: 'ACTION_REQUIRED', label: `Action Needed (${documents.filter((d) => d.status === 'ACTION_REQUIRED').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl transition ${
                filter === tab.id
                  ? 'bg-[#101C35] text-white font-bold shadow-sm'
                  : 'text-[#718096] hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12 space-y-2">
            <span className="material-symbols-outlined text-[32px] text-blue-500 animate-spin">
              progress_activity
            </span>
            <p className="text-xs text-[#718096]">Loading documents from vault...</p>
          </div>
        ) : documents.length === 0 ? (
          /* Empty State */
          <div className="rounded-3xl bg-white border border-[#E5EAF2] p-8 sm:p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#315EF4] mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-[32px]">folder_off</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#101C35]">Your Documents Wallet is Empty</h3>
              <p className="text-xs text-[#718096] max-w-sm mx-auto">
                No identity cards are currently in your vault. Upload your Aadhaar, PAN, or other identity document to store and mint Zero-Knowledge proofs.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#315EF4] hover:bg-blue-600 text-white text-xs font-bold shadow transition"
              >
                <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                <span>Upload First Document</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Documents List */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="rounded-2xl bg-white border border-[#E5EAF2] p-5 shadow-sm hover:shadow-md transition space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#315EF4] flex items-center justify-center font-bold group-hover:bg-blue-100 transition">
                        <span className="material-symbols-outlined text-[22px]">
                          {doc.type.includes('AADHAAR') ? 'badge' : doc.type.includes('PAN') ? 'credit_card' : 'description'}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#101C35] group-hover:text-[#315EF4] transition">
                          {doc.title}
                        </h3>
                        <span className="text-[11px] text-[#718096] block">{doc.authority}</span>
                      </div>
                    </Link>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        doc.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : doc.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>

                  <div className="bg-[#F5F7FB] p-2.5 rounded-xl text-xs space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Masked ID:</span>
                      <span className="font-bold text-[#101C35]">{doc.maskedId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Credential ID:</span>
                      <span className="text-slate-700 font-semibold">{doc.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#718096]">Uploaded:</span>
                      <span className="text-slate-600">{doc.uploadedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Document Card Action Area: Details, Certificate, and DELETE BUTTON */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#101C35] hover:bg-slate-800 text-white text-xs font-bold text-center flex items-center justify-center gap-1 transition"
                  >
                    <span className="material-symbols-outlined text-[15px]">info</span>
                    <span>Details</span>
                  </Link>

                  <Link
                    href={`/verify/${doc.id}`}
                    target="_blank"
                    className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-[#101C35] text-xs font-semibold flex items-center justify-center gap-1 transition"
                    title="Audit Certificate"
                  >
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
                    <span className="hidden sm:inline">Certificate</span>
                  </Link>

                  {/* DEDICATED DELETE BUTTON */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteDocument(doc.id, doc.title, e)}
                    disabled={deletingId === doc.id}
                    className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-1 transition active:scale-[0.98] disabled:opacity-50"
                    title="Delete Document from Vault"
                  >
                    <span className="material-symbols-outlined text-[15px] text-rose-600">
                      {deletingId === doc.id ? 'progress_activity' : 'delete'}
                    </span>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      <VaultUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
