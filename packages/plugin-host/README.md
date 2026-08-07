# Watany Plugin Host Foundation

Purpose: provide a near-zero-recode plugin host layer so WatanyBot can use exportable and replaceable feature modules.

Rules:
- Host depends on contracts, not feature internals.
- V1 behavior must be preserved.
- Features are mounted only through manifests, adapters, feature flags, permissions, and smoke contracts.
- This foundation is intentionally lightweight and does not replace existing features.