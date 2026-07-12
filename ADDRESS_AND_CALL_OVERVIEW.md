# Address Consistency, Call Customer & Use Current Location

## What changed

### 1. Call Customer button (technician view)
`src/screens/technician/JobDetails.tsx`
- Added a prominent full-width **"Call Customer"** button directly under the customer information section.
- The existing call icon is now wired too. Both dial `job.customerPhone` via
  `Linking.openURL('tel:' + normalizePhoneForDial(...))`.
- When no number is present the button is disabled and a tap explains why.

### 2. Shared address model (single source of truth)
`src/services/address.ts` (new)
- `ADDRESS_FIELDS` — same 4 fields (`street*`, `apartment`, `city*`, `zipCode*`) used by **both** the customer profile form and the order address form.
- `validateAddressFields` — identical rules in both places: street + city + a 5-digit ZIP required; apartment optional.
- `formatAddress` — one consistent "Street, Apt, City, ZIP" display string.
- `profileToAddressFields` / `addressFieldsToProfile` — 1:1 mapping to the `profiles` and `jobs`/`order_in_progress` columns (`street→address`, `apartment`, `city`, `zipCode→zip_code`).

### 3. Profile storage surfaced
`src/types/index.ts` + `src/services/auth.service.ts`
- `User` gained `apartment?`, `city?`, `zipCode?`.
- `mapToUser` / `updateProfile` now read & write those columns. The `profiles`
  table already had them — **no new DB migration required**.

### 4. Customer profile form uses the shared model
`src/screens/customer/CustomerHome.tsx`
- Profile edit renders the 4 address inputs from `ADDRESS_FIELDS`, validates with `validateAddressFields`, and saves structured address.
- Profile display uses `formatAddress`.

### 5. Order address form — starts empty, two valid address sources
`src/screens/customer/ScheduleDetails.tsx`
- Address inputs render from the same `ADDRESS_FIELDS` and validate with `validateAddressFields`.
- **Fields start empty on load** — nothing is pre-filled.
- The service address can only be populated from one of two accepted sources:
  - **Use My Saved Address** — copies the customer's structured profile address.
  - **Use Current Location** — resolves the device's live GPS position and reverse-geocodes it into the fields.
- The old **"Use Sample Location"** demo option (and its `currentLocationDemo` data) has been removed entirely.

## Consistency guarantee
Both forms import the SAME `ADDRESS_FIELDS`, `validateAddressFields`, and `formatAddress`.
A unit test (`src/services/__tests__/address.test.ts`) asserts the field keys map
1:1 to the database columns and that required-flag rules are identical across
both forms, so the two can never drift.

## Verification
- `npx tsc --noEmit` — 0 errors
- `npx vitest run` — 72/72 passing (incl. 7 new address tests)

## Files touched
- `src/services/address.ts` (new), `src/services/__tests__/address.test.ts` (new)
- `src/services/auth.service.ts`, `src/services/index.ts`, `src/types/index.ts`
- `src/screens/customer/CustomerHome.tsx`, `src/screens/customer/ScheduleDetails.tsx`
- `src/screens/technician/JobDetails.tsx`
