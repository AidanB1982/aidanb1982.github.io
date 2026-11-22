# Sgeul author induction — live security checkpoint

**Read-only assessment, 22 November 2026**, project Blackwood Publishing
Members Access. This is a source/metadata and automated test audit,
not penetration testing and not proof of a complete production pilot.

## Feature-specific checks

- Both Sgeul induction tables exist and both have RLS enabled.
- Both carry four relevant policies: one owner/approval or admin rule
  per operation in the staged foundation.
- The authenticated role has narrowly scoped INSERT/UPDATE columns:
  an ordinary applicant cannot edit review timestamps, reviewer IDs
  or private profile ownership.
- Anonymous database access is revoked on both new tables.
- The induction review trigger is enabled and its function is
  SECURITY INVOKER, not SECURITY DEFINER; direct EXECUTE is revoked
  from anon and authenticated.
- The read-only preflight
  \`supabase/diagnostics/sgeul-author-induction-preflight.sql\` returned
  **14 of 14 checks passing** on 22 November 2026, with zero
  applications and zero private profiles.
- Local automated role tests additionally cover applicant isolation,
  refusal of self-approval, approved author draft creation, suspension
  and anonymous denial. These tests do **not** replace real Supabase
  Auth test-session verification on development data.

## Existing security adviser findings — separate remediation review

Supabase Security Advisor still identifies pre-existing findings
elsewhere in the Blackwood project as of 22 November 2026:

| Finding | Reported count | Next action |
| --- | ---: | --- |
| \`function_search_path_mutable\` | 5 | Verify/set safe search paths on relevant functions after checking dependencies |
| \`anon_security_definer_function_executable\` | 11 | Examine whether each RPC should be callable anonymously; revoke or refactor only with regression tests |
| \`authenticated_security_definer_function_executable\` | 34 | Review caller authorisation and least privilege, do not bulk-revoke functions used by the reader/ARC flows |
| \`auth_leaked_password_protection\` | 1 | Review current Supabase Auth password protection setting |
| \`rls_enabled_no_policy\` | 26 (INFO) | Verify these are intentionally service-role-only tables; lack of policy may be correct |

A warning does not by itself prove a security breach. Several existing
functions support reading/ARC/member flows, so blanket REVOKE statements
could break live services. Review call sites, required privileges,
function body authorisation and existing regression tests before
changing permissions. Do not silently apply security fixes via a
separate author-induction feature.

Security adviser findings are listed for the **whole project**, not
necessarily the new Sgeul induction tables; no new feature-specific
adviser warning was identified from the Sgeul function in this read.

## Open pilot gates

- A suitable privacy / retention policy with an operational withdrawal
  and deletion process has not yet been approved.
- No test author accounts, JWTs or application requests were created
  or altered during this assessment.
- Existing app gate is FALSE; the new app build has not been
  released to Google Play.
- Public author profiles and book upload / finance integrations remain
  out of scope.
