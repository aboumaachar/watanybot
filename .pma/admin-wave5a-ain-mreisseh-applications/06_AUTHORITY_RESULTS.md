# Authority Results

Persisted synthetic account: `w5a.superadmin@synthetic.local`, role `superadmin`, status `active`. Login returned HTTP 200 and role `superadmin` against the disposable local database.

Focused contract test passed unauthenticated list denial and authorized admin/superadmin reads. Public create validation remained available in the same contract suite.

`AIN_ADMIN_AUTHORITY=PASS`
`AIN_ADMIN_EFFECTIVE_ACCESS_REGRESSION=PROVEN_DURABLE`
`AIN_NEGATIVE_AUTH=PROVEN_BUT_NOT_DURABLE`
`PUBLIC_APPLICATION_SUBMISSION_REGRESSION=PROVEN_DURABLE`
