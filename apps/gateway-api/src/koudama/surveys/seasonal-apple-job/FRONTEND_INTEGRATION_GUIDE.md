# Frontend Integration Guide

Replace v9.2 preview LocalStorage submit with backend API submit.

Public submit:

```ts
const response = await fetch('/api/koudama/surveys/seasonal-apple-job/applications', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    name,
    phone,
    email,
    age,
    gender,
    relationType,
    governorate,
    caza,
    village,
    villageId,
    availability,
    canArrive6am,
    hasAgriExperience,
    experienceText,
    canStandHours,
    healthNote,
    futureJobsInterest,
  }),
});

const result = await response.json();

if (result.ok) {
  showSuccess(`تم تسجيل الطلب بنجاح. رقم الطلب: ${result.applicationId}`);
}
```

Admin dashboard must read:

```text
GET /api/admin/koudama/surveys/seasonal-apple-job/applications
```

Admin updates:

```text
PATCH /api/admin/koudama/surveys/seasonal-apple-job/applications/:id
```

Allowed management fields:

```json
{
  "status": "accepted | waitlist | rejected | pending_review | withdrawn",
  "followUpStatus": "called | no_answer | confirmed | declined | needs_follow_up | not_contacted",
  "adminNotes": "..."
}
```