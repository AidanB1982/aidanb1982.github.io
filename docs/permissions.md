# Blackwood Publishing — Author Desk Permissions Model

**Version:** 1.0  
**Status:** Architecture Draft  
**Date:** September 2026  
**System:** Blackwood Author Desk  
**Companion Document:** `docs/data-model.md`

---

# 1. Purpose

This document defines the access and permission model for the Blackwood
Publishing Author Desk.

It establishes:

- who may access Author Desk records;
- which records an author may see;
- which records an author may change;
- which records Blackwood controls;
- which operations are reserved for trusted server-side processes;
- which records become historical or immutable;
- the security boundaries that must later be enforced through database Row
  Level Security and server-side authorisation.

This document describes intended permissions.

It does not yet contain SQL policies.

---

# 2. Governing Principle

The Author Desk is a private publishing system.

Access must follow the principle of least privilege.

A user should receive only the permissions required for their role and their
own publishing relationship.

The interface is not a security boundary.

Hiding a button, menu item, page or field does not prevent access.

Permissions must ultimately be enforced at database, storage and server level.

---

# 3. Primary Roles

Author Desk v1 recognises three primary access classes:

1. Author
2. Blackwood Administrator
3. Trusted System / Service Role

These are permission classes rather than public-facing titles.

Additional roles may be introduced later where there is a demonstrated need.

---

# 4. Author

An Author is an authenticated user who has been explicitly linked to a
Blackwood Author Record.

Authentication alone does not create Author access.

An Archivist account does not automatically create Author access.

ARC Team membership does not automatically create Author access.

A submissions applicant does not automatically create Author access.

Author access must be explicitly granted through the publishing relationship.

---

# 5. Blackwood Administrator

A Blackwood Administrator is an authenticated user explicitly authorised to
manage Author Desk publishing records.

Administrator access must not be inferred from:

- being an Author;
- being an Archivist;
- ARC Team membership;
- knowing an administrative URL;
- client-side JavaScript;
- email address alone.

Administrator privileges must be represented and enforced through trusted
authorisation data.

---

# 6. Trusted System / Service Role

The Trusted System / Service Role represents server-side processes that require
privileged access.

Examples may eventually include:

- document delivery;
- statement generation;
- financial reconciliation;
- audit event creation;
- payment processing;
- scheduled publishing operations;
- administrative Edge Functions.

Service credentials must never be exposed to browser-side JavaScript.

The service role is not a human user account.

---

# 7. Separation from Existing Blackwood Roles

The Author Desk is a separate permission domain from the existing reader and
ARC systems.

A single authenticated person may occupy several roles.

Example:

USER ACCOUNT
  |
  +-- Archivist
  |
  +-- ARC Reader
  |
  +-- Author

These relationships may share authentication identity while retaining separate
authorisation.

The following implications must never be assumed:

Archivist -> Author

ARC Reader -> Author

Author -> Administrator

Administrator -> Author ownership

Public account -> Author Desk access

Each permission must be granted independently.

---

# 8. Authentication and Authorisation

Authentication answers:

"Who is this user?"

Authorisation answers:

"What is this user permitted to access?"

The Author Desk must treat these as separate questions.

A valid authenticated session is necessary but not sufficient for Author Desk
access.

The system must additionally establish:

- whether the user has an Author Record;
- whether the relationship permits Author Desk access;
- which Book Records belong to that author;
- which related records are author-visible;
- whether any requested operation is permitted.

---

# 9. Ownership Chain

The principal author access chain is:

AUTHENTICATED USER
        |
        +-- AUTHOR RECORD
                |
                +-- AUTHOR RELATIONSHIP
                        |
                        +-- BOOK RECORD
                                |
                                +-- EDITIONS
                                +-- PRODUCTION
                                +-- ACTIONS
                                +-- DOCUMENTS
                                +-- AGREEMENTS
                                +-- RIGHTS
                                +-- ROYALTIES
                                +-- STATEMENTS
                                +-- PAYMENTS

Where a record is associated with a Book Record, author access should normally
be established through ownership of that Book Record.

The browser must not be trusted to declare ownership.

---

# 10. Default-Deny Principle

Author Desk permissions should operate on a default-deny basis.

If a permission has not been deliberately granted, access should be denied.

New tables must not automatically become author-readable merely because they
are part of the Author Desk schema.

