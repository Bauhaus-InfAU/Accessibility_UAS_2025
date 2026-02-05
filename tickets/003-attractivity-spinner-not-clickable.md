# Ticket 003: Attractivity Input Spinner Arrows Not Clickable

| Field | Value |
|-------|-------|
| **Status** | Open |
| **Created** | 2025-02-05 |
| **Created by** | Claude |
| **Closed** | - |
| **Closed by** | - |

## Problem Description

When clicking on the attractivity number box on attractor pins to edit the value, the native browser spinner arrows (up/down buttons on `<input type="number">`) are not clickable. Clicking them does not change the value.

**Affected browsers**: Chrome, Edge (Chromium-based)

**Expected behavior**: Clicking the spinner up arrow should increment the value (e.g., 1 → 1.1), clicking down should decrement.

**Actual behavior**: Clicking the spinner arrows has no effect. The value does not change.

## Current Workarounds

Users can still edit the attractivity value by:
1. Clicking the number box to open the input
2. Typing a new value manually
3. Pressing Enter or clicking elsewhere to save

## Investigation Notes

- The input element is a standard `<input type="number" step="0.1" min="0">`
- No CSS is explicitly hiding or disabling the spinner (`::-webkit-inner-spin-button`)
- `stopPropagation()` was added to click/mousedown/mouseup events on the input to prevent interference - did not help
- The input is created dynamically inside a MapLibre marker element
- Playwright testing showed that programmatic `stepUp()` works, but actual mouse clicks on spinner don't register

## Potential Causes

1. **MapLibre marker event handling**: MapLibre markers may intercept or modify mouse events in a way that prevents native spinner behavior
2. **Event bubbling/capturing**: Something in the event chain may be preventing the spinner click from reaching the browser's native handler
3. **Pointer events**: There may be an invisible overlay or `pointer-events` issue
4. **Browser-specific behavior**: The spinner buttons may have special event handling that's being blocked

## Affected Files

- `src/components/map/MapView.tsx` - `createAttractorMarkerElement()` function (lines 51-140)
- `src/index.css` - `.att-input` styles (lines 68-77)

## Potential Solutions to Investigate

1. Create custom +/- buttons instead of relying on native spinner
2. Use a different input approach (e.g., slider, or buttons beside the input)
3. Investigate MapLibre marker event handling and see if there's a way to allow native input behavior
4. Test with input outside of MapLibre marker to confirm the issue is marker-related
5. Check if setting `pointer-events: auto` on specific pseudo-elements helps

## Related Changes Made

During investigation, the following improvements were made:
- Added flag `justFinishedEditingAttractivity` to prevent accidental pin creation when clicking away from input
- Added `stopPropagation()` on input click/mousedown/mouseup events
