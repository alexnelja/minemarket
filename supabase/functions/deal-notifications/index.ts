import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STATUS_LABELS: Record<string, string> = {
  interest: "Interest Expressed",
  first_accept: "First Accept",
  negotiation: "Negotiation",
  second_accept: "Second Accept — Terms Locked",
  escrow_held: "Escrow Held — Funds Secured",
  loading: "Loading at Port",
  in_transit: "In Transit",
  delivered: "Delivered",
  escrow_released: "Escrow Released — Payment Sent",
  completed: "Deal Completed",
  disputed: "Disputed — Escrow Frozen",
  cancelled: "Deal Cancelled",
};

// Who gets notified on each status change
const NOTIFY_CONFIG: Record<string, { notify: "buyer" | "seller" | "both"; subject: string }> = {
  interest:        { notify: "seller", subject: "New interest in your listing" },
  first_accept:    { notify: "buyer",  subject: "Seller accepted your interest" },
  negotiation:     { notify: "both",   subject: "Deal moved to negotiation" },
  second_accept:   { notify: "both",   subject: "Terms locked — escrow deposit required" },
  escrow_held:     { notify: "both",   subject: "Escrow confirmed — funds secured" },
  loading:         { notify: "buyer",  subject: "Material is being loaded" },
  in_transit:      { notify: "buyer",  subject: "Shipment departed — in transit" },
  delivered:       { notify: "seller", subject: "Buyer confirmed delivery" },
  escrow_released: { notify: "seller", subject: "Escrow released — payment on the way" },
  completed:       { notify: "both",   subject: "Deal completed — please rate your counterparty" },
  disputed:        { notify: "both",   subject: "Deal disputed — escrow frozen" },
  cancelled:       { notify: "both",   subject: "Deal cancelled" },
};

const COMMODITY_LABELS: Record<string, string> = {
  chrome: "Chrome",
  manganese: "Manganese",
  iron_ore: "Iron Ore",
  coal: "Coal",
  aggregates: "Aggregates",
};

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "MineMarket <notifications@minemarket.app>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to send email to ${to}: ${err}`);
    return false;
  }
  return true;
}

function buildEmailHtml(
  deal: Record<string, unknown>,
  newStatus: string,
  recipientRole: string,
  counterpartyName: string,
  commodityLabel: string,
): string {
  const label = STATUS_LABELS[newStatus] ?? newStatus;

  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: white; color: black; font-weight: bold; font-size: 12px; width: 28px; height: 28px; line-height: 28px; border-radius: 6px; text-align: center;">M</div>
        <span style="font-weight: 600; font-size: 14px; margin-left: 8px;">MineMarket</span>
      </div>

      <h2 style="color: #f59e0b; font-size: 18px; margin: 0 0 8px;">${label}</h2>
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 20px;">
        Your ${commodityLabel} deal with ${counterpartyName} has been updated.
      </p>

      <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 13px; color: #e2e8f0;">
          <tr><td style="color: #64748b; padding: 4px 0;">Commodity</td><td style="text-align: right;">${commodityLabel}</td></tr>
          <tr><td style="color: #64748b; padding: 4px 0;">Price</td><td style="text-align: right; color: #f59e0b;">${deal.currency} ${deal.agreed_price}/t</td></tr>
          <tr><td style="color: #64748b; padding: 4px 0;">Volume</td><td style="text-align: right;">${Number(deal.volume_tonnes).toLocaleString()}t</td></tr>
          <tr><td style="color: #64748b; padding: 4px 0;">Incoterm</td><td style="text-align: right;">${deal.incoterm}</td></tr>
          <tr><td style="color: #64748b; padding: 4px 0;">Status</td><td style="text-align: right; color: #34d399;">${label}</td></tr>
          <tr><td style="color: #64748b; padding: 4px 0;">Your role</td><td style="text-align: right;">${recipientRole}</td></tr>
        </table>
      </div>

      <a href="https://minemarket.app/deals/${deal.id}" style="display: block; text-align: center; background: #f59e0b; color: #000; font-weight: 600; font-size: 14px; padding: 12px; border-radius: 8px; text-decoration: none;">
        View Deal
      </a>

      <p style="color: #475569; font-size: 11px; text-align: center; margin-top: 24px;">
        MineMarket &middot; Bulk minerals marketplace
      </p>
    </div>
  `;
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();

    if (payload.table !== "deals") {
      return new Response(JSON.stringify({ message: "Not a deals event" }), { status: 200 });
    }

    const deal = payload.record;
    const oldDeal = payload.old_record;
    const newStatus = deal.status as string;

    // Skip if status didn't change
    if (payload.type === "UPDATE" && oldDeal && oldDeal.status === newStatus) {
      return new Response(JSON.stringify({ message: "Status unchanged" }), { status: 200 });
    }

    // On INSERT, only notify for interest
    if (payload.type === "INSERT" && newStatus !== "interest") {
      return new Response(JSON.stringify({ message: "Skipping non-interest insert" }), { status: 200 });
    }

    const config = NOTIFY_CONFIG[newStatus];
    if (!config) {
      return new Response(JSON.stringify({ message: `No config for ${newStatus}` }), { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const buyerId = deal.buyer_id as string;
    const sellerId = deal.seller_id as string;
    const commodityLabel = COMMODITY_LABELS[deal.commodity_type as string] ?? (deal.commodity_type as string);

    // Determine recipients
    const recipientIds: { id: string; role: string }[] = [];
    if (config.notify === "buyer" || config.notify === "both") {
      recipientIds.push({ id: buyerId, role: "Buyer" });
    }
    if (config.notify === "seller" || config.notify === "both") {
      recipientIds.push({ id: sellerId, role: "Seller" });
    }

    // Fetch auth users for emails
    const { data: buyerAuth } = await supabase.auth.admin.getUserById(buyerId);
    const { data: sellerAuth } = await supabase.auth.admin.getUserById(sellerId);

    // Fetch company names
    const { data: profiles } = await supabase
      .from("users")
      .select("id, company_name")
      .in("id", [buyerId, sellerId]);

    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; company_name: string }) => [p.id, p.company_name]),
    );

    const emailMap = new Map<string, string>();
    if (buyerAuth?.user?.email) emailMap.set(buyerId, buyerAuth.user.email);
    if (sellerAuth?.user?.email) emailMap.set(sellerId, sellerAuth.user.email);

    let sent = 0;
    for (const recipient of recipientIds) {
      const email = emailMap.get(recipient.id);
      if (!email) {
        console.log(`No email for user ${recipient.id}`);
        continue;
      }

      const counterpartyId = recipient.id === buyerId ? sellerId : buyerId;
      const counterpartyName = profileMap.get(counterpartyId) ?? "your counterparty";

      const html = buildEmailHtml(deal, newStatus, recipient.role, counterpartyName, commodityLabel);
      const success = await sendEmail(email, config.subject, html);
      if (success) sent++;
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sent} notification(s) for ${newStatus}` }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
