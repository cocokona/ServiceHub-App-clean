# Payment Management — Customer Profile (ServiceHub Pro)

## What changed
Moved credit-card / payment management into the customer's **Profile** and stored it in a
**private, tokenized** database table. Removed all pre-filled demo card data; new accounts
start with no payment data.

## Security decision (important)
Storing full card numbers (PAN) or CVV in our own database is a **PCI-DSS violation**. The
implementation therefore stores only a **tokenized record**: card brand, last 4 digits,
expiry, cardholder name, and a payment token. The full number and CVV are used only for
client-side validation and are never written to the database. Each row is private to its
owner via Supabase Row-Level Security (`profile_id = auth.uid()`).

## Files
- `supabase/migrations/00008_payment_methods.sql` (new) — `payment_methods` table + RLS +
  `NOTIFY pgrst` schema reload.
- `src/services/payment.service.ts` (new) — `getPaymentMethods`, `addPaymentMethod`,
  `deletePaymentMethod`, `setDefaultPaymentMethod` + pure validators
  (`detectCardBrand`, `luhnValid`, `formatCardNumber`, `normalizeExpiry`, `isExpiryValid`).
- `src/types/index.ts` — `CardBrand`, `SavedPaymentMethod`, `AddPaymentMethodInput`.
- `src/services/index.ts` — barrel exports for the payment service.
- `src/data/files/payment-methods.json` — removed the pre-filled `last4: "4242"` demo value.
- `src/screens/customer/CustomerHome.tsx` — Profile tab now has a **Payment Methods** card
  (list saved cards, Add-Card modal with empty fields, delete, set default).
- `src/screens/customer/Checkout.tsx` — Payment Method selector now reads the customer's
  saved cards from the DB; empty state links to Profile.

## Behavior
- All card input fields start **empty** (no defaults).
- New accounts have **no payment data** (table is empty, no seed).
- Adding a card validates Luhn + brand + expiry + CVV, then persists a tokenized row.
- Saved cards are selectable at checkout; management lives in the Profile.

## Verification
- `tsc --noEmit`: no errors in changed files (a pre-existing, unrelated `ScheduleDetails.tsx`
  error and `address.test.ts` failure exist from other in-progress work).
- `vitest run`: new `payment.service.test.ts` = **11/11 passing**; full suite 71 passing
  (the single unrelated `address.test.ts` failure predates this change).

## To deploy
Run migration `00008_payment_methods.sql` against the Supabase project, then rebuild the app.
For production, replace the local placeholder token with a real processor token (Stripe, etc.).
