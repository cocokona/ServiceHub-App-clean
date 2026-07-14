# Service Time Validation & Confirmation Flow

Implemented the time-validation + confirmation logic for the customer booking flow
(`ScheduleDetails` → "Continue to Payment"). All rules are data-driven and unit-tested.

## What changed

| File | Change |
|------|--------|
| `src/data/files/service-config.json` | Added `startHour` / `endHour` (24h) to each `timeSlot`: morning `8–12`, afternoon `12–17`, evening `17–21`. |
| `src/data/loader.ts` | Extended the `TimeSlot` interface with optional `startHour?` / `endHour?`. |
| `src/services/validation.ts` | New `validateServiceTime({ date, timeSlotKey, timeSlots, now? })` returning `{ status: 'ok' \| 'past' \| 'late-warning', message? }`. |
| `src/screens/customer/ScheduleDetails.tsx` | `handleNext` now runs `validateServiceTime` after the address check and handles all three outcomes. |
| `src/services/__tests__/validation.test.ts` | +10 tests (32 total in file, all passing). |

## Rule behavior

1. **Past-time block (general + "Today Morning")**
   A slot is judged "already passed" when the current time is **at or past its `endHour`**.
   So selecting *Today Morning* at 12:00 PM or later is blocked — exactly the required
   "afternoon → morning blocked" case — and the same logic blocks Afternoon after 5 PM
   and Evening after 9 PM. A window that is still partially open (e.g. 10 AM, Morning
   runs to noon) remains bookable. Future dates always pass.

2. **Late-afternoon warning**
   When it is **4:30 PM or later** AND the customer picked the **Afternoon** slot **for today**,
   tapping "Continue to Payment" shows a confirmation `Alert` with the exact required copy:
   *"The time may not be enough to provide service in the afternoon, are you sure you want to proceed?"*
   - **Yes** → proceeds to Checkout.
   - **No** → stays on the time-selection screen to choose again.

3. **General past-time validation**
   Any selection whose slot window has fully elapsed today (or a past calendar date) is a
   hard block: an `Alert` with a clear message is shown and navigation to Checkout is prevented.

## Design notes
- The "past" check is anchored to each slot's **`endHour`** (not its start) so Rule 1 and
  Rule 3 stay consistent: a slot is only rejected once the whole window is gone.
- `now` is injectable in `validateServiceTime` so the three rules are deterministically unit-tested.
- Validation lives in the shared `validation.ts` module (same home as the other order gates),
  so it can later be reused as a backstop in `Checkout` if needed.

## Verification
- `npx vitest run src/services/__tests__/validation.test.ts` → **32 passed** (10 new).
- `npx tsc --noEmit` → **no errors in `src/`** (the `admin-dashboard/` errors are pre-existing
  and unrelated to this change).
