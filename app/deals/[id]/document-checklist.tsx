import type { DealDocument, DocType, CommodityType } from '@/lib/types';

// Required documents per commodity type
const REQUIRED_DOCS: Record<string, DocType[]> = {
  chrome: ['bill_of_lading', 'certificate_of_origin', 'weighbridge_ticket', 'lab_report', 'customs_declaration', 'invoice'],
  manganese: ['bill_of_lading', 'certificate_of_origin', 'weighbridge_ticket', 'lab_report', 'customs_declaration', 'invoice'],
  iron_ore: ['bill_of_lading', 'certificate_of_origin', 'weighbridge_ticket', 'lab_report', 'customs_declaration', 'invoice', 'draft_survey'],
  coal: ['bill_of_lading', 'certificate_of_origin', 'weighbridge_ticket', 'lab_report', 'customs_declaration', 'invoice'],
  platinum: ['bill_of_lading', 'assay_certificate', 'lbma_certificate', 'customs_declaration', 'invoice'],
  gold: ['bill_of_lading', 'assay_certificate', 'lbma_certificate', 'customs_declaration', 'invoice'],
  copper: ['bill_of_lading', 'certificate_of_origin', 'lab_report', 'lme_warrant', 'customs_declaration', 'invoice'],
  vanadium: ['bill_of_lading', 'certificate_of_origin', 'lab_report', 'customs_declaration', 'invoice'],
  titanium: ['bill_of_lading', 'certificate_of_origin', 'lab_report', 'customs_declaration', 'invoice'],
  aggregates: ['weighbridge_ticket', 'invoice'],
};

const DOC_LABELS: Record<DocType, string> = {
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

interface DocumentChecklistProps {
  commodity: CommodityType;
  documents: DealDocument[];
}

export function DocumentChecklist({ commodity, documents }: DocumentChecklistProps) {
  const required = REQUIRED_DOCS[commodity] ?? REQUIRED_DOCS.chrome;
  const uploadedTypes = new Set(documents.map(d => d.doc_type));
  const completedCount = required.filter(t => uploadedTypes.has(t)).length;
  const progress = required.length > 0 ? (completedCount / required.length) * 100 : 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Required Documents</h3>
        <span className="text-xs text-gray-500">{completedCount}/{required.length} complete</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-800 rounded-full mb-4">
        <div
          className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {required.map(docType => {
          const uploaded = documents.find(d => d.doc_type === docType);
          return (
            <div key={docType} className="flex items-center gap-3 py-1.5">
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${
                uploaded
                  ? 'border-emerald-500 bg-emerald-500 text-black'
                  : 'border-gray-600 text-gray-600'
              }`}>
                {uploaded ? '\u2713' : ''}
              </span>
              <span className={`text-sm flex-1 ${uploaded ? 'text-white' : 'text-gray-500'}`}>
                {DOC_LABELS[docType]}
              </span>
              {uploaded && (
                <span className="text-xs text-gray-500">
                  {new Date(uploaded.uploaded_at).toLocaleDateString()}
                </span>
              )}
              {!uploaded && (
                <span className="text-[10px] text-gray-600">Pending</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
