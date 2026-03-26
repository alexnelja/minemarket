// E-Signature integration using DocuSeal (open source)
// DocuSeal API: https://www.docuseal.com/docs/api
// Self-hosted or cloud at https://api.docuseal.com

const DOCUSEAL_API_URL = process.env.DOCUSEAL_API_URL || 'https://api.docuseal.com';
const DOCUSEAL_API_KEY = process.env.DOCUSEAL_API_KEY || '';

export interface SignatureRequest {
  dealId: string;
  documentUrl: string;
  documentName: string;
  signers: { name: string; email: string; role: string }[];
}

export interface SignatureStatus {
  id: string;
  status: 'pending' | 'signed' | 'declined' | 'expired';
  signers: { name: string; email: string; signed: boolean; signedAt: string | null }[];
  documentUrl: string | null;
}

export async function createSignatureRequest(request: SignatureRequest): Promise<{ id: string; error?: string }> {
  if (!DOCUSEAL_API_KEY) {
    return { id: '', error: 'E-signature service not configured. Set DOCUSEAL_API_KEY.' };
  }

  try {
    const res = await fetch(`${DOCUSEAL_API_URL}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': DOCUSEAL_API_KEY,
      },
      body: JSON.stringify({
        template_id: null, // Use document directly
        send_email: true,
        submitters: request.signers.map(s => ({
          name: s.name,
          email: s.email,
          role: s.role,
        })),
      }),
    });

    if (!res.ok) {
      return { id: '', error: `DocuSeal API error: ${res.status}` };
    }

    const data = await res.json();
    return { id: data.id || data[0]?.id || '' };
  } catch (err) {
    return { id: '', error: String(err) };
  }
}

export async function getSignatureStatus(submissionId: string): Promise<SignatureStatus | null> {
  if (!DOCUSEAL_API_KEY) return null;

  try {
    const res = await fetch(`${DOCUSEAL_API_URL}/submissions/${submissionId}`, {
      headers: { 'X-Auth-Token': DOCUSEAL_API_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      status: data.status || 'pending',
      signers: (data.submitters || []).map((s: Record<string, unknown>) => ({
        name: s.name as string,
        email: s.email as string,
        signed: s.completed_at != null,
        signedAt: (s.completed_at as string) || null,
      })),
      documentUrl: data.documents?.[0]?.url || null,
    };
  } catch {
    return null;
  }
}

export function isEsignConfigured(): boolean {
  return !!DOCUSEAL_API_KEY;
}
