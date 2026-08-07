# WatanyBot Engagement Award Hooks

Use the existing `engagementService` after the underlying action has genuinely
succeeded. Do not award points before persistence or verification succeeds.

## Procedure completion

```ts
await engagementService.awardPoints({
  userId,
  ruleCode: 'procedure_complete',
  sourceType: 'procedure',
  sourceId: procedureId,
  reasonAr: 'إكمال دليل المعاملة',
});
```

## Helpful community answer

Only moderators, accepted-answer logic, or a verified community event should
approve this rule because it requires verification.

```ts
await engagementService.awardPoints({
  userId: answerAuthorId,
  ruleCode: 'helpful_answer',
  sourceType: 'community_answer',
  sourceId: answerId,
  reasonAr: 'إجابة مفيدة وموثّقة',
  actorUserId: moderatorUserId,
  verificationApproved: true,
});
```

## Event or volunteer participation

Award after attendance or participation is verified, not at registration time.

```ts
await engagementService.awardPoints({
  userId,
  ruleCode: 'volunteer_activity',
  sourceType: 'volunteer_participation',
  sourceId: participationId,
  reasonAr: 'نشاط تطوعي موثّق',
  actorUserId: verifierUserId,
  verificationApproved: true,
});
```

## Required anti-abuse behavior

- Keep source identifiers stable.
- Never use page refreshes as source events.
- Do not manufacture a new source identifier to bypass idempotency.
- Verified rules require an authorized verifier.
- Administrative reversals must state a reason.