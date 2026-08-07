# APEX UL2A-AR V1.1.0 Failure and Regression Register

## APEX_UL2A_AR_EXPECTED_OWNER_REVIEW_EXIT_CODE_MISCLASSIFIED_AS_FAILURE

Owner review is a workflow state. A technically valid release with `ready-for-owner-review` must not be reported as a process failure.

## APEX_UL2A_AR_TECHNICAL_GATE_PASS_NOT_SEPARATED_FROM_APPROVAL_GATE

Technical validation, owner approval, production authorization, and process execution are independent status dimensions.

## APEX_UL2A_AR_DIRTY_WORKTREE_CONFUSED_WITH_GIT_DIFF_CHECK_FAILURE

`git status` may report a dirty worktree while `git diff --check` passes. These checks must be captured and classified separately.

## APEX_UL2A_AR_PARTIAL_MUTATION_WITH_BLOCKED_CLOSEOUT_DEFECT

Generated evidence and authority artifacts may exist even when closeout fails. The next controller must report the mutation boundary and preserve both pre- and post-execution repository snapshots.