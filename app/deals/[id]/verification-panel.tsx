'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PlatformVerification } from '@/lib/platform-verification';
import type { SpecComparisonSummary } from '@/lib/spec-comparison';
import { formatLabSummary } from '@/lib/lab-summary';
import { SPEC_LABELS } from '@/lib/spec-fields';

const INSPECTOR_TYPES = [
  { key: 'lab_assay', label: 'Lab Assay / Analysis', desc: 'Independent lab testing of material spec (Cr₂O₃, Fe, moisture, etc.)' },
  { key: 'draft_survey', label: 'Draft Survey', desc: 'Weight determination by vessel draft readings at loading/discharge' },
  { key: 'loading_inspection', label: 'Loading Inspection', desc: 'Supervision of loading operations, sampling, and quality checks' },
  { key: 'discharge_inspection', label: 'Discharge Inspection', desc: 'Supervision of discharge, final weight and quality assessment' },
];

const KNOWN_LABS = [
  { name: 'SGS', email: '', desc: 'Global leader in inspection, verification, testing and certification' },
  { name: 'Bureau Veritas', email: '', desc: 'Testing, inspection and certification services' },
  { name: 'Intertek', email: '', desc: 'Quality assurance for commodities worldwide' },
  { name: 'Alfred H Knight', email: '', desc: 'Specializing in minerals, metals and solid fuels' },
  { name: 'Cotecna', email: '', desc: 'Inspection, security and certification services' },
  { name: 'Other', email: '', desc: 'Specify your preferred inspection company' },
];

interface VerificationPanelProps {
  dealId: string;
  platformVerification: PlatformVerification;
  specComparison?: SpecComparisonSummary | null;
  labSource?: { company: string | null; completedAt: string | null } | null;
}

export function VerificationPanel({ dealId, platformVerification, specComparison, labSource }: VerificationPanelProps) {
  const labSummary = formatLabSummary(specComparison ?? null);
  const router = useRouter();
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [showRequest, setShowRequest] = useState(false);
  const [selectedType, setSelectedType] = useState('lab_assay');
  const [selectedLab, setSelectedLab] = useState('SGS');
  const [labEmail, setLabEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/deals/${dealId}/verification-request`)
      .then(r => r.json())
      .then(setRequests)
      .catch(() => {});
  }, [dealId]);

  async function submitRequest() {
    setSending(true);
    const res = await fetch(`/api/deals/${dealId}/verification-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inspector_type: selectedType,
        inspector_company: selectedLab,
        inspector_email: labEmail || null,
        notes: notes || null,
      }),
    });
    if (res.ok) {
      setShowRequest(false);
      setNotes('');
      setLabEmail('');
      const updated = await fetch(`/api/deals/${dealId}/verification-request`).then(r => r.json());
      setRequests(updated);
    }
    setSending(false);
  }

  const statusColors = {
    verified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    issues_found: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    incomplete: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  return (
    <div className="space-y-4">
      {/* Platform Verification Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Platform Verification</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[platformVerification.overallStatus]}`}>
            {platformVerification.overallStatus.replace('_', ' ')}
          </span>
        </div>

        <div className="space-y-2">
          {platformVerification.checks.map((check, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                check.status === 'pass' ? 'bg-emerald-500 text-black' :
                check.status === 'fail' ? 'bg-red-500 text-white' :
                check.status === 'warning' ? 'bg-amber-500 text-black' :
                'bg-gray-700 text-gray-400'
              }`}>
                {check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : check.status === 'warning' ? '!' : '·'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{check.check}</p>
                <p className="text-[10px] text-gray-500 truncate">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lab Assay Results */}
      {labSummary && specComparison && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Lab Assay Results</h3>
            {labSource?.company && (
              <span className="text-[10px] text-gray-500">
                {labSource.company}
                {labSource.completedAt && ` · ${new Date(labSource.completedAt).toLocaleDateString()}`}
              </span>
            )}
          </div>

          <div className={`mb-4 px-3 py-2 rounded-lg text-sm border ${
            labSummary.tone === 'reject' ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : labSummary.tone === 'penalty' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            : labSummary.tone === 'bonus' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <span>{labSummary.headline}</span>
              {labSummary.adjustmentLabel && (
                <span className="font-semibold">{labSummary.adjustmentLabel}</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {specComparison.results.map((r) => {
              const color =
                r.status === 'within_spec' ? 'text-emerald-400'
                : r.status === 'bonus' ? 'text-blue-400'
                : r.status === 'penalty' ? 'text-amber-400'
                : 'text-red-400';
              const label =
                r.status === 'within_spec' ? 'OK'
                : r.status === 'bonus' ? 'Bonus'
                : r.status === 'penalty' ? 'Penalty'
                : 'Reject';
              return (
                <div key={r.field} className="flex items-center justify-between text-xs bg-gray-950 rounded-lg px-3 py-2">
                  <span className="text-white">{SPEC_LABELS[r.field] ?? r.field}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">target {r.target.toFixed(2)}</span>
                    <span className="text-white">actual {r.actual.toFixed(2)}</span>
                    <span className={`font-medium ${color}`}>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Independent Verification Requests */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Independent Verification</h3>
          <button
            onClick={() => setShowRequest(!showRequest)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            + Request Inspection
          </button>
        </div>

        {/* Existing requests */}
        {requests.length > 0 && (
          <div className="space-y-2 mb-4">
            {requests.map((req: Record<string, unknown>) => (
              <div key={req.id as string} className="flex items-center gap-3 bg-gray-950 rounded-lg px-3 py-2">
                <span className={`w-2 h-2 rounded-full ${
                  req.status === 'completed' ? 'bg-emerald-500' :
                  req.status === 'in_progress' ? 'bg-amber-500' :
                  'bg-gray-600'
                }`} />
                <div className="flex-1">
                  <p className="text-xs text-white">{(req.inspector_type as string)?.replace(/_/g, ' ')} — {req.inspector_company as string}</p>
                  <p className="text-[10px] text-gray-500">{req.status as string} · {new Date(req.requested_at as string).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {requests.length === 0 && !showRequest && (
          <p className="text-xs text-gray-500 mb-4">No independent verification requested yet. Request an inspection from SGS, Bureau Veritas, or another accredited lab.</p>
        )}

        {/* New request form */}
        {showRequest && (
          <div className="border-t border-gray-800 pt-4 space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Inspection Type</label>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500">
                {INSPECTOR_TYPES.map(t => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-1">{INSPECTOR_TYPES.find(t => t.key === selectedType)?.desc}</p>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Inspection Company</label>
              <div className="grid grid-cols-3 gap-2">
                {KNOWN_LABS.map(lab => (
                  <button key={lab.name} type="button" onClick={() => setSelectedLab(lab.name)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                      selectedLab === lab.name ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}>
                    {lab.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Inspector Email (optional)</label>
              <input type="email" value={labEmail} onChange={e => setLabEmail(e.target.value)}
                placeholder="inspector@sgs.com"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500" />
              <p className="text-[10px] text-gray-500 mt-1">If provided, the inspector will receive an email with deal details and a link to upload results.</p>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Specific instructions, sampling points, etc."
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-none" />
            </div>

            <div className="flex gap-2">
              <button onClick={submitRequest} disabled={sending}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                {sending ? 'Sending...' : 'Submit Request'}
              </button>
              <button onClick={() => setShowRequest(false)}
                className="text-sm text-gray-400 hover:text-gray-200 px-4 py-2">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
