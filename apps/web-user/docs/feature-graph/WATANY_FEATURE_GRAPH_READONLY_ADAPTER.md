# Watany Feature Graph Readonly Adapter

## Purpose

This is P1 from the deep feature graph / guided-help navigation plan.

The adapter creates a normalized, read-only feature graph without changing runtime navigation or UI behavior.

## Created Files

- `src/features/feature-graph/watanyFeatureGraph.ts`
- `src/features/feature-graph/watanyFeatureGraph.readonly.ts`

## Hard Boundary

This package does not:

- wrap `App`
- intercept clicks
- replace existing registries
- change routes
- change icons
- change layout/theme/CSS
- change package manifests
- enable guided-help popups

## Canonical Route Notes

World Cup aliases normalize to `/mcp/world-cup`:

- `/world-cup`
- `/worldcup`
- `/mcp/worldcup`

## P2/P3 Gate

Only after this adapter passes should the next package add an opt-in navigation pilot for:

- `/salary`
- `/procedures`
- `/school-grants`

No global pre-landing provider should be applied before that pilot passes browser smoke evidence.