Summary

- Fixed mismatched preview/download URLs for several school-aids items so they match frontend assets and public files.

Changes made

- Updated `apps/gateway-api/src/data/school-aids-required-items.ts` to use `.pdf` for `annex-z`, `annex-j`, and `school-year-completion-certificate` preview/download URLs.
- Added a basic unit test at `apps/gateway-api/src/data/__tests__/school-aids.spec.ts` verifying these items exist and their `previewUrl` ends with `.pdf` or `.html`.
- Added `test:school-aids` npm script to `apps/gateway-api/package.json` for quick test runs.

How to run locally

1. Run the single school-aids test:

```bash
pnpm --dir apps/gateway-api test:school-aids
```

2. Run all gateway tests:

```bash
pnpm --dir apps/gateway-api test
```

3. Start the gateway dev server:

```bash
pnpm --dir apps/gateway-api dev
```

4. Start the web frontend dev server:

```bash
pnpm --dir apps/web-user dev
```

Manual verification

- Open the web app (default Vite port, e.g. `http://localhost:5174`).
- Go to the School Grants page and try the preview and download actions for the following assets:
  - `/school-aids/forms/school-aid-application.html` (HTML form — should open in the universal viewer)
  - `/school-aids/forms/annex-z.pdf` (PDF — open/download)
  - `/school-aids/forms/annex-j.pdf` (PDF — open/download)
  - `/school-aids/forms/school-year-completion-certificate.pdf` (PDF — open/download)

Notes

- The universal viewer (`watanyUniversalFormViewer`) in the frontend displays HTML responses inline; PDFs will open in the browser or download depending on the browser's PDF handling.
- If you want a stricter test, I can add an API-level test asserting the `/api/school-aids/items` response contains the updated URLs.
