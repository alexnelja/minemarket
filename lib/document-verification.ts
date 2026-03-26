// Document verification rules per doc type
export interface VerificationResult {
  valid: boolean;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  suggestions: string[];
}

const DOC_RULES: Record<string, {
  expectedFormats: string[];
  minSizeKb: number;
  maxSizeMb: number;
  namePatterns: RegExp[];
  description: string;
}> = {
  bill_of_lading: {
    expectedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    minSizeKb: 50,
    maxSizeMb: 20,
    namePatterns: [/b[io]l/i, /lading/i, /bl\d/i, /shipping/i],
    description: 'Bill of Lading — should be a scanned or digital copy from the shipping line',
  },
  certificate_of_origin: {
    expectedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    minSizeKb: 30,
    maxSizeMb: 10,
    namePatterns: [/cert.*origin/i, /coo/i, /origin/i],
    description: 'Certificate of Origin — issued by the chamber of commerce or customs',
  },
  weighbridge_ticket: {
    expectedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    minSizeKb: 10,
    maxSizeMb: 5,
    namePatterns: [/weigh/i, /bridge/i, /ticket/i, /weight/i],
    description: 'Weighbridge Ticket — showing loaded weight at the mine/port',
  },
  lab_report: {
    expectedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    minSizeKb: 50,
    maxSizeMb: 20,
    namePatterns: [/lab/i, /report/i, /assay/i, /analysis/i, /cert.*anal/i],
    description: 'Lab Report / Certificate of Analysis — from an accredited laboratory',
  },
  customs_declaration: {
    expectedFormats: ['pdf'],
    minSizeKb: 30,
    maxSizeMb: 10,
    namePatterns: [/custom/i, /declar/i, /sad500/i, /import/i, /export/i],
    description: 'Customs Declaration (SAD500) — from SARS or equivalent customs authority',
  },
  invoice: {
    expectedFormats: ['pdf'],
    minSizeKb: 20,
    maxSizeMb: 5,
    namePatterns: [/invoice/i, /inv[\d_-]/i, /commercial/i],
    description: 'Commercial Invoice — from the seller to the buyer',
  },
  lbma_certificate: {
    expectedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    minSizeKb: 30,
    maxSizeMb: 10,
    namePatterns: [/lbma/i, /good.*delivery/i, /assay/i, /refin/i],
    description: 'LBMA Good Delivery Certificate — from an accredited refinery',
  },
  lme_warrant: {
    expectedFormats: ['pdf'],
    minSizeKb: 20,
    maxSizeMb: 5,
    namePatterns: [/lme/i, /warrant/i, /metal.*exchange/i],
    description: 'LME Warrant — warehouse receipt for metal on the London Metal Exchange',
  },
  assay_certificate: {
    expectedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    minSizeKb: 30,
    maxSizeMb: 10,
    namePatterns: [/assay/i, /cert/i, /purity/i, /analysis/i],
    description: 'Assay Certificate — showing metal purity/grade from an accredited lab',
  },
  draft_survey: {
    expectedFormats: ['pdf'],
    minSizeKb: 50,
    maxSizeMb: 20,
    namePatterns: [/draft/i, /survey/i, /vessel/i],
    description: 'Draft Survey Report — weight determination by vessel draft readings',
  },
  // KYC documents
  company_registration: {
    expectedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    minSizeKb: 20,
    maxSizeMb: 10,
    namePatterns: [/cipc/i, /registr/i, /company/i, /incorpor/i],
    description: 'Company Registration Certificate (CIPC or equivalent)',
  },
  tax_clearance: {
    expectedFormats: ['pdf'],
    minSizeKb: 20,
    maxSizeMb: 5,
    namePatterns: [/tax/i, /clear/i, /sars/i, /compliance/i],
    description: 'Tax Clearance Certificate from SARS or equivalent',
  },
  bank_confirmation: {
    expectedFormats: ['pdf'],
    minSizeKb: 10,
    maxSizeMb: 5,
    namePatterns: [/bank/i, /confirm/i, /letter/i, /account/i],
    description: 'Bank Confirmation Letter — on bank letterhead',
  },
  directors_id: {
    expectedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    minSizeKb: 30,
    maxSizeMb: 10,
    namePatterns: [/id/i, /passport/i, /director/i, /identity/i],
    description: 'Directors ID or Passport — clear copy of identification document',
  },
  proof_of_address: {
    expectedFormats: ['pdf', 'jpg', 'jpeg', 'png'],
    minSizeKb: 20,
    maxSizeMb: 5,
    namePatterns: [/address/i, /proof/i, /utility/i, /statement/i],
    description: 'Proof of Address — utility bill, bank statement, or rates certificate (< 3 months)',
  },
};

export function verifyDocument(fileName: string, fileSize: number, docType: string): VerificationResult {
  const rules = DOC_RULES[docType];
  if (!rules) return { valid: true, confidence: 'low', issues: [], suggestions: ['Unknown document type'] };

  const issues: string[] = [];
  const suggestions: string[] = [];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Check format
  if (!rules.expectedFormats.includes(ext)) {
    issues.push(`Expected format: ${rules.expectedFormats.join(', ')}. Got: .${ext}`);
  }

  // Check size
  const sizeKb = fileSize / 1024;
  const sizeMb = sizeKb / 1024;
  if (sizeKb < rules.minSizeKb) {
    issues.push(`File seems too small (${sizeKb.toFixed(0)}KB). Minimum: ${rules.minSizeKb}KB`);
    suggestions.push('Ensure the document is a complete scan, not a thumbnail');
  }
  if (sizeMb > rules.maxSizeMb) {
    issues.push(`File too large (${sizeMb.toFixed(1)}MB). Maximum: ${rules.maxSizeMb}MB`);
    suggestions.push('Compress or re-scan at lower resolution');
  }

  // Check filename pattern (soft check — bonus confidence)
  const nameMatch = rules.namePatterns.some(p => p.test(fileName));

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low';
  if (issues.length === 0 && nameMatch) confidence = 'high';
  else if (issues.length === 0) confidence = 'medium';
  else confidence = 'low';

  if (!nameMatch && issues.length === 0) {
    suggestions.push(`Tip: Include "${docType.replace(/_/g, ' ')}" in the filename for easier identification`);
  }

  suggestions.push(rules.description);

  return {
    valid: issues.length === 0,
    confidence,
    issues,
    suggestions,
  };
}

export function getDocDescription(docType: string): string {
  return DOC_RULES[docType]?.description ?? '';
}
