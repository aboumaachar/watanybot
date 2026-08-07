# Dataset Versioning Policy

Versions are immutable. A changed canonical row, alias mapping, hierarchy relationship, source record, or manifest requires a new dataset version and new hashes.

The release manifest records schema version, dataset version, release date, approval decision, source provenance, statistics, and canonical/alias SHA-256 hashes. Consumers pin a released manifest rather than reading mutable source files.
