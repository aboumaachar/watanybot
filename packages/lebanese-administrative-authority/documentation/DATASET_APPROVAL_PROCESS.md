# Dataset Approval Process

`UL2_STATUS=BLOCKED` until every gate below is evidenced.

1. Collect authoritative source records and preserve retrieval metadata.
2. Normalize records into the UL2 schema without creating geography in an application.
3. Validate stable IDs, Arabic names, hierarchy, coordinates, aliases, provenance, duplicates, and orphans.
4. Obtain named approval with decision reference and approval timestamp.
5. Freeze canonical and alias bytes, calculate SHA-256 hashes, and publish the manifest.
6. Run runtime, consumer, browser, Git, and acceptance audits.

A candidate dataset is never a runtime fallback and cannot be labeled released.
