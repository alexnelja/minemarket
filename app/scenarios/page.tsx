import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ScenariosClient } from './scenarios-client';

export default async function ScenariosPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  let scenarios: any[] = [];
  try {
    const { data } = await supabase
      .from('deal_scenarios')
      .select('id, name, commodity, commodity_subtype, sell_price, sell_point, buy_point, volume_tonnes, mine_name, loading_port, destination_name, breakeven_buy_price, total_costs, transport_mode, share_token, deal_id, index_price_used, grade, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    scenarios = data || [];
  } catch {
    // Table may not exist yet — show empty state
  }

  return <ScenariosClient scenarios={scenarios} />;
}