New storage locations must not automatically become downloadable.

New administrative functions must not automatically become callable by every
authenticated user.

---

# 11. Permission Operations

This document uses the following operations:

READ
View an existing record.

CREATE
Create a new record.

UPDATE
Change an existing record.

DELETE
Permanently remove a record.

DOWNLOAD
Receive access to a private stored file.

REQUEST
Ask Blackwood or a trusted process to perform an action.

ADMINISTER
Perform privileged publishing administration.

---

# 12. Permission Levels

The following shorthand is used in the matrices below.

YES
The role may perform the operation where ownership and other relevant
conditions are satisfied.

LIMITED
The role may perform the operation only on approved fields or through a
specific workflow.

NO
The role must not perform the operation directly.

SYSTEM
The operation is reserved for a trusted server-side process.

---

# 13. Author Record Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own Author Record | YES | YES | YES |
| Read another author's record | NO | YES | SYSTEM |
| Create Author Record | NO | YES | SYSTEM |
| Update contact details | LIMITED | YES | SYSTEM |
| Update publishing relationship status | NO | YES | SYSTEM |
| Update internal notes | NO | YES | SYSTEM |
| Delete Author Record | NO | LIMITED | SYSTEM |

Author-editable fields may eventually include:

- preferred name;
- telephone;
- correspondence address;
- selected contact information.

Author-controlled updates must not include:

- internal author ID;
- account ownership;
- relationship status;
- administrative flags;
- internal Blackwood notes;
- financial verification status;
- administrator permissions.

---

# 14. Author Relationship Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own relationship summary | YES | YES | YES |
| Read internal relationship notes | NO | YES | SYSTEM |
| Create relationship | NO | YES | SYSTEM |
| Change relationship status | NO | YES | SYSTEM |
| End relationship | NO | YES | SYSTEM |
| Delete relationship history | NO | NO/LIMITED | SYSTEM |

An author may be informed of the state of their publishing relationship without
being given control over the administrative record that establishes it.

---

# 15. Book Record Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own Book Records | YES | YES | YES |
| Read another author's Book Records | NO | YES | SYSTEM |
| Create Book Record | NO | YES | SYSTEM |
| Change core book metadata | NO/LIMITED | YES | SYSTEM |
| Change production state | NO | YES | SYSTEM |
| Archive Book Record | NO | YES | SYSTEM |
| Delete established Book Record | NO | LIMITED | SYSTEM |

The author may eventually be invited to propose or confirm certain metadata.

That does not make the Book Record generally author-editable.

---

# 16. Edition Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own edition records | YES | YES | YES |
| Create edition | NO | YES | SYSTEM |
| Change ISBN | NO | YES | SYSTEM |
| Change publication date | NO | YES | SYSTEM |
| Change format | NO | YES | SYSTEM |
| Change distribution status | NO | YES | SYSTEM |
| Delete established edition | NO | LIMITED | SYSTEM |

ISBNs and established edition identities should be treated as controlled
publishing metadata.

---

# 17. Production Current-State Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read current production stage | YES | YES | YES |
| Read next milestone | YES | YES | YES |
| Read author-facing production note | YES | YES | YES |
| Read internal production note | NO | YES | SYSTEM |
| Change current stage | NO | YES | SYSTEM |
| Change next milestone | NO | YES | SYSTEM |
| Change internal production notes | NO | YES | SYSTEM |

The author should always be able to understand:

- where the book is now;
- what happens next;
- whether anything is required from them.

This does not require granting the author control over production state.

---

# 18. Production History Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read author-visible history | YES | YES | YES |
| Read internal history | NO | YES | SYSTEM |
| Create stage-history event | NO | YES | SYSTEM |
| Edit established history | NO | LIMITED | SYSTEM |
| Delete established history | NO | NO/LIMITED | SYSTEM |

Production history should normally be append-only.

Corrections should preserve an audit trail rather than silently rewriting
publishing history.

---

# 19. Author Action Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own required actions | YES | YES | YES |
| Create author action | NO | YES | SYSTEM |
| Complete eligible author action | LIMITED | YES | SYSTEM |
| Cancel action | NO | YES | SYSTEM |
| Change action deadline | NO | YES | SYSTEM |
| Delete completed action | NO | NO/LIMITED | SYSTEM |

An author may complete an action where the action type explicitly supports
author completion.

Examples:

