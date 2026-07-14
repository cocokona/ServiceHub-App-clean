# Phone Number Uniqueness Validation — Per-Role Group

**Feature:** A phone number must be unique **within each role group** — no two
customers may share a number, and no two technicians may share a number — while
a **customer and a technician are explicitly allowed to share the same number**.

**Defense in depth:** client-side pre-check (instant, friendly error) **and** a
database partial-unique-index backstop (authoritative, catches race conditions).

---

## Rule summary

| Scenario | Allowed? |
|---|---|
| Two customers share a number | ❌ Rejected |
| Two technicians share a number | ❌ Rejected |
| A customer and a technician share a number | ✅ Allowed (by design) |
| Empty / whitespace-only phone | ✅ Allowed — treated as "no phone on file" |
| User re-enters their own existing number | ✅ Allowed — self is excluded from the check |

---

## What changed

### 1. Database — `supabase/migrations/00018_phone_uniqueness_per_role.sql`
Two **partial unique indexes** on `profiles.phone`, one per role:
- `idx_profiles_customer_phone_unique` — `WHERE role='customer' AND deleted_at IS NULL AND phone IS NOT NULL AND phone <> ''`
- `idx_profiles_technician_phone_unique` — `WHERE role='technician' AND deleted_at IS NULL AND phone IS NOT NULL AND phone <> ''`

These enforce the rule inside Postgres: same-role duplicates are blocked,
cross-role overlap is permitted, and empty/null phones are excluded. A safety
guard raises an explicit, actionable error (listing the offending numbers) if
duplicate data already exists, and `NOTIFY pgrst` reloads the schema cache.

### 2. Pure validation helpers — `src/services/validation.ts`
- `normalizePhone(raw)` — trims + collapses internal whitespace; `''` for empty.
- `validatePhoneUniqueness(raw)` — empty/whitespace input is always valid with
  `normalized: ''` (so no network call is needed).
- `phoneUniquenessErrorMessage(role)` — `"This phone number is already used by
  other. Please enter a real phone number or cancel the last account first. If
  you meet a difficult, please feel free to find customer service."`
- Types `ProfileRole`, `PhoneUniquenessValidation`.

### 3. DB-backed check — `src/services/phone.service.ts`
- `checkPhoneUniquenessWithinRole({ phone, role, excludeProfileId })` — queries
  only the **same role**, excludes the caller's own id, and returns
  `{ isDuplicate, existingProfileId? }`. Empty input is never a duplicate; an
  unknown role or a lookup error **fails open** (the DB index remains the
  authoritative gate, so a transient failure can never block a valid save or
  corrupt data).

### 4. Wired into profile updates — `src/services/auth.service.ts` (`updateProfile`)
When `phone` is provided it is normalized then stored. If non-empty, the
current user's role is resolved and `checkPhoneUniquenessWithinRole` runs first;
a same-role duplicate returns the friendly error **before** any write. A DB
unique-violation (`23505`) from a concurrent write is also mapped to the same
role-aware message.

### 5. Barrel exports — `src/services/index.ts`
New functions/types re-exported for app-wide use.

---

## Edge cases handled
- **Empty / whitespace-only input** → not subject to the constraint; the
  pre-check short-circuits and no network call is made.
- **Cross-role overlap** → the per-role indexes and the scoped query mean a
  customer+technician sharing a number is fully permitted.
- **Self-update** → `excludeProfileId` ensures saving your own current number
  never trips the rule.
- **Concurrency / lookup failure** → the DB index is the authoritative backstop,
  and its `23505` is translated into the same friendly message.

---

## Tests
- `src/services/__tests__/phone.service.test.ts` (6) — same-role duplicate,
  self-excluded, cross-role allowed, empty input, error fail-open, unknown role.
- `src/services/__tests__/validation.test.ts` — normalize/validate/message + edge cases.
- `src/services/__tests__/auth.service.test.ts` — `updateProfile` blocks a
  same-role duplicate, allows cross-role overlap, allows clearing the phone, and
  maps a `23505` to the friendly message.

**Result:** full `src/services` suite — **127 tests passing**; `tsc --noEmit`
clean for `src/` (the unrelated `admin-dashboard` errors are pre-existing).

---

## Deployment note
Run migration `00018` against Supabase. The seed data contains no per-role
duplicate phones, so it applies cleanly. Any UI that already displays the
`error` returned by `updateProfile` will surface the new message automatically.
