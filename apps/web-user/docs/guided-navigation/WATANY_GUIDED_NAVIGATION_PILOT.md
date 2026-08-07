# Watany Guided Navigation Pilot

## Purpose

This is P2 from the deep feature graph / guided-help navigation plan.

It adds an opt-in navigation pilot only for:

- `/salary`
- `/procedures`
- `/school-grants`

## Hard Boundary

This package does not:

- install global click interception
- wrap `App`
- change React route declarations
- change server/API/database/deployment
- change salary logic
- change existing icon registries
- change package manifests
- enable broad guided pre-landing popups

## Files

- `src/features/guided-navigation/watanyGuidedNavigationPilot.ts`
- `src/features/guided-navigation/useWatanyGuidedNavigationPilot.ts`
- `src/features/guided-navigation/WatanyGuidedPilotLink.tsx`

## Usage Example

```tsx
import { WatanyGuidedPilotLink } from '../features/guided-navigation/WatanyGuidedPilotLink';

<WatanyGuidedPilotLink to="/salary" label="حاسبة المعاش">
  حاسبة المعاش
</WatanyGuidedPilotLink>
```

## Next Gate

P3 may add a pre-landing popup only for the three pilot routes after browser smoke proves:

- normal click works
- modified click still opens normally
- non-pilot route bypasses the pilot
- no global interception exists