- confirm review;
- acknowledge file;
- submit requested information;
- complete an approved workflow.

Completion permission must not imply permission to alter the underlying
publishing record.

---

# 20. Document Metadata Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read author-visible document metadata | YES | YES | YES |
| Read internal document metadata | NO | YES | SYSTEM |
| Create document record | NO | YES | SYSTEM |
| Change document visibility | NO | YES | SYSTEM |
| Replace signed document silently | NO | NO | NO |
| Archive/supersede document | NO | YES | SYSTEM |

Document metadata and document file access are separate permissions.

Seeing that a document exists does not automatically mean the underlying file
should be publicly accessible.

---

# 21. Private Document Download Permissions

Private publishing files must not use permanently public download URLs.

The intended flow is:

AUTHOR REQUESTS FILE
        |
        +-- authenticate user
        |
        +-- verify Author Record
        |
        +-- verify Book Record ownership
        |
        +-- verify document is author-visible
        |
        +-- verify file access is permitted
        |
        +-- issue temporary access

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Download own author-visible document | YES | YES | SYSTEM |
| Download internal-only document | NO | YES | SYSTEM |
| Download another author's document | NO | YES | SYSTEM |
| Generate unrestricted public URL | NO | NO | NO |
| Generate temporary authorised access | REQUEST | YES | SYSTEM |

---

# 22. Agreements Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own agreement summary | YES | YES | YES |
| Download own signed agreement | YES | YES | SYSTEM |
| Read internal agreement notes | NO | YES | SYSTEM |
| Create agreement record | NO | YES | SYSTEM |
| Change editable draft information | NO | YES | SYSTEM |
| Alter signed agreement file | NO | NO | NO |
| Add amendment | NO | YES | SYSTEM |
| Mark agreement expired/superseded | NO | YES | SYSTEM |
| Delete signed agreement history | NO | NO | NO |

A signed agreement is a historical legal record.

If contractual terms change, the system should preserve the original agreement
and link the appropriate amendment or replacement agreement.

---

# 23. Rights Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own author-facing rights summary | YES | YES | YES |
| Read internal rights notes | NO | YES | SYSTEM |
| Create rights record | NO | YES | SYSTEM |
| Alter rights grant | NO | YES | SYSTEM |
| Record rights reversion | NO | YES | SYSTEM |
| Record sublicence activity | NO | YES | SYSTEM |
| Delete historical rights event | NO | NO/LIMITED | SYSTEM |

The Author Desk may display a plain-English rights summary.

The signed agreement remains authoritative.

The system must not allow an author or ordinary client-side request to grant,
expand, remove or transfer contractual rights.

---

# 24. Rights History Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read author-visible rights events | YES | YES | YES |
| Read internal rights events | NO | YES | SYSTEM |
| Create rights event | NO | YES | SYSTEM |
| Modify historical rights event | NO | LIMITED | SYSTEM |
| Delete historical rights event | NO | NO/LIMITED | SYSTEM |

Rights history should normally be append-only.

---

# 25. Source Financial Data Permissions

Source financial information may include distributor reports, imported sales
records and unreconciled receipts.

This information is operational accounting data.

It is not automatically author-facing.

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read unreconciled source data | NO | YES | SYSTEM |
| Import source data | NO | YES | SYSTEM |
| Reconcile source data | NO | YES | SYSTEM |
| Change reconciliation state | NO | YES | SYSTEM |
| Delete established financial import | NO | LIMITED | SYSTEM |

The author-facing royalty balance must not be calculated directly from
unreconciled source information.

---

# 26. Cleared Royalty Ledger Permissions

Only confirmed cleared royalty information should be exposed as payable author
income.

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own cleared royalty entries | YES | YES | YES |
| Read another author's entries | NO | YES | SYSTEM |
| Create royalty entry | NO | YES/LIMITED | SYSTEM |
| Change financial value after clearance | NO | LIMITED | SYSTEM |
| Delete cleared royalty entry | NO | NO/LIMITED | SYSTEM |
| Create adjustment | NO | YES | SYSTEM |

Authors must never be able to create or alter their own payable royalty
balance.

---

# 27. Royalty Adjustment Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own author-visible adjustment | YES | YES | YES |
| Create adjustment | NO | YES | SYSTEM |
| Change issued adjustment | NO | LIMITED | SYSTEM |
| Delete established adjustment | NO | NO/LIMITED | SYSTEM |

