/**
 * review.service.ts — Customer rating & review data access layer.
 *
 * Owns everything related to the post-completion rating flow:
 *   - submitting a star rating + optional text review (linked to the assigned
 *     technician), which the DB trigger rolls up into the technician's average
 *     rating and review count in real time;
 *   - reading a technician's reviews, their "top" (highest-rated written)
 *     review, and aggregate stats for the customer-facing home page.
 *
 * All writes go through Supabase with RLS: a review can only be inserted by
 * the job's owner (customer_id = auth.uid()) for a COMPLETED job. The
 * recomment_technician_rating trigger keeps profiles.rating / reviews_count
 * authoritative, so we never update aggregates from the client.
 */

import { supabase } from '../lib/supabase';
import type { Review } from '../types';
import { logger } from './logger';
import { logAndThrow, isUniqueViolation } from './errors';

export interface SubmitReviewInput {
  jobId: string;
  technicianId: string;
  /** 1–5 star rating. */
  rating: number;
  /** Optional free-text review. */
  comment?: string;
}

export interface TechnicianReviewStats {
  /** Average rating across all of the technician's reviews (0 when none). */
  averageRating: number;
  /** Total number of reviews (== profiles.reviews_count). */
  reviewCount: number;
  /** Highest-rated review that includes written text, or null. */
  topReview: Review | null;
}

function mapDbReview(row: any): Review {
  return {
    id: row.id,
    jobId: row.job_id,
    customerId: row.customer_id,
    technicianId: row.technician_id,
    rating: row.rating,
    comment: row.comment ?? null,
    createdAt: row.created_at,
  };
}

/**
 * Submit a rating for a completed order.
 *
 * The current authenticated user is used as customer_id (enforced by RLS), so
 * callers never pass it — this both simplifies the call site and prevents a
 * customer from rating on behalf of someone else.
 *
 * @throws Error with a friendly message when:
 *   - the user is not signed in,
 *   - the rating is outside 1–5,
 *   - the order is not completed / not owned by the user (RLS rejects it),
 *   - a review already exists for this job (UNIQUE(job_id) → 23505).
 */
export async function submitReview(input: SubmitReviewInput): Promise<Review> {
  const rating = Math.round(input.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('Please choose a rating between 1 and 5 stars.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be signed in to leave a review.');
  }

  const comment = input.comment?.trim() ? input.comment.trim() : null;

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      job_id: input.jobId,
      customer_id: user.id,
      technician_id: input.technicianId,
      rating,
      comment,
    })
    .select('*')
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      // One review per job — the UNIQUE(job_id) index protects this.
      throw new Error('You have already reviewed this order. Thank you!');
    }
    logger.warn('[review.service] submitReview rejected', {
      code: (error as any)?.code,
      message: error.message,
    });
    throw new Error(
      'We could not save your review right now. Please try again.'
    );
  }

  if (!data) {
    throw new Error('We could not save your review right now. Please try again.');
  }

  // The DB trigger has already rolled the new rating into the technician's
  // profile.rating / reviews_count by the time this returns.
  return mapDbReview(data);
}

/**
 * All reviews for a technician, newest first.
 */
export async function fetchTechnicianReviews(
  technicianId: string
): Promise<Review[]> {
  if (!technicianId) return [];

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('technician_id', technicianId)
    .order('created_at', { ascending: false });

  if (error) logAndThrow('fetchTechnicianReviews', error);
  return (data || []).map(mapDbReview);
}

/**
 * The technician's "top" review — the highest-rated review that includes
 * written text. Ties are broken by recency. Returns null when the technician
 * has no written reviews yet.
 */
export async function fetchTopReview(
  technicianId: string
): Promise<Review | null> {
  if (!technicianId) return null;

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('technician_id', technicianId)
    .not('comment', 'is', null)
    .neq('comment', '')
    .order('rating', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) logAndThrow('fetchTopReview', error);
  return data ? mapDbReview(data) : null;
}

/**
 * The current user's own review for a given job, if one exists. Used to
 * prevent re-showing the rating form after a review has been submitted.
 */
export async function fetchReviewForJob(jobId: string): Promise<Review | null> {
  if (!jobId) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('job_id', jobId)
    .eq('customer_id', user.id)
    .maybeSingle();

  if (error) logAndThrow('fetchReviewForJob', error);
  return data ? mapDbReview(data) : null;
}

/**
 * Aggregate stats for a technician: average rating, total review count, and
 * the top written review. The average/count are read from the technician's
 * profile (maintained by the trigger) so they stay in lock-step with the
 * recommended-technician list; the top review is fetched separately.
 */
export async function fetchTechnicianStats(
  technicianId: string
): Promise<TechnicianReviewStats> {
  if (!technicianId) {
    return { averageRating: 0, reviewCount: 0, topReview: null };
  }

  const [topReview, profileRes] = await Promise.all([
    fetchTopReview(technicianId),
    supabase
      .from('profiles')
      .select('rating, reviews_count')
      .eq('id', technicianId)
      .maybeSingle(),
  ]);

  if (profileRes.error) logAndThrow('fetchTechnicianStats', profileRes.error);

  const rating = profileRes.data?.rating;
  const count = profileRes.data?.reviews_count;

  return {
    averageRating: typeof rating === 'number' ? rating : 0,
    reviewCount: typeof count === 'number' ? count : 0,
    topReview,
  };
}
