# Calendar Feature Audit — Bugs & Regressions

## File Responsibilities (1-line each)

1. **src/app/(dashboard)/calendario/page.tsx** — Server component fetching meetings, availability, calendar token for current month; renders WeekCalendar with data.
2. **src/app/(dashboard)/calendario/week-calendar.tsx** — Client component rendering 6-week grid; displays meetings, availability, slug editor, cancel dialogs; uses `todayInBrazil()` for highlighting.
3. **src/app/(dashboard)/calendario/availability-dialog.tsx** — Modal form to set working hours per weekday; validates endTime > startTime client-side; calls `saveAvailabilityAction`.
4. **src/app/(dashboard)/calendario/actions.ts** — Server actions: save availability (atomic transaction), cancel meeting (single/series), update calendar slug, get-or-create token.
5. **src/lib/meeting-recurrence.ts** — Timezone helpers (hardcoded `America/Sao_Paulo`), monthly recurrence rule generation, date formatting (YYYY-MM-DD).
6. **prisma/schema.prisma** — DB schema: User (calendarToken, calendarSlug unique), CalendarAvailability (dayOfWeek 0-6, times), Meeting (userId, date string, recurrenceRule JSON, recurrenceParentId FK).

---

## CRITICAL BUGS

### 1. Timezone Mismatch (week-calendar.tsx, ~line 140)

**Issue:** After Haiku's modification, `todayStr = toDateStr(new Date())` uses **local client time**, not Brazil timezone.

```javascript
// BROKEN — uses client's local time, not Brazil time
const todayStr = toDateStr(new Date());  

// CORRECT — should be:
const todayStr = todayInBrazil();
```

**Impact:**
- "Today" highlight appears on wrong calendar date if user's browser is outside America/Sao_Paulo TZ.
- Consistency broken: server queries use Brazil TZ, client highlighting uses client TZ.
- Regression: code imported `todayInBrazil` at top but doesn't use it.

---

### 2. Missing/Incomplete Function (actions.ts, line ~100+)

**Issue:** `getOrCreateCalendarToken()` function is truncated or missing in audit. 

- `page.tsx` calls it (line ~62) but implementation incomplete.
- **Type risk:** If return type missing, TypeScript infers `Promise<unknown>` instead of `Promise<string>`.

**Impact:**
- Type safety broken on `calendarToken` in page.tsx.
- Potential runtime error if function doesn't return string as expected.

---

## MODERATE SEVERITY

### 3. String Date Filtering Without Validation (actions.ts, line 82)

**Issue:** Recurrence cancellation uses unvalidated string comparison:

```typescript
const today = todayInBrazil();  // "2026-05-12"
date: { gte: today },  // string comparison works only if format is correct
```

Works for YYYY-MM-DD but:
- No validation that `todayInBrazil()` returns correct format.
- If `todayInBrazil()` breaks, series cancellation silently fails.
- Schema stores `date` as `VarChar(10)` (string), not Date type.

**Impact:** Silent failure if timezone helper breaks.

---

### 4. Client-Only Validation (availability-dialog.tsx, line ~53)

**Issue:** endTime > startTime validation is **client-side only**.

```typescript
.filter(([, cfg]) => cfg.enabled && cfg.endTime <= cfg.startTime)
```

**Missing:**
- No server-side validation in `saveAvailabilityAction()` (line 16).
- No schema constraints in Prisma (CalendarAvailability allows any string).

**Impact:**
- User can POST invalid times via API bypassing client validation.
- Invalid times corrupt availability; booking system may fail silently.

---

## MINOR ISSUES

### 5. Duplicate `toDateStr()` Function (3 locations)

Reimplemented identically in:
- `page.tsx` (server)
- `week-calendar.tsx` (client)
- Missing from exported utilities

**Impact:** Code duplication, maintenance risk, DRY violation.

---

### 6. Unused Import (week-calendar.tsx, line ~3)

```typescript
import { ..., Repeat } from "lucide-react";
```

`Repeat` imported but never used. Dead code.

---

### 7. Modal State Persists on Close (availability-dialog.tsx)

**Issue:** Closing dialog without saving doesn't reset state. Reopening shows previous unsaved edits.

**Impact:** UX confusing but not data-breaking; changes only persist on explicit "Save".

---

### 8. No dayOfWeek Validation (schema.prisma, CalendarAvailability)

**Issue:**
- `dayOfWeek Int` has no constraint (should be 0-6).
- No database CHECK constraint.
- No Prisma enum validation.

**Impact:** Invalid dayOfWeek values (7, -1, etc.) can be inserted.

---

## TypeScript Compile Issues

1. **page.tsx:62** — `calendarToken` type unknown if `getOrCreateCalendarToken()` return type missing.
   - Run `npx tsc --noEmit` to verify.

2. **Type fragmentation** — `Meeting` and `Availability` types locally declared in week-calendar.tsx; should be shared from `actions.ts` to prevent drift.

---

## Schema Inconsistencies

**CalendarAvailability vs availability-dialog.tsx:**
- Both correctly use `dayOfWeek: 0=Sunday, 1=Monday...6=Saturday`.
- Dialog renders Mon-Sat then Sunday; confusing but correct.
- Missing Prisma enum: `enum DayOfWeek { SUNDAY MONDAY ... SATURDAY }`.

---

## Quick Diagnostic Checklist

- [ ] Run `npx tsc --noEmit` — check for return type inference errors
- [ ] Verify `getOrCreateCalendarToken()` function is complete and typed
- [ ] Test "today" highlight in non-Brazil timezone (should show correct day)
- [ ] Try POSTing invalid availability via curl (should fail server-side in fix)
- [ ] Check week-calendar.tsx imports — is `Repeat` used?