Corrections should be represented as adjustments rather than silent changes to
historical financial records.

---

# 28. Advance Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own advance record | YES | YES | YES |
| Create advance record | NO | YES | SYSTEM |
| Change contractual advance amount | NO | LIMITED | SYSTEM |
| Record advance payment | NO | YES | SYSTEM |
| Record recoupment | NO | YES/LIMITED | SYSTEM |
| Delete established advance | NO | NO/LIMITED | SYSTEM |

Advance information must remain linked to the relevant agreement and Book
Record.

---

# 29. Royalty Statement Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own issued statement | YES | YES | YES |
| Download own issued statement | YES | YES | SYSTEM |
| Read statement being prepared | NO | YES | SYSTEM |
| Create statement | NO | YES | SYSTEM |
| Issue statement | NO | YES | SYSTEM |
| Alter issued statement silently | NO | NO | NO |
| Correct/supersede statement | NO | YES | SYSTEM |
| Delete issued statement | NO | NO | NO |

A statement being prepared is not yet an issued author document.

Once issued, its values should become controlled historical data.

---

# 30. Statement Line Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read lines of own issued statement | YES | YES | YES |
| Read draft statement lines | NO | YES | SYSTEM |
| Create statement lines | NO | YES | SYSTEM |
| Alter issued statement lines | NO | NO | NO |
| Correct through replacement/adjustment | NO | YES | SYSTEM |

---

# 31. Payment Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own payment history | YES | YES | YES |
| Read another author's payments | NO | YES | SYSTEM |
| Create completed payment directly | NO | LIMITED | SYSTEM |
| Approve payment | NO | YES | SYSTEM |
| Mark payment paid | NO | YES/LIMITED | SYSTEM |
| Alter completed payment silently | NO | NO | NO |
| Delete completed payment | NO | NO | NO |

Completed payments are historical financial events.

---

# 32. Payment Request Permissions

Where Author Desk payment requests are enabled:

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read own requests | YES | YES | YES |
| Create request against eligible balance | LIMITED | YES | SYSTEM |
| Request more than eligible balance | NO | NO | NO |
| Approve own request | NO | YES | SYSTEM |
| Reject/cancel administratively | NO | YES | SYSTEM |
| Cancel own pending request | LIMITED | YES | SYSTEM |
| Alter completed request | NO | NO | NO |

A payment request does not create royalty income.

It requests settlement of an already established eligible balance.

---

# 33. Activity / Audit Permissions

| Operation | Author | Blackwood Admin | System |
|---|---|---|---|
| Read general author-facing activity | LIMITED | YES | YES |
| Read security/audit metadata | NO | YES/LIMITED | SYSTEM |
| Create trusted audit event | NO | LIMITED | SYSTEM |
| Alter audit event | NO | NO | NO |
| Delete audit event | NO | NO/LIMITED | SYSTEM |

Security-sensitive audit information should not automatically be exposed in the
Author Desk interface.

---

# 34. Administrator Permissions

Administrator access is powerful and must itself be constrained.

A Blackwood Administrator should not automatically receive unrestricted
database superuser behaviour.

Administrative actions should still pass through:

- authenticated identity;
- verified administrator role;
- database policies or trusted server operations;
- appropriate audit logging.

Where practical, particularly sensitive actions should be performed through
controlled functions rather than arbitrary client-side writes.

Examples may include:

- issuing a royalty statement;
- recording a completed payment;
- changing contractual rights;
- granting Author Desk access;
- generating private document access.

---

# 35. Service Role Rules

The Supabase service role, or equivalent trusted credential, bypasses ordinary
Row Level Security and must therefore be treated as highly privileged.

Rules:

1. Never include the service-role key in public JavaScript.
2. Never commit the service-role key to GitHub.
3. Never send the service-role key to the browser.
4. Use it only in trusted server-side environments.
5. Validate the requesting user before performing user-triggered privileged
   operations.
6. Do not assume that a request is legitimate merely because it reached an Edge
   Function.
7. Log sensitive operations where appropriate.
8. Return only the minimum required data.

---

# 36. Storage Permissions

Author Desk storage should be private by default.

Potential private file categories include:

- publishing agreements;
- amendments;
- royalty statements;
- proofs;
- production files;
- rights documents;
- author-specific files.

Storage access must reflect database permissions.

