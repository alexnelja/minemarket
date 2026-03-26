'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyDocument, type VerificationResult } from '@/lib/document-verification';

interface KycUploadProps {
  docType: string;
  existingDoc: { id: string; file_url: string; file_name: string } | null | undefined;
}

export function KycUpload({ docType, existingDoc }: KycUploadProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = verifyDocument(file.name, file.size, docType);
    setVerificationResult(result);

    if (result.valid) {
      // Auto-upload if valid
      doUpload(file);
    } else {
      // Wait for user confirmation
      setPendingFile(file);
    }
  }

  async function doUpload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    const res = await fetch('/api/kyc', { method: 'POST', body: formData });
    if (res.ok) {
      setVerificationResult(null);
      setPendingFile(null);
      router.refresh();
    }
    setUploading(false);
  }

  function handleConfirmUpload() {
    if (pendingFile) doUpload(pendingFile);
  }

  function handleCancel() {
    setVerificationResult(null);
    setPendingFile(null);
  }

  return (
    <div className="flex items-center gap-2">
      {/* Verification feedback */}
      {verificationResult && !uploading && (
        <div className="flex items-center gap-2">
          {verificationResult.valid && verificationResult.confidence === 'high' && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Looks correct
            </span>
          )}
          {verificationResult.valid && verificationResult.confidence === 'medium' && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              Uploaded — verify type
            </span>
          )}
          {!verificationResult.valid && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full max-w-[200px] truncate" title={verificationResult.issues.join('; ')}>
                {verificationResult.issues[0]}
              </span>
              <button onClick={handleConfirmUpload} className="text-[10px] text-amber-400 hover:text-amber-300 underline">
                Upload anyway
              </button>
              <button onClick={handleCancel} className="text-[10px] text-gray-500 hover:text-gray-300">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <label className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors cursor-pointer">
        {uploading ? 'Uploading...' : existingDoc ? 'Replace' : 'Upload'}
        <input type="file" className="hidden" onChange={handleFileSelect} disabled={uploading} accept=".pdf,.jpg,.jpeg,.png" />
      </label>
    </div>
  );
}
