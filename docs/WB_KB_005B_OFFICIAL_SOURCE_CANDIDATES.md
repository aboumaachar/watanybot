# WB-KB-005B — official legal and administrative source candidate register
Date: 2026-10-16
Scope: **candidates only**. This file is intentionally outside data/official-sources and is NOT imported into the live KB index.

## Verified official page candidates (not approved as factual claims)

| Candidate | Official URL | What is actually established | What remains unverified |
| --- | --- | --- | --- |
| Ministry of Finance — pension documents guide | https://finance.gov.lb/ar-lb/Taxation/Pensioners/ | The ministry publishes a list of retirement-unit applications, document categories and form identifiers, including original and redistributed pensions. | Eligibility rules, monetary entitlements, jurisdiction-specific interpretation, statutory amendments, individual records |
| Lebanese Army — administrative transaction index | https://www.lebarmy.gov.lb/ar/administrative_transactions/45 | The Army publishes a discoverable list of administrative transactions including overdue school assistance. | Entitlement scope, changing deadlines, approval criteria and each listed form's effective edition |

These links were identified through public web retrieval on 2026-10-16. They should be separately reviewed by a legal/administrative subject expert before any paragraph is promoted into the closed-list source-checked claims.

## Required promotion gates
1. Capture the **exact official document**, its publication/effective date and version. A landing page is not necessarily binding legislation.
2. Record a narrowly scoped Arabic claim with a matching excerpt, document paragraph/page and verified URL. Do not infer broad benefit eligibility from an administrative form.
3. Have an independently authenticated institutional reviewer approve or reject, with immutable audit evidence and a second release authority as applicable.
4. Review changes, repeal/supersession and legal effective dates; protect the existing approved source. The local `official-source-human-review.ts` produces only an **audit candidate** and never publishes.
5. Keep the candidate outside the active KB until the authenticated workflow, content store and release gate are accepted.

## Current limitations
- No general military pension/allowance eligibility law was independently accepted during this milestone.
- No automatic official-page scheduler or authenticated reviewer API has been deployed.
- No actual network call from the new on-demand fetch module has been made; isolated mock-transport tests are the only runtime proof.
- The existing Python/chat-v2 answer generation path is **not** yet proven to enforce this claim ledger. Do not call its answers source-checked simply because links exist.
- Public Staging suspended; Production HOLD; F-01 and all previous denials remain blocked.
