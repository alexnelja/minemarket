import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { TermSheetData } from './term-sheet-data';

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#111' },
  h1: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  ref: { fontSize: 9, color: '#666', marginBottom: 24 },
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, color: '#666', marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 3 },
  key: { width: 120, color: '#555' },
  val: { flex: 1 },
  hr: { borderBottom: '1 solid #ddd', marginBottom: 12 },
  table: { marginTop: 4 },
  tableHead: { flexDirection: 'row', borderBottom: '1 solid #ccc', paddingBottom: 3, marginBottom: 3 },
  tableCell: { flex: 1, fontSize: 9 },
  tableCellHead: { flex: 1, fontSize: 8, color: '#666', textTransform: 'uppercase' },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, fontSize: 8, color: '#999', borderTop: '1 solid #eee', paddingTop: 8 },
});

function TermSheet({ data }: { data: TermSheetData }) {
  const total = data.commercials.total_value_usd.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const unit = data.commercials.unit_price_usd.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const vol = data.commercials.volume_tonnes.toLocaleString('en-US');

  return (
    <Document title={data.title}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{data.title}</Text>
        <Text style={s.ref}>Deal Reference: {data.deal_ref} · Effective {data.dates.effective_date}</Text>
        <View style={s.hr} />

        <View style={s.section}>
          <Text style={s.sectionLabel}>Parties</Text>
          <View style={s.row}><Text style={s.key}>Seller</Text><Text style={s.val}>{data.parties.seller.name} — {data.parties.seller.email}</Text></View>
          <View style={s.row}><Text style={s.key}>Buyer</Text><Text style={s.val}>{data.parties.buyer.name} — {data.parties.buyer.email}</Text></View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Commercial Terms</Text>
          <View style={s.row}><Text style={s.key}>Commodity</Text><Text style={s.val}>{data.commercials.commodity}{data.commercials.subtype ? ` · ${data.commercials.subtype}` : ''}</Text></View>
          <View style={s.row}><Text style={s.key}>Volume</Text><Text style={s.val}>{vol} t</Text></View>
          <View style={s.row}><Text style={s.key}>Unit Price</Text><Text style={s.val}>{data.commercials.currency} {unit} / t</Text></View>
          <View style={s.row}><Text style={s.key}>Total Value</Text><Text style={s.val}>{data.commercials.currency} {total}</Text></View>
          <View style={s.row}><Text style={s.key}>Incoterm</Text><Text style={s.val}>{data.commercials.incoterm}</Text></View>
        </View>

        {data.spec_rows.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Specification Tolerances</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={s.tableCellHead}>Parameter</Text>
                <Text style={s.tableCellHead}>Constraint</Text>
              </View>
              {data.spec_rows.map((r) => (
                <View style={s.row} key={r.key}>
                  <Text style={s.tableCell}>{r.label}</Text>
                  <Text style={s.tableCell}>{r.constraint}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionLabel}>Notes</Text>
          <Text>
            This term sheet summarises the agreed commercial and technical terms of the above deal as captured on MineMarket. It is a record of
            agreement and does not substitute for a signed sale contract. Payment, delivery, and inspection terms follow the underlying Incoterm,
            platform verification flow, and any BSEC financial instruments attached to this deal.
          </Text>
        </View>

        <Text style={s.footer} fixed>
          MineMarket — Generated {data.dates.generated_at}. For questions, contact the counterparty directly via the deal workspace.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderTermSheetPdf(data: TermSheetData): Promise<Buffer> {
  return renderToBuffer(<TermSheet data={data} />);
}