An author who cannot read the related document record must not be able to obtain
the underlying file through storage directly.

---

# 37. Signed URL Rules

Where temporary signed URLs are used:

- verify the authenticated user first;
- verify author ownership;
- verify document visibility;
- verify document status where relevant;
- use a limited expiry period;
- do not persist the signed URL as the permanent document address.

The storage path is the durable reference.

The signed URL is temporary delivery infrastructure.

---

# 38. Cross-Author Isolation

Cross-author isolation is a critical security requirement.

Suppose:

Author A owns Book Record 101.

Author B owns Book Record 202.

Author A must not be able to access Book Record 202 or its related records by
requesting:

`book_id = 202`

The same rule applies to:

- editions;
- documents;
- agreements;
- rights;
- royalty entries;
- statements;
- statement lines;
- advances;
- payment records;
- payment requests.

Ownership must be checked through trusted database relationships.

---

# 39. URL and Client Manipulation

The system must assume that users can modify:

- URLs;
- query strings;
- JavaScript requests;
- record IDs;
- API payloads;
- browser storage;
- hidden form values.

Security must therefore not depend upon those values being honest.

Example:

A browser request saying:

`author_id = 12`

does not prove that the authenticated user is Author 12.

The database or trusted server process must establish that relationship.

---

# 40. Field-Level Update Strategy

Row ownership alone is insufficient for some records.

An author may legitimately update part of their Author Record without being
allowed to change administrative fields on the same row.

For sensitive records, one of the following approaches should be considered:

- restricted database functions;
- separate tables for author-editable information;
- server-side update functions;
- carefully constrained RLS and column privileges.

The exact mechanism will be chosen during SQL design.

---

# 41. Historical Integrity

The following records should normally preserve history rather than be directly
overwritten:

- production stage events;
- signed agreements;
- agreement amendments;
- rights events;
- cleared royalty entries;
- royalty adjustments;
- issued royalty statements;
- completed payments;
- significant audit events.

Where correction is required, prefer:

- amendment;
- superseding record;
- adjustment;
- reversal;
- new historical event.

Do not erase the evidence that the original event occurred.

---

# 42. Deletion Permissions

Hard deletion is exceptional.

Authors should generally have no direct DELETE permission over operational
publishing records.

Blackwood administrative deletion should also be restricted once a record has
become historical, contractual or financial.

Preferred states include:

- inactive;
- archived;
- cancelled;
- expired;
- superseded;
- reverted;
- corrected.

Hard deletion may remain appropriate for genuine test data or records created
in error before they become meaningful publishing history.

---

# 43. Public Access

Author Desk operational tables should not provide anonymous public access
unless a future feature has a specific, reviewed reason to do so.

Public catalogue information belongs in an appropriate public publishing or
website data source.

The private Author Desk should not be used as a shortcut for public website
queries.

---

# 44. Submissions Boundary

A manuscript submission does not create an Author Desk relationship.

The future flow may be:

SUBMISSION
   |
   +-- acquisition process
           |
           +-- offer
                   |
                   +-- agreement
                           |
                           +-- author onboarding
                                   |
                                   +-- Author Desk access

Author Desk access should occur deliberately during onboarding.

It should not be created merely because someone submitted a manuscript.

---

# 45. ARC Boundary

ARC Team membership and Author Desk access are separate.

An author may also be an ARC reader.

That does not mean ARC permissions should be used to establish author
permissions.

Likewise, an ARC reader must never gain access to an author's:

- agreements;
- rights;
- statements;
- royalties;
- payments;
- private production documents.

---

# 46. Archivist Boundary

The Archivists system is reader-facing.

The Author Desk is publishing-relationship-facing.

Shared authentication may be convenient.

Shared authorisation is not appropriate.

The database must be able to represent a person who is:

- only an Archivist;
- only an Author;
- both;
- neither;
- an Administrator;
- some permitted combination of roles.

---

# 47. Permission Matrix Summary

