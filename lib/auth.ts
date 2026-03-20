import { createServerSupabaseClient } from './supabase-server';
import { redirect } from 'next/navigation';
import type { User } from './types';

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  return profile as User | null;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}
