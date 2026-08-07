# Mount Guide — Seasonal Apple Job Survey Backend

This module exports:

```ts
import { seasonalAppleJobRouter } from './koudama/surveys/seasonal-apple-job';
```

Mount it in the existing gateway Express app:

```ts
app.use(seasonalAppleJobRouter);
```

Expected public endpoint:

```text
POST /api/koudama/surveys/seasonal-apple-job/applications
```

Expected admin endpoints:

```text
GET   /api/admin/koudama/surveys/seasonal-apple-job/applications
GET   /api/admin/koudama/surveys/seasonal-apple-job/applications/:id
PATCH /api/admin/koudama/surveys/seasonal-apple-job/applications/:id
GET   /api/admin/koudama/surveys/seasonal-apple-job/export.csv
```

Security requirement before production:
Admin routes must be protected by the existing admin/superadmin auth middleware.
Do not leave admin endpoints public in production.