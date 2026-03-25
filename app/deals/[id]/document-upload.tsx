'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DealDocument, DocType } from '@/lib/types';
import { timeAgo } from '@/lib/format';

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

interface DocumentUploadProps {
  dealId: string;
  documents: DealDocument[];
}

export function DocumentUpload({ dealId, documents }: DocumentUploadProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DocType>('bill_of_lading');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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

      router.refresh();
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

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
                <span className="text-xs text-gray-400">📄</span>
                <div>
                  <p className="text-sm text-white">{DOC_TYPE_LABELS[doc.doc_type]}</p>
                  <p className="text-xs text-gray-500">{timeAgo(doc.uploaded_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.verified && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                    ✓
                  </span>
                )}
              </div>
            </div>
          ))}
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
          {uploading ? 'Uploading…' : '+ Upload'}
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
