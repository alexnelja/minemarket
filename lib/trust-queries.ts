// lib/trust-queries.ts

import { createAdminSupabaseClient } from './supabase-server';
import { computeTrustScore } from './trust-score';
import type { TrustScore } from './trust-score';
import type { Rating, Verification } from './types';

/**
 * Fetch all ratings for a given user (where they are the rated party).
 * Uses admin client to bypass RLS since we need cross-user data.
 */
export async function getUserRatings(userId: string): Promise<Rating[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('ratings')
    .select('*')
    .eq('rated_user_id', userId);

  if (error || !data) return [];
  return data as Rating[];
}

/**
 * Count completed and disputed deals for a user.
 */
async function getUserDealCounts(userId: string): Promise<{ completed: number; disputed: number }> {
  const admin = createAdminSupabaseClient();

  const { count: completed } = await admin
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .in('status', ['completed', 'escrow_released']);

  const { count: disputed } = await admin
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .eq('status', 'disputed');

  return {
    completed: completed ?? 0,
    disputed: disputed ?? 0,
  };
}

/**
 * Compute the platform-wide average rating across all dimensions.
 * Returns a single number (average of all dimension averages).
 */
async function getPlatformAverage(): Promise<number> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from('ratings')
    .select('spec_accuracy, timeliness, communication, documentation');

  if (!data || data.length === 0) return 3.0;

  const total = data.reduce((sum, r) => {
    return sum + r.spec_accuracy + r.timeliness + r.communication + r.documentation;
  }, 0);

  return total / (data.length * 4);
}

/**
 * Get the full computed trust score for a user.
 */
export async function getTrustScoreForUser(userId: string): Promise<TrustScore> {
  const [ratings, dealCounts, platformAvg] = await Promise.all([
    getUserRatings(userId),
    getUserDealCounts(userId),
    getPlatformAverage(),
  ]);

  return computeTrustScore(ratings, dealCounts.completed, dealCounts.disputed, platformAvg);
}

/**
 * Fetch verification records for a listing.
 */
export async function getListingVerifications(listingId: string): Promise<Verification[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from('verifications')
    .select('*')
    .eq('listing_id', listingId)
    .order('verified_at', { ascending: false });

  if (error || !data) return [];
  return data as Verification[];
}

/**
 * Get trust score for a user by looking up from a listing's seller_id.
 * Convenience wrapper for listing detail pages.
 */
export async function getSellerTrustScore(sellerId: string): Promise<TrustScore> {
  return getTrustScoreForUser(sellerId);
}