| Domain | Author Read | Author Write | Admin | System |
|---|---|---|---|---|
| Author Record | Own | Limited | Yes | Yes |
| Relationship | Own summary | No | Yes | Yes |
| Book Record | Own | Limited/No | Yes | Yes |
| Editions | Own | No | Yes | Yes |
| Production Current | Own | No | Yes | Yes |
| Production History | Visible history | No | Yes/Limited | Yes |
| Author Actions | Own | Limited completion | Yes | Yes |
| Documents | Visible own | No | Yes | Yes |
| Agreements | Own | No | Yes | Yes |
| Rights | Own summary | No | Yes | Yes |
| Rights History | Visible own | No | Yes/Limited | Yes |
| Source Finance | No | No | Yes | Yes |
| Cleared Royalties | Own | No | Yes/Limited | Yes |
| Adjustments | Own | No | Yes | Yes |
| Advances | Own | No | Yes | Yes |
| Statements | Issued own | No | Yes | Yes |
| Payments | Own | No | Yes/Limited | Yes |
| Payment Requests | Own | Limited | Yes | Yes |
| Audit | Limited | No | Limited | Yes |

This summary is directional.

The detailed sections above take precedence.

---

# 48. Initial RLS Design Objectives

When SQL implementation begins, Row Level Security should prove the following
tests.

### Test 1 — Anonymous visitor

Cannot read Author Desk operational data.

### Test 2 — Authenticated non-author

Cannot read Author Desk records merely because they are authenticated.

### Test 3 — Author A

Can read Author A's permitted records.

### Test 4 — Author A requesting Author B

Receives no Author B private records.

### Test 5 — Author A changing record ID manually

Still receives no unauthorised data.

### Test 6 — Author attempting administrative update

Database rejects the operation.

### Test 7 — Administrator

Can perform explicitly authorised administrative operations.

### Test 8 — Private storage

Author can receive an authorised temporary file link only for a permitted
document.

### Test 9 — Issued financial record

Author cannot modify it.

### Test 10 — Service process

Can perform its required privileged operation without exposing privileged
credentials to the client.

---

# 49. RLS Acceptance Standard

A policy is not considered complete merely because the normal Author Desk UI
works.

Before a table is considered secure, testing must include:

- anonymous access;
- authenticated non-author access;
- correct-author access;
- wrong-author access;
- manipulated record IDs;
- direct REST/API requests;
- unauthorised INSERT;
- unauthorised UPDATE;
- unauthorised DELETE.

Security should be tested against hostile requests, not only intended UI
behaviour.

---

# 50. v1 Permissions Decisions

The following decisions are established for Author Desk v1:

1. Author Desk is private.
2. Authentication alone does not grant Author access.
3. Author access must be explicitly linked to an Author Record.
4. Authors may access only their own publishing records.
5. Internal Blackwood notes remain private.
6. Authors do not control production state.
7. Authors do not alter contractual rights.
8. Signed agreements are historical records.
9. Issued royalty statements are controlled historical records.
10. Completed payments are controlled historical records.
11. Authors cannot create or alter payable royalty balances.
12. Payment requests, if enabled, operate only against eligible cleared funds.
13. Private files require authorised delivery.
14. Archivist and ARC roles do not grant Author permissions.
15. Service-role credentials never enter browser code.
16. Important publishing, legal and financial history should not be silently
    overwritten.

---

# 51. Decisions Reserved for SQL Design

The following remain deliberately unresolved:

- exact Author role table structure;
- whether existing authentication profile tables are reused;
- administrator role implementation;
- whether admin writes occur directly under RLS or through RPC/functions;
- column-level privilege strategy;
- co-author access;
- literary agent access;
- delegated assistant access;
- accountant/bookkeeper access;
- document signing integration;
- payment provider integration;
- exact storage bucket design;
- exact audit trigger implementation;
- financial import permissions;
- emergency administrative access;
- account suspension behaviour;
- retention periods.

These decisions should be made explicitly during implementation rather than
emerging accidentally from table design.

---

# 52. Permission Review Rule

Every future Author Desk feature must answer:

1. Who is requesting this?
2. Which Author Record are they linked to?
3. Which Book Record or relationship owns the requested information?
4. Is the information author-visible?
5. Is the user allowed to change it?
6. Is the record historical or immutable?
7. Does the operation require a trusted server process?
8. Should the operation create an audit event?

If those questions cannot be answered, implementation should stop until the
permission model is clear.

---

# 53. Final Principle

The Author Desk should feel simple to the author because the permission system
behind it is not simple.

Authors should not need to think about database ownership, Row Level Security,
storage policies or service roles.

They should simply see the publishing records that belong to their
relationship with Blackwood.

Nothing more.

Nothing less.

The system is responsible for making that boundary reliable.
