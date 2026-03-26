'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DealDocument, DocType } from '@/lib/types';
import { timeAgo } from '@/lib/format';
import { verifyDocument, type VerificationResult } from '@/lib/document-verification';
import { isEsignConfigured } from '@/lib/esign';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  bill_of_lading: 'Bill of Lading',
  certificate_of_origin: 'Certificate of Origin',
  weighbridge_ticket: 'Weighbridge Ticket',
  lab_report: 'Lab Report',
  customs_declaration: 'Customs Declaration',
  invoice: 'Invoice',
  lbma_certificate: 'LBMA Certificate',
  lme_warrant: 'LME Warrant',
  assay_certificate: 'Assay Certificate',
  draft_survey: 'Draft Survey',
  phytosanitary_certificate: 'Phytosanitary Certificate',
};

const SIGNABLE_DOC_TYPES: DocType[] = ['invoice'];

interface DocumentUploadProps {
  dealId: string;
  documents: DealDocument[];
}

export function DocumentUpload({ dealId, documents }: DocumentUploadProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DocType>('bill_of_lading');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = verifyDocument(file.name, file.size, selectedType);
    setVerificationResult(result);
    setError(null);

    if (result.valid) {
      doUpload(file);
    } else {
      setPendingFile(file);
    }
  }

  async function doUpload(file: File) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', selectedType);

      const res = await fetch(`/api/deals/${dealId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Upload failed');
        return;
      }

      setVerificationResult(null);
      setPendingFile(null);
      router.refresh();
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleConfirmUpload() {
    if (pendingFile) doUpload(pendingFile);
  }

  function handleCancelUpload() {
    setVerificationResult(null);
    setPendingFile(null);
  }

  const esignReady = isEsignConfigured();

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Documents</h2>

      {/* Existing documents */}
      {documents.length > 0 && (
        <div className="space-y-2 mb-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-950 rounded-lg border border-gray-800"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">&#128196;</span>
                <div>
                  <p className="text-sm text-white">{DOC_TYPE_LABELS[doc.doc_type]}</p>
                  <p className="text-xs text-gray-500">{timeAgo(doc.uploaded_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.verified && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                    &#10003;
                  </span>
                )}
                {/* E-sign button for signable docs */}
                {SIGNABLE_DOC_TYPES.includes(doc.doc_type) && (
                  esignReady ? (
                    <button className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                      Request Signature
                    </button>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">
                      E-signing coming soon
                    </span>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verification feedback */}
      {verificationResult && !uploading && (
        <div className="mb-4 px-3 py-2 rounded-lg border text-sm">
          {verificationResult.valid && verificationResult.confidence === 'high' && (
            <div className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 px-3 py-2 rounded-lg">
              Document looks correct — uploading...
            </div>
          )}
          {verificationResult.valid && verificationResult.confidence === 'medium' && (
            <div className="bg-amber-500/10 border-amber-500/20 text-amber-400 px-3 py-2 rounded-lg">
              Uploaded — please verify this is the right document type
              {verificationResult.suggestions.length > 0 && (
                <p className="text-xs mt-1 text-amber-500/80">{verificationResult.suggestions[0]}</p>
              )}
            </div>
          )}
          {!verificationResult.valid && (
            <div className="bg-red-500/10 border-red-500/20 text-red-400 px-3 py-2 rounded-lg">
              <p className="font-medium mb-1">Potential issues:</p>
              <ul className="text-xs space-y-0.5 list-disc list-inside">
                {verificationResult.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
              {verificationResult.suggestions.length > 0 && (
                <p className="text-xs mt-1 text-red-500/80">{verificationResult.suggestions[0]}</p>
              )}
              <div className="flex gap-3 mt-2">
                <button onClick={handleConfirmUpload} className="text-xs text-amber-400 hover:text-amber-300 underline">
                  Upload anyway
                </button>
                <button onClick={handleCancelUpload} className="text-xs text-gray-500 hover:text-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload form */}
      <div className="flex items-center gap-3">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as DocType)}
          className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-gray-500"
        >
          {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([type, label]) => (
            <option key={type} value={type}>{label}</option>
          ))}
        </select>
        <label className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors cursor-pointer">
          {uploading ? 'Uploading...' : '+ Upload'}
          <input
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
