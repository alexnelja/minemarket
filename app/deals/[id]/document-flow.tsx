import type { DealStatus, DealDocument, CommodityType, DocType } from '@/lib/types';

const DOC_FLOW_STAGES = [
  {
    stage: 'Pre-Shipment',
    dealStatuses: ['interest', 'first_accept', 'negotiation', 'second_accept', 'escrow_held'] as DealStatus[],
    docs: ['invoice'] as DocType[],
    description: 'Commercial terms agreed, invoice issued',
  },
  {
    stage: 'Loading',
    dealStatuses: ['loading'] as DealStatus[],
    docs: ['weighbridge_ticket', 'lab_report', 'certificate_of_origin'] as DocType[],
    description: 'Material loaded, weighed, tested, and origin certified',
  },
  {
    stage: 'Shipping',
    dealStatuses: ['in_transit'] as DealStatus[],
    docs: ['bill_of_lading', 'customs_declaration'] as DocType[],
    description: 'Vessel departed, BOL issued, customs cleared',
  },
  {
    stage: 'Delivery',
    dealStatuses: ['delivered', 'escrow_released'] as DealStatus[],
    docs: ['draft_survey', 'assay_certificate'] as DocType[],
    description: 'Cargo received, weighed, and assayed at destination',
  },
];

const DOC_LABELS: Record<string, string> = {
  bill_of_lading: 'BOL',
  certificate_of_origin: 'CoO',
  weighbridge_ticket: 'Weighbridge',
  lab_report: 'Lab Report',
  customs_declaration: 'Customs',
  invoice: 'Invoice',
  lbma_certificate: 'LBMA Cert',
  lme_warrant: 'LME Warrant',
  assay_certificate: 'Assay Cert',
  draft_survey: 'Draft Survey',
  phytosanitary_certificate: 'Phyto Cert',
};

interface DocumentFlowProps {
  dealStatus: DealStatus;
  documents: DealDocument[];
  commodity: CommodityType;
}

export function DocumentFlow({ dealStatus, documents, commodity }: DocumentFlowProps) {
  const uploadedTypes = new Set(documents.map(d => d.doc_type));

  // Determine which stage the deal is currently at
  const currentStageIndex = DOC_FLOW_STAGES.findIndex(s =>
    s.dealStatuses.includes(dealStatus)
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">Document Flow</h3>

      {/* Horizontal pipeline */}
      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {DOC_FLOW_STAGES.map((stage, index) => {
          const isPast = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isFuture = index > currentStageIndex;

          return (
            <div key={stage.stage} className="flex items-start flex-1 min-w-[160px]">
              {/* Stage content */}
              <div className="flex flex-col items-center w-full">
                {/* Connector + circle */}
                <div className="flex items-center w-full mb-3">
                  {/* Left connector line */}
                  {index > 0 && (
                    <div className={`h-0.5 flex-1 ${isPast || isCurrent ? 'bg-emerald-500/50' : 'bg-gray-700'}`} />
                  )}
                  {index === 0 && <div className="flex-1" />}

                  {/* Circle */}
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                    isPast ? 'border-emerald-500 bg-emerald-500 text-black'
                    : isCurrent ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                    : 'border-gray-600 bg-gray-900 text-gray-600'
                  }`}>
                    {isPast ? '\u2713' : index + 1}
                  </div>

                  {/* Right connector line */}
                  {index < DOC_FLOW_STAGES.length - 1 && (
                    <div className={`h-0.5 flex-1 ${isPast ? 'bg-emerald-500/50' : 'bg-gray-700'}`} />
                  )}
                  {index === DOC_FLOW_STAGES.length - 1 && <div className="flex-1" />}
                </div>

                {/* Stage label */}
                <p className={`text-xs font-medium mb-1 ${
                  isPast ? 'text-emerald-400' : isCurrent ? 'text-amber-400' : 'text-gray-500'
                }`}>
                  {stage.stage}
                </p>

                {/* Description */}
                <p className="text-[10px] text-gray-600 text-center mb-2 px-1">
                  {stage.description}
                </p>

                {/* Document pills */}
                <div className="flex flex-col gap-1 w-full px-1">
                  {stage.docs.map(docType => {
                    const uploaded = uploadedTypes.has(docType);
                    return (
                      <div key={docType} className={`text-[10px] px-2 py-1 rounded-md text-center ${
                        uploaded
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : isCurrent
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-gray-800 text-gray-500 border border-gray-700'
                      }`}>
                        {uploaded ? '\u2713 ' : ''}{DOC_LABELS[docType] ?? docType}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
