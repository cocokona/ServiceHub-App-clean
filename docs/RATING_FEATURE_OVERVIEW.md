# Customer Rating & Review Feature

**Added:** 2026-07-10
**Scope:** Post-completion star rating + optional text review, real-time technician
aggregate updates, and a "top review" surface on the customer home page.

## What changed

### Database (`supabase/migrations/00010_reviews_rating_recalculation_fix.sql`)
- Hardened the `recalculate_technician_rating` trigger (installed by `00001`).
  The original only read `NEW.technician_id`, which is `NULL` on `DELETE`, so
  deleting a review left the technician's rating stale. The new version uses
  `OLD.technician_id` on delete and recomputes both technicians when a review is
  reassigned, via a shared `recompute_tech_rating(p_tech_id)` helper.
- Added an index `idx_reviews_tech_rating_text` to back the "top review" query
  (highest-rated written review) efficiently.
- Trigger still rolls `AVG(rating)` → `profiles.rating` and `COUNT(*)` →
  `profiles.reviews_count` **synchronously on INSERT** — so a technician's
  profile reflects a new rating immediately after submission.

### Service layer
- **`src/services/review.service.ts`** (new): `submitReview`, `fetchTechnicianReviews`,
  `fetchTopReview` (highest-rated text review), `fetchReviewForJob` (prevents
  double-submission), `fetchTechnicianStats`. `submitReview` anchors `customer_id`
  to the authenticated user (RLS-enforced) and maps a `23505` unique violation to a
  friendly "already reviewed" message.
- **`src/services/database.service.ts`**: removed the now-relocated `createReview`;
  added `fetchTechnicianById` for the live tracking-card stats.
- **`src/services/errors.ts`**: added `isUniqueViolation` (SQLSTATE 23505).
- **`src/types/index.ts`**: added `Review`; extended `Technician` with optional
  `topReview` / `topReviewRating`.

### UI
- **`Tracking.tsx`**: the technician card now shows the technician's **live**
  rating/review count (was a hardcoded default). After an order reaches
  `completed`, a rating card appears with a 1–5 star selector + optional text
  field. On submit it calls `submitReview`, refreshes the live stats, and shows a
  confirmation. If the customer already reviewed the job, the form is pre-filled
  and locked.
- **`CustomerHome.tsx`**: the Recommended section fetches each technician's
  highest-rated written review and displays it (quote style) alongside the
  average rating and review count. It refetches whenever the Home tab becomes
  active, so a review submitted on the tracking screen is reflected here
  immediately on return.

## How "real time" is guaranteed
1. `submitReview` INSERT → DB trigger recomputes `profiles.rating` / `reviews_count`
   in the same transaction → `fetchTechnicianById` (called right after) returns
   updated aggregates.
2. Returning to the Home tab re-runs `loadRecommended`, pulling fresh rating,
   count, and top review from the DB.

## Tests
- `src/services/__tests__/review.service.test.ts` (8 cases): validation, RLS
  customer anchoring, blank-comment trimming, unique-violation mapping, top-review
  ordering, and aggregate stats.
- Full suite: **90 passed**, `tsc --noEmit` clean.

## Notes / follow-ups
- Reviews require an authenticated session + a `completed` job owned by the
  customer (enforced by RLS), so submission is online-only. Offline queueing of
  reviews could be added later via the existing sync-queue if needed.
- When online, Recommended shows real `0 / 0` until customers leave reviews; when
  offline it falls back to the seeded mock technicians.
