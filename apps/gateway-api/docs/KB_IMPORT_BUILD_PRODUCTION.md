# WatanyBot Feature 01 KB Import/Build Production Pipeline

## Purpose

This module turns raw server-side imports into reviewed KB drafts and published KB JSONL evidence.

Pipeline:

```txt
Admin import/upload
-> quarantine/storage
-> extraction/OCR bridge
-> source/category classification
-> KB facts/chunks/citations
-> admin review
-> publish to KB JSONL
-> future RAG/chat integration
```

## Routes created

```txt
GET  /api/admin/kb-import/health
GET  /api/admin/kb-import/jobs
GET  /api/admin/kb-import/jobs/:jobId
POST /api/admin/kb-import/raw
POST /api/admin/kb-import/upload
POST /api/admin/kb-import/jobs/:jobId/process
POST /api/admin/kb-import/jobs/:jobId/approve
POST /api/admin/kb-import/jobs/:jobId/reject
POST /api/admin/kb-import/jobs/:jobId/publish
```

## Important production gates

1. Register the route plugin in the gateway bootstrap.
2. Register @fastify/multipart before enabling binary uploads.
3. Install Tesseract and ara/eng traineddata for image OCR.
4. Install Poppler/pdftotext for PDF extraction or add a PDF OCR worker.
5. Keep admin review mandatory for recruitment/tatwee3 and payment-sensitive sources.
6. Do not expose raw uploaded files publicly.
7. Treat generated facts as draft evidence until approved.

## Storage

Default storage root:

```txt
data/kb-import
```

Override with:

```txt
KB_IMPORT_DATA_DIR=/secure/server/path/kb-import
KB_IMPORT_OCR_LANGS=ara+eng
```

## Recruitment/tatwee3 rule

Recruitment announcements are mapped to `recruitment_announcements`, not civilian jobs/job search.