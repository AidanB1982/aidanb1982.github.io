# Blackwood Publishing — Author Desk Data Model

**Version:** 1.0  
**Status:** Architecture Draft  
**Date:** September 2026  
**System:** Blackwood Author Desk

---

## 1. Purpose

The Blackwood Author Desk is the private operational portal for contracted
Blackwood Publishing authors.

It is not a social network, reader dashboard, submission portal, or public
website.

Its purpose is to give an author a clear and reliable view of their publishing
relationship with Blackwood, including:

- their Author Record;
- their acquired books;
- production progress;
- required author actions;
- publishing documents;
- rights and agreements;
- royalty statements;
- cleared royalties and payments.

The Author Desk is the access point.

The Book Record is the continuing operational record of an acquired work.

The system must favour clarity, traceability and historical accuracy over
convenience or visual complexity.

---

## 2. Core Principles

### 2.1 Authors are not customers

The data model must reflect a publishing relationship rather than a
customer/service-provider relationship.

Blackwood contracts with authors, funds normal publishing activity and records
the resulting rights, production work, accounting and publication history.

---

### 2.2 The author owns the work

Copyright ownership and publishing rights are separate concepts.

The system must therefore never treat a publishing agreement as a transfer of
copyright unless a specific agreement expressly states otherwise.

Rights granted to Blackwood must be recorded explicitly.

Rights not granted remain outside the Blackwood rights record.

---

### 2.3 The Book Record is permanent history

A Book Record represents the publishing life of an acquired work.

Publication stages may change.

Editions may be added.

Agreements may expire.

Rights may revert.

Statements may be issued.

Payments may be made.

The historical record of those events must remain intact.

Important publishing history must not disappear merely because the current
state has changed.

---

### 2.4 Current state and historical events are different things

The system should distinguish between:

1. the current state of something; and
2. the history that produced that state.

For example:

A Book Record may currently be at the Production stage.

Its production history may show:

Contracted → Editorial → Author Revision → Beta and Proof → Production

Changing the current stage must not erase that history.

---

### 2.5 Legal documents are authoritative

Plain-English summaries may be displayed in the Author Desk.

They are conveniences only.

Where a rights summary, royalty summary or other portal information conflicts
with a signed agreement, the signed agreement remains authoritative.

Signed legal documents must therefore be retained independently from editable
summary information.

---

### 2.6 Financial records require stronger controls

Royalty calculations, issued statements and completed payments must not behave
like ordinary editable content.

The system must preserve an audit trail.

Once a formal statement has been issued, its financial values should not be
silently overwritten.

Corrections should normally create a new adjustment or replacement record.

---

### 2.7 Author-visible does not mean author-editable

Authors may be allowed to view information without being allowed to alter it.

Every data domain must distinguish between:

- Blackwood-only information;
- author-visible information;
- author-editable information;
- system-generated information;
- immutable historical information.

---

## 3. High-Level Relationship Model

The principal relationship is:

AUTHOR
  |
  +-- AUTHOR RELATIONSHIP
        |
        +-- BOOK RECORD
              |
              +-- EDITIONS
              |
              +-- PRODUCTION
              |
              +-- DOCUMENTS
              |
              +-- RIGHTS & AGREEMENTS
              |
              +-- FINANCE
                    |
                    +-- ADVANCES
                    +-- ROYALTY LEDGER
                    +-- STATEMENTS
                    +-- PAYMENTS

An Author may have multiple Book Records.

A Book Record may have multiple Editions.

A Book Record may have multiple agreements, documents, rights records,
production events, royalty records and statements.

---

# 4. Author Record

## Purpose

The Author Record represents the individual or legal entity with whom
Blackwood has a publishing relationship.

It is not the same thing as a public author biography.

It contains operational information required to manage the relationship.

---

## Proposed fields

### Identity

- author_id
- account_user_id
- legal_name
- publishing_name
- preferred_name
- primary_email
- secondary_email
- telephone
- country
- correspondence_address
- status
- created_at
- updated_at

### Relationship

- relationship_started_at
- relationship_status
- primary_blackwood_contact
- internal_reference
- author_notes_internal

### Payment administration

- payment_method_status
- payment_details_verified_at
- tax_information_status

Actual sensitive banking credentials should not be unnecessarily exposed in
general Author Desk tables.

Where possible, sensitive payment information should be held through an
appropriate secure payment process rather than stored as ordinary profile data.

---

## Visibility

Author:

- may view their own Author Record;
- may update approved contact information;
- may not view internal Blackwood notes;
- may not change relationship status;
- may not change system identifiers.

Blackwood:

- may manage operational relationship data;
- may view internal administrative information.

---

# 5. Author Relationship

## Purpose

The Author Relationship records the publishing relationship between Blackwood
and the author independently of any individual book.

This allows an author to have several acquired works without duplicating
relationship-level information.

---

## Proposed fields

- relationship_id
- author_id
- status
- started_at
- ended_at
- blackwood_contact
- notes_internal
- created_at
- updated_at

---

## Suggested relationship statuses

- prospective
- contracted
- active
- inactive
- concluded

The Author Desk itself should normally be available only where the relationship
and account permissions permit access.

A future submissions system should not automatically create Author Desk access.

---

# 6. Book Record

## Purpose

The Book Record is the central operational record for each work acquired by
Blackwood Publishing.

It follows the work throughout its publishing life.

It is not merely a catalogue listing.

It connects production, editions, rights, documents, accounting and historical
activity.

---

## Proposed fields

### Identity

- book_id
- author_id
- relationship_id
- internal_book_code
- title
- subtitle
- author_display_name
- work_type
- description_internal

### Publishing state

- acquisition_date
- contract_date
- current_production_stage
- current_action_status
- next_milestone
- next_milestone_date
- publication_status
- primary_publication_date

### Administration

- primary_editor
- primary_blackwood_contact
- created_at
- updated_at
- archived_at

---

## Visibility

Author:

- may view their own Book Records;
- may view approved production information;
- may not alter core publishing metadata unless a specific workflow permits it.

Blackwood:

- manages the operational record.

---

## Important rule

A Book Record must not represent a single ISBN.

One intellectual work may have several editions and formats.

For example:

BOOK RECORD
  Gualachulain

EDITIONS
  Paperback
  Hardback
  EPUB
  Special Edition

Each edition may have its own:

- ISBN;
- format;
- publication date;
- price;
- distribution state;
- metadata.

---

# 7. Edition Record

## Purpose

An Edition Record represents a specific commercial or publication edition of a
Book Record.

---

## Proposed fields

- edition_id
- book_id
- edition_name
- format
- isbn
- publication_date
- publication_status
- territory
- language
- list_price
- currency
- distribution_status
- created_at
- updated_at

---

## Example formats

- paperback
- hardback
- ebook
- audiobook
- limited_edition
- special_edition

The permitted values should eventually be controlled rather than arbitrary
free text.

---

# 8. Production

## Purpose

Production records describe where a book currently sits within Blackwood's
publishing process and preserve how it moved through that process.

Production should consist of both:

1. a current state; and
2. a historical event log.

---

## Canonical production stages

The initial Blackwood production lifecycle is:

1. Contracted
2. Editorial
3. Author Revision
4. Beta and Proof
5. Production
6. Pre-publication
7. Published
8. In Print

These should become controlled system values.

They should not initially be arbitrary free-text statuses.

---

# 9. Production History

## Purpose

Every meaningful production stage change should generate a historical record.

---

## Proposed fields

- production_event_id
- book_id
- previous_stage
- new_stage
- changed_at
- changed_by
- author_visible
- note_author
- note_internal

---

## Example

Book:

Gualachulain

History:

Contracted
12 September 2026

Editorial
18 September 2026

Author Revision
03 October 2026

Beta and Proof
22 October 2026

Production
15 November 2026

The current Book Record may say:

Production

but the earlier stages remain preserved.

---

# 10. Author Action Status

Production stage and author action are separate concepts.

A book may be in Editorial while requiring no author action.

Another book may be in Production while awaiting author approval of a file.

The initial action statuses are:

- no_action_required
- author_review_required
- signature_required
- file_available
- blackwood_action_in_progress

---

## Proposed fields

- action_id
- book_id
- action_type
- title
- description
- due_at
- status
- created_at
- completed_at
- completed_by
- related_document_id

---

## Possible future action statuses

- open
- completed
- cancelled
- expired

The Author Desk should make required action obvious without turning the portal
into a generic task-management application.

---

# 11. Documents

## Purpose

The document system provides controlled access to files connected to the
publishing relationship.

Documents should not simply be loose storage objects.

Every document should have metadata describing what it is and what record it
belongs to.

---

## Document categories

Initial categories:

- publishing_agreement
- agreement_amendment
- royalty_statement
- editorial_file
- proof
- cover_file
- production_file
- rights_document
- author_information
- other

---

## Proposed fields

- document_id
- author_id
- book_id
- edition_id
- document_type
- title
- version
- storage_bucket
- storage_path
- mime_type
- author_visible
- requires_signature
- signed_at
- issued_at
- supersedes_document_id
- created_at
- created_by

---

## Important rule

A signed agreement must not be replaced by silently uploading a new file over
the same historical record.

Where an agreement is amended:

ORIGINAL AGREEMENT
        |
        +-- AMENDMENT 1
        |
        +-- AMENDMENT 2

The chain remains visible.

---

# 12. Agreements

## Purpose

Agreement records provide structured information about signed publishing
agreements.

The actual signed document remains authoritative.

---

## Proposed fields

- agreement_id
- author_id
- book_id
- agreement_type
- agreement_date
- effective_date
- expiry_date
- status
- signed_document_id
- summary_author
- notes_internal
- created_at
- updated_at

---

## Possible statuses

- draft
- awaiting_signature
- active
- expired
- terminated
- superseded

Historical agreements should remain retained.

---

# 13. Rights

## Purpose

Rights records describe rights expressly licensed to Blackwood under an
agreement.

The system must not infer rights merely because a Book Record exists.

---

## Proposed fields

- right_id
- agreement_id
- book_id
- rights_type
- format
- language
- territory
- exclusive
- granted_at
- expires_at
- reverted_at
- status
- author_visible
- notes_internal

---

## Possible rights types

Examples may include:

- print
- ebook
- audio
- translation
- dramatic
- film_tv
- merchandising
- gaming
- other

These values describe capability only.

A right must only appear as licensed where supported by the actual agreement.

---

# 14. Rights Summary

The Author Desk may display a plain-English rights summary including:

- copyright owner;
- rights licensed to Blackwood;
- formats;
- language;
- territory;
- agreement date;
- agreement term;
- retained rights;
- subsidiary rights position.

The interface must make clear that the summary is informational and that the
signed agreement remains authoritative.

---

# 15. Rights History

Rights status may change over time.

Examples:

- right granted;
- right exercised;
- sublicence entered;
- right expired;
- right reverted;
- agreement amended.

These events should be preserved.

---

## Proposed fields

- rights_event_id
- right_id
- event_type
- event_date
- description_author
- description_internal
- document_id
- created_at
- created_by

---

# 16. Finance Architecture

Financial data should be divided into distinct concepts.

Do not create one generic "royalties" table that attempts to represent every
financial state.

The initial financial model should distinguish:

1. source income / sales information;
2. royalty calculation;
3. cleared author royalty;
4. formal royalty statement;
5. author payment.

These are related but not identical events.

---

# 17. Cleared Royalty Ledger

## Principle

The Author Desk follows the rule:

"If you can see it, you can withdraw it."

Therefore the author-facing payable balance should contain only royalty income
that Blackwood has:

- received;
- reconciled;
- classified;
- confirmed as payable.

Estimated royalties must not be included in the withdrawable balance.

Pending distributor income must not be included.

Unreconciled sales reports must not be included.

---

## Proposed fields

- royalty_entry_id
- author_id
- book_id
- edition_id
- source_reference
- sales_period_start
- sales_period_end
- clearance_date
- channel
- currency
- distributable_net_receipts
- royalty_rate
- royalty_amount
- statement_id
- payment_id
- status
- created_at

---

## Suggested statuses

- cleared
- allocated_to_statement
- payable
- payment_requested
- paid
- adjusted

---

# 18. Royalty Adjustments

Issued financial history should not be silently edited.

Where a correction is necessary, create an adjustment.

---

## Proposed fields

- adjustment_id
- royalty_entry_id
- amount
- reason
- created_at
- created_by
- statement_id

This provides an audit trail.

---

# 19. Advances

## Purpose

Advance records track contractual advances where applicable.

An advance is not mandatory for every publishing agreement.

---

## Proposed fields

- advance_id
- author_id
- book_id
- agreement_id
- amount
- currency
- paid_at
- recoupable
- amount_recouped
- earned_out_at
- status
- created_at

---

## Author Desk presentation

Where an advance exists, the author may see:

- advance paid;
- royalties applied against advance;
- remaining unrecouped balance;
- earned-out status;
- cleared payable royalties after earn-out.

An unearned advance must not automatically be presented as a debt owed by the
author.

The signed agreement remains authoritative.

---

# 20. Royalty Statements

## Purpose

Royalty statements are formal accounting documents.

They are not simply screen summaries.

---

## Proposed fields

- statement_id
- author_id
- statement_number
- period_start
- period_end
- issue_date
- currency
- total_distributable_net_receipts
- total_author_royalty
- advance_recoupment
- adjustments
- amount_payable
- document_id
- status
- created_at

---

## Suggested statuses

- preparing
- issued
- corrected
- superseded

Once issued, statement financial values should normally become immutable.

If a statement requires correction, the correction should preserve the original
record.

---

# 21. Statement Lines

A statement may contain income from multiple books, formats or channels.

Therefore detailed statement lines should exist independently of the statement
header.

---

## Proposed fields

- statement_line_id
- statement_id
- book_id
- edition_id
- channel
- description
- quantity
- distributable_net_receipts
- royalty_rate
- royalty_amount

---

# 22. Payments

## Purpose

Payment records describe money actually paid to an author.

A payment is not the same thing as a royalty credit or statement.

---

## Proposed fields

- payment_id
- author_id
- payment_reference
- amount
- currency
- requested_at
- approved_at
- paid_at
- status
- payment_method_reference
- created_at

---

## Suggested statuses

- available
- requested
- approved
- processing
- paid
- failed
- cancelled

---

# 23. Payment Allocation

One payment may settle multiple royalty entries or statement balances.

A separate allocation record prevents the payment system from assuming a
one-to-one relationship.

---

## Proposed fields

- allocation_id
- payment_id
- royalty_entry_id
- statement_id
- amount
- created_at

---

# 24. Author Payment Requests

If Author Desk payment requests are enabled, the author should request payment
against an already-cleared payable balance.

The request must not itself create royalty income.

---

## Proposed fields

- payment_request_id
- author_id
- requested_amount
- currency
- requested_at
- status
- reviewed_at
- reviewed_by
- payment_id

---

# 25. Activity History

## Purpose

Important actions within the Author Desk should be auditable.

This is especially important for:

- agreements;
- rights;
- production stage changes;
- financial records;
- document issuance;
- payment requests.

---

## Proposed fields

- activity_id
- actor_user_id
- author_id
- book_id
- event_type
- entity_type
- entity_id
- occurred_at
- description
- metadata

Sensitive internal audit information does not need to be displayed to authors.

---

# 26. Visibility Model

The system should eventually implement explicit visibility rules rather than
relying on the interface to hide information.

The database must enforce access.

---

## Author

An authenticated author may access only:

- their own Author Record;
- their own Book Records;
- their own approved production information;
- their own author-visible documents;
- their own rights summaries and agreements;
- their own statements;
- their own cleared royalty information;
- their own payment history;
- their own required actions.

An author must never gain access to another author's records by changing a URL,
request parameter or client-side identifier.

---

## Blackwood administrator

Authorised Blackwood administrators may manage:

- authors;
- Book Records;
- production;
- documents;
- agreements;
- rights;
- financial records;
- statements;
- payments;
- administrative metadata.

Administrative access should itself be role-controlled.

---

# 27. Author-Visible vs Blackwood-Only Data

Every major record should be considered for explicit visibility.

Examples of author-visible information:

- current production stage;
- next milestone;
- author action required;
- signed agreements;
- author-facing rights summary;
- issued statements;
- cleared royalties;
- completed payments.

Examples of Blackwood-only information:

- internal acquisition discussion;
- internal editorial notes not intended for the author;
- internal commercial analysis;
- administrative security information;
- internal rights negotiation notes;
- unreconciled financial imports;
- internal audit metadata.

The absence of an interface element must never be considered a security
boundary.

---

# 28. Mutability Rules

Different records require different editing behaviour.

---

## Editable current-state records

Examples:

- author contact information;
- next production milestone;
- current production stage;
- author action state;
- internal operational notes.

Changes may update the current record while significant changes also generate
history.

---

## Historical records

Examples:

- production stage history;
- rights events;
- activity records;
- completed payments.

These should generally be append-only.

---

## Immutable or controlled financial/legal records

Examples:

- signed agreements;
- issued royalty statements;
- completed payment records.

These must not be silently overwritten.

Corrections should create linked replacement, amendment or adjustment records.

---

# 29. Deletion Policy

Hard deletion should be uncommon.

Publishing records may need to survive long after active publication ends.

Where practical, use lifecycle states such as:

- inactive;
- archived;
- expired;
- superseded;
- reverted;
- cancelled.

Hard deletion should be reserved for circumstances such as:

- erroneous test data;
- legally required deletion;
- records created accidentally before becoming operational history.

Financial and contractual deletion rules will require separate retention
policy decisions.

---

# 30. Security Boundary

The Author Desk must be treated as a separate permission domain from:

- The Archivists;
- ARC Team access;
- public website accounts;
- submissions applicants.

A person may occupy more than one role.

For example:

USER
  |
  +-- Archivist
  +-- ARC Reader
  +-- Blackwood Author

Those roles must not automatically grant one another's permissions.

Being an Archivist does not make someone an Author.

Being an Author does not grant Blackwood administrative access.

Being an ARC reader does not grant access to publishing agreements or royalty
information.

---

# 31. Authentication Direction

The Author Desk may use the existing Blackwood authentication infrastructure,
but Author Desk access should require an explicit author relationship or role.

Authentication answers:

"Who is this user?"

Author Desk authorisation answers:

"Which publishing records is this user permitted to access?"

Those are different questions.

---

# 32. Row Level Security Direction

When the database implementation begins, Row Level Security should enforce
author ownership at database level.

The general pattern should be:

authenticated user
        |
        +-- linked Author Record
                |
                +-- permitted Book Records
                        |
                        +-- related permitted records

Client-side filtering is not sufficient.

RLS must prevent cross-author access even where a malicious or accidental
request supplies another record identifier.

---

# 33. Storage Direction

Publishing documents should use private storage.

Files should not rely on permanently public URLs.

Author access should be authorised before a temporary download URL is issued.

Potential storage domains may eventually include:

- agreements;
- statements;
- author-production-files;
- proofs;
- rights-documents.

Exact bucket architecture will be decided during implementation.

---

# 34. Author Desk Dashboard

The dashboard should answer the author's most practical questions quickly:

1. Where is my book now?
2. What happens next?
3. Is anything required from me?
4. Are there documents waiting for me?
5. What rights has Blackwood licensed?
6. Are there new statements?
7. What cleared royalties are payable?
8. What payments have been made?

It should not become a generic analytics dashboard.

---

# 35. Example Book Record

AUTHOR

Aidan Blackwood

BOOK RECORD

Gualachulain

CURRENT PRODUCTION

Pre-publication

NEXT MILESTONE

Publication

AUTHOR ACTION

No action required

EDITIONS

Paperback
EPUB

DOCUMENTS

Publishing Agreement
Proof
Final Cover

RIGHTS

Print
Electronic

ROYALTIES

Cleared balance: £0.00

STATEMENTS

None issued

PAYMENTS

None

This example is illustrative only and does not itself establish contractual,
rights or financial facts.

---

# 36. Initial Entity Set

The first database design should consider the following conceptual entities:

1. authors
2. author_relationships
3. books
4. book_editions
5. production_events
6. author_actions
7. documents
8. agreements
9. rights
10. rights_events
11. royalty_entries
12. royalty_adjustments
13. advances
14. royalty_statements
15. royalty_statement_lines
16. payments
17. payment_allocations
18. payment_requests
19. activity_events

These are conceptual entities.

They are not yet approved SQL table names.

The SQL design may consolidate or separate entities where doing so improves
integrity, security or maintainability.

---

# 37. Questions Reserved for SQL Design

The following decisions should deliberately remain unresolved until the
architecture is reviewed:

- whether Author Desk users share the existing member profile identity table;
- whether authors require a separate role table;
- whether author relationships support agents or co-authors in v1;
- exact enum/check-constraint strategy;
- exact document storage bucket structure;
- exact financial import architecture;
- payment provider integration;
- multi-currency accounting behaviour;
- statement numbering format;
- agreement versioning implementation;
- production event generation method;
- audit trigger strategy;
- administrator role architecture;
- retention periods;
- data export requirements.

These should not be decided accidentally while creating tables.

---

# 38. Explicitly Out of Scope for v1 Architecture

Unless separately approved, the initial Author Desk should not attempt to
become:

- a manuscript submissions system;
- a full accounting package;
- a distributor sales analytics platform;
- a social network;
- an author marketing scheduler;
- a public author website builder;
- a replacement for signed publishing agreements;
- a replacement for Blackwood's formal accounting records.

The Desk may integrate with or present information from other systems without
attempting to replace every system itself.

---

# 39. Implementation Order

The recommended implementation sequence is:

PHASE 1
Data model

PHASE 2
Permissions matrix

PHASE 3
Lifecycle and state rules

PHASE 4
SQL schema

PHASE 5
Row Level Security

PHASE 6
Private storage architecture

PHASE 7
Seed author and Book Record

PHASE 8
Author Desk application shell

PHASE 9
Production interface

PHASE 10
Documents and rights interface

PHASE 11
Statements and royalty interface

PHASE 12
Payment request functionality

Financial functionality should not be rushed merely to complete the visual
portal.

---

# 40. Architectural Test

Before implementation, every proposed feature should be tested against four
questions:

### What is the record?

Identify the actual publishing object being represented.

### Who owns or controls it?

Identify the author, Book Record, agreement or Blackwood relationship to which
it belongs.

### Who can see it?

Author, Blackwood administrator, system process, or another explicitly
authorised role.

### Can it change?

Determine whether it is:

- editable current state;
- versioned;
- append-only history;
- immutable after issue.

If those four questions cannot be answered clearly, the feature is not ready
for implementation.

---

# 41. Governing Principle

The Author Desk should make Blackwood's publishing relationship easier to
understand without simplifying away the records that matter.

An author should be able to open the Desk and understand:

where their book is,
what happens next,
what Blackwood needs from them,
what they have agreed,
what rights Blackwood holds,
what money has cleared,
and what Blackwood has paid.

Behind that simplicity should be a careful, auditable publishing record.

That record is the foundation of the Blackwood Author Desk.
---
## Implementation Record

The following sections record the database migrations actually implemented for
the Blackwood Author Desk.

The architectural sections above describe the intended system. This
Implementation Record describes the database objects and access controls that
have actually been created and verified.

---

## Migration 001 — Author Records

**Implemented:** 26 September 2026  
**Status:** Verified

Migration 001 introduced:

`public.author_records`

Its purpose is to establish the authenticated publishing identity used by the
Author Desk while keeping that identity separate from the existing Archivist /
reader profile.

The identity structure is:

```text
auth.users
    ├── member_profiles
    │       └── Archivist / reader identity
    │
    └── author_records
            └── Author Desk publishing identity
```

A person may therefore possess both a reader identity and a publishing identity
without either role automatically granting access to the other.

### Implemented fields

The initial implementation contains:

- `id`
- `publishing_name`
- `legal_name`
- `email`
- `relationship_status`
- `desk_access_enabled`
- `created_at`
- `updated_at`

The primary key:

`author_records.id`

references:

`auth.users.id`

The relationship uses `ON DELETE RESTRICT`.

The authenticated Supabase user identity is therefore also the root identifier
for that person's Author Desk publishing identity.

### Security boundary

The existence of a row in `member_profiles` does not establish Author Desk
access.

Author Desk access begins with an explicit record in:

`public.author_records`

This preserves the separation between:

```text
Archivist / reader identity
```

and:

```text
Blackwood publishing identity
```

### Author visibility

Row Level Security is enabled on `public.author_records`.

An authenticated author may read only their own Author Record.

The ownership test is based on:

```text
auth.uid() = author_records.id
```

The browser does not determine which Author Record belongs to the current user.

### Browser mutation permissions

The initial implementation provides authenticated authors with SELECT access
only.

No authenticated browser INSERT, UPDATE or DELETE permissions were introduced
for Author Records.

Author identity and relationship administration therefore remain controlled
Blackwood data.

### Initial production record

The first Author Record created was for:

```text
Publishing name:      Aidan Blackwood
Relationship status: active
Desk access enabled: true
```

This record is separate from the existing reader / Archivist profile belonging
to the same authenticated user.

### Verification

Migration 001 was tested through authenticated Row Level Security.

The acceptance tests confirmed that the authenticated author could read their
own Author Record while an ordinary authenticated account without the
corresponding publishing identity could not read that record.

Anonymous access was not granted.

**Migration 001 is verified.**

---

## Migration 001B — Author Desk Access Enforcement

**Implemented:** 26 September 2026  
**Status:** Verified

Migration 001B strengthened the original `author_records` Row Level Security
policy so that Author Desk access is controlled by the database rather than
only by application behaviour.

The Author Record SELECT policy requires both:

```text
auth.uid() = author_records.id
```

and:

```text
author_records.desk_access_enabled = true
```

The resulting rule is conceptually:

```text
correct authenticated author
        +
desk_access_enabled = true
        =
Author Record visible
```

This establishes `desk_access_enabled` as the top-level Author Desk access
switch.

### Kill-switch behaviour

Where:

```text
desk_access_enabled = false
```

the author's authenticated session remains valid, but Author Desk publishing
data protected by this access path is no longer exposed.

This distinguishes authentication from authorisation.

Authentication answers:

```text
Who is this user?
```

The Author Desk access control answers:

```text
May this user currently access their publishing records?
```

### Verification

The access switch was tested by temporarily disabling Author Desk access for the
initial author.

With:

```text
desk_access_enabled = false
```

the Author Record was no longer returned to the authenticated author.

After restoring:

```text
desk_access_enabled = true
```

the Author Record became visible again.

The final production state was restored with Author Desk access enabled.

**Migration 001B is verified.**

---

## Migration 002 — Author Relationships

**Implemented:** 26 September 2026  
**Status:** Verified

Migration 002 introduced:

`public.author_relationships`

Its purpose is to represent the publishing relationship between Blackwood and
an author independently from individual Book Records.

The relationship structure is:

```text
auth.users
    ↓
author_records
    ↓
author_relationships
```

An Author Record establishes the authenticated publishing identity.

An Author Relationship records the operational relationship between that author
and Blackwood Publishing.

### Implemented fields

The initial implementation contains:

- `id`
- `author_id`
- `status`
- `started_on`
- `concluded_on`
- `internal_reference`
- `created_at`
- `updated_at`

`author_id` references:

`public.author_records.id`

The relationship uses `ON DELETE RESTRICT`.

This reflects the general Author Desk principle that established publishing
history should not disappear merely because another record is removed.

### Controlled relationship status

The initial permitted relationship statuses are:

- `prospective`
- `contracted`
- `active`
- `inactive`
- `concluded`

These values are enforced at database level.

Where both relationship dates exist, the database prevents `concluded_on` from
being earlier than `started_on`.

### Author visibility

Row Level Security is enabled on `public.author_relationships`.

An authenticated author may SELECT their own Author Relationship only where:

1. `author_relationships.author_id = auth.uid()`; and
2. the corresponding `author_records.desk_access_enabled` value is true.

Authentication alone does not grant access to an Author Relationship.

The Author Desk access switch therefore applies both to the Author Record and to
the relationship records beneath it.

### Browser mutation permissions

The initial implementation provides authenticated authors with read access only.

No authenticated browser INSERT, UPDATE or DELETE permissions were introduced
for Author Relationships.

Relationship status remains controlled by Blackwood.

### Initial production record

The first Author Relationship created was:

```text
Author:              Aidan Blackwood
Internal reference:  BLACKWOOD-AUTHOR-001
Status:              active
Started on:          not recorded
Concluded on:        not recorded
```

No relationship dates were invented where authoritative dates had not yet been
recorded.

### Verification

Migration 002 was tested through authenticated Row Level Security.

The acceptance tests confirmed:

```text
Aidan Blackwood
    authenticated author
    → own Author Relationship visible

Ordinary authenticated non-author account
    → 0 Author Relationships visible

Anonymous browser
    → no Author Relationship access
```

The Author Desk access kill switch was also tested.

When:

```text
author_records.desk_access_enabled = false
```

the authenticated author could no longer read the Author Relationship.

After restoring:

```text
author_records.desk_access_enabled = true
```

the Author Relationship became visible again.

Final production state:

```text
BLACKWOOD-AUTHOR-001
status = active
desk access = enabled
```

**Migration 002 is verified.**

---

## Migration 003 — Book Records and Book Contributors

**Implemented:** 26 September 2026  
**Status:** Verified

Migration 003 introduced:

`public.book_records`

and:

`public.book_contributors`

Together these tables establish the ownership and visibility path between an
Author Record and an acquired Book Record.

The implemented relationship is:

```text
auth.users
    ↓
author_records
    ↓
book_contributors
    ↓
book_records
```

This deliberately avoids treating the reader / Archivist identity as evidence
of Book Record ownership.

### Book Records

`public.book_records` represents the continuing operational record of an
acquired work.

The initial implementation contains:

- `id`
- `internal_reference`
- `title`
- `subtitle`
- `work_status`
- `production_stage`
- `acquired_on`
- `contracted_on`
- `created_at`
- `updated_at`

`internal_reference` is unique.

### Controlled work status

The initial permitted Book Record work statuses are:

- `active`
- `paused`
- `archived`

### Controlled production stage

The initial permitted production stages are:

- `contracted`
- `editorial`
- `author_revision`
- `beta_proof`
- `production`
- `pre_publication`
- `published`
- `in_print`

The current production stage is stored on the Book Record.

Historical production changes are stored separately through
`public.production_events`, introduced by Migration 004.

### Book Contributors

`public.book_contributors` connects an Author Record to a Book Record.

The initial implementation contains:

- `id`
- `book_id`
- `author_id`
- `contributor_role`
- `desk_visible`
- `created_at`
- `updated_at`

The combination of:

`book_id + author_id + contributor_role`

is unique.

This permits a Book Record to support multiple contributors without duplicating
author ownership fields directly onto the Book Record.

### Author visibility

Row Level Security is enabled on both tables.

An authenticated author may read a Book Record only where a corresponding
Book Contributor record:

1. belongs to the authenticated author;
2. references that Book Record;
3. has `desk_visible = true`; and
4. belongs to an Author Record whose `desk_access_enabled` value is true.

An authenticated author may read only their own permitted Book Contributor
records.

Authentication alone does not grant access to Book Records.

### Browser mutation permissions

The initial implementation provides authenticated authors with SELECT access
only.

No authenticated browser INSERT, UPDATE or DELETE permissions were introduced
for Book Records or Book Contributor records.

Book ownership, contributor relationships and production state therefore remain
controlled Blackwood data.

### Initial Book Record

The first production Book Record created was:

```text
Internal reference:  BLACKWOOD-BOOK-001
Title:               Gualachulain
Subtitle:            none recorded
Work status:         active
Production stage:    pre_publication
Acquired on:         not recorded
Contracted on:       not recorded
```

No acquisition or contract dates were invented where authoritative dates had
not yet been recorded.

The initial contributor relationship is:

```text
Book:              BLACKWOOD-BOOK-001
Author:            Aidan Blackwood
Contributor role:  author
Desk visible:      true
```

### Verification

Migration 003 was tested through authenticated Row Level Security.

The acceptance tests confirmed:

```text
Aidan Blackwood
    authenticated author
    → Gualachulain Book Record visible
    → own Book Contributor record visible

Ordinary authenticated non-author account
    → 0 Book Records visible
    → 0 Book Contributor records visible

Anonymous browser
    → no Book Record access
    → no Book Contributor access
```

The Book Record and contributor visibility path was also confirmed to respect
the Author Desk access controls.

Final production state:

```text
BLACKWOOD-BOOK-001
    Gualachulain
    work_status = active
    production_stage = pre_publication

Contributor
    Aidan Blackwood
    contributor_role = author
    desk_visible = true
```

**Migration 003 is verified.**

---

## Migration 004 — Production Events

**Implemented:** 27 September 2026  
**Status:** Verified

Migration 004 introduced:

`public.production_events`

Its purpose is to preserve meaningful production history independently from the
current production state held on `public.book_records`.

The architectural distinction is:

```text
book_records.production_stage
        └── current production state

production_events
        └── historical production record
```

Changing the current production stage of a Book Record must not erase the
historical events that led to that state.

### Implemented fields

The initial implementation contains:

- `id`
- `book_id`
- `event_type`
- `from_stage`
- `to_stage`
- `event_date`
- `note`
- `author_visible`
- `created_at`

### Controlled event types

The initial permitted event types are:

- `stage_transition`
- `milestone`
- `note`

A `stage_transition` requires both `from_stage` and `to_stage`.

The stages must be different.

For `milestone` and `note` events, the stage-transition fields remain null.

This prevents a record from claiming to be a production-stage transition
without actually describing a transition.

### Current state remains separate

Migration 004 does not automatically update:

`book_records.production_stage`

when a Production Event is inserted.

Likewise, changing the current Book Record stage does not automatically create a
Production Event.

A future controlled operation may perform both actions within one transaction.

That mechanism was deliberately not invented during Migration 004.

### Author visibility

Row Level Security is enabled on `public.production_events`.

An authenticated author may read a Production Event only where:

1. `production_events.author_visible = true`;
2. the event belongs to a Book Record connected to the authenticated author
   through `public.book_contributors`;
3. the contributor record has `desk_visible = true`; and
4. the author's `author_records.desk_access_enabled` value is true.

Authentication alone does not grant access to production history.

### Browser mutation permissions

The initial implementation provides authenticated authors with SELECT access
only.

No authenticated browser INSERT, UPDATE or DELETE permissions were introduced
for Production Events.

Production history therefore remains controlled Blackwood data.

### Initial production event

The first Production Event created was for:

`BLACKWOOD-BOOK-001 — Gualachulain`

It records:

```text
Event type:      stage_transition
From stage:      production
To stage:        pre_publication
Event date:      30 July 2026
Author visible:  true
Note:            Gualachulain entered pre-publication.
```

This corresponds with the current Book Record state:

```text
production_stage = pre_publication
```

### Verification

Migration 004 was tested through the temporary authenticated Author Desk RLS
diagnostic page.

The acceptance tests confirmed:

```text
Aidan Blackwood
    authenticated author
    → Gualachulain Production Event visible

Ordinary authenticated non-author account
    → 0 Production Events visible

Anonymous browser
    → no Production Event access
```

The per-record `author_visible` control was also tested.

When the event was temporarily changed to:

```text
author_visible = false
```

the authenticated author could no longer read it.

After restoring:

```text
author_visible = true
```

the event became visible again.

Final production state:

```text
Gualachulain
production → pre_publication
30 July 2026
author_visible = true
```

No `created_by` field was introduced in Migration 004 because the Blackwood
administrator / staff actor model had not yet been designed.

**Migration 004 is verified.**

---

## Migration 005 — Book Editions

**Implemented:** 27 September 2026  
**Status:** Verified

Migration 005 introduced:

`public.book_editions`

Its purpose is to represent individual commercial or publication editions of a
Book Record without treating the Book Record itself as a single ISBN, format or
publication instance.

The architectural relationship is:

```text
book_records
    └── book_editions
            ├── Paperback
            ├── Hardback
            ├── EPUB
            ├── Audiobook
            ├── Limited Edition
            └── Special Edition
```

Each Edition Record belongs to one Book Record through:

`book_editions.book_id`

The edition does not duplicate Author Record ownership.

Author access is derived through the existing Author Desk ownership chain:

```text
auth.users
    ↓
author_records
    ↓
book_contributors
    ↓
book_records
    ↓
book_editions
```

### Implemented fields

The initial implementation contains:

- `id`
- `book_id`
- `edition_reference`
- `edition_name`
- `format`
- `isbn`
- `publication_date`
- `status`
- `territory`
- `language`
- `list_price`
- `currency`
- `author_visible`
- `created_at`
- `updated_at`

`edition_reference` is unique.

`isbn` is nullable because not every edition requires or currently has an ISBN.

`publication_date` is nullable because an edition may exist before a publication
date has been fixed.

### Controlled formats

The initial permitted format values are:

- `paperback`
- `hardback`
- `ebook`
- `audiobook`
- `limited_edition`
- `special_edition`

These are enforced by a database CHECK constraint.

### Edition lifecycle

The initial permitted edition statuses are:

- `planned`
- `preparing`
- `scheduled`
- `published`
- `unavailable`
- `withdrawn`
- `archived`

The default status is:

`planned`

These values represent the current lifecycle state of an edition.

Historical edition-state events are not yet implemented.

### Pricing integrity

`list_price` is nullable but, where supplied, must not be negative.

Price and currency are paired:

```text
list_price = null
currency   = null
```

or:

```text
list_price = value
currency   = value
```

The database prevents a list price from existing without a currency and prevents
a currency from being stored without a corresponding list price.

The Edition Record currently stores the normal list price only.

Temporary promotional pricing is not yet modelled and must not overwrite the
normal edition list price merely to represent a short-term promotion.

### Author visibility

Row Level Security is enabled on `public.book_editions`.

Authenticated authors may SELECT an edition only where:

1. `book_editions.author_visible = true`;
2. the edition belongs to a Book Record connected to the authenticated author
   through `public.book_contributors`;
3. the relevant contributor record is Desk-visible; and
4. the author's `author_records.desk_access_enabled` value is true.

Authentication by itself does not grant access to edition records.

The browser does not determine ownership.

### Browser mutation permissions

The initial implementation grants authenticated users SELECT access only.

No authenticated browser INSERT, UPDATE or DELETE permissions were introduced
for Edition Records.

Edition management remains a controlled Blackwood operation.

### Initial production records

Migration 005 created two Edition Records for:

`BLACKWOOD-BOOK-001 — Gualachulain`

#### Paperback

```text
Edition reference:  BLACKWOOD-BOOK-001-PB
Edition name:       Paperback
Format:             paperback
ISBN:               9781919555560
Publication date:   31 October 2026
Status:             scheduled
Territory:          Worldwide
Language:           English
List price:         GBP 10.99
Author visible:     true
```

#### EPUB

```text
Edition reference:  BLACKWOOD-BOOK-001-EPUB
Edition name:       EPUB
Format:             ebook
ISBN:               none recorded
Publication date:   31 October 2026
Status:             scheduled
Territory:          Worldwide
Language:           English
List price:         GBP 1.99
Author visible:     true
```

A launch promotional price of GBP 0.99 is known operationally but is deliberately
not stored as `list_price`.

Promotional pricing requires a separate model if Blackwood later decides that it
belongs within Author Desk data.

### Verification

Migration 005 was tested through the temporary authenticated Author Desk RLS
diagnostic page.

The following acceptance tests passed:

```text
Aidan Blackwood
    authenticated author
    → 2 Gualachulain editions visible

Ordinary authenticated non-author account
    → 0 editions visible

Anonymous browser
    → permission denied for public.book_editions
```

The per-record `author_visible` control was also tested.

The EPUB Edition Record was temporarily changed to:

```text
author_visible = false
```

The authenticated author then saw exactly one Edition Record:

```text
Paperback
```

The EPUB record remained present in the database but was not exposed through
author RLS.

The EPUB was then restored to:

```text
author_visible = true
```

After restoration, the authenticated author again saw exactly two editions.

Final production state:

```text
Paperback   author_visible = true
EPUB        author_visible = true
```

Existing Author Record, Author Relationship, Book Record, Book Contributor and
Production Event browser tests continued to pass after Migration 005.

**Migration 005 is verified.**

### Migration 006 — Author Actions

**Status:** VERIFIED

Migration 006 introduced `public.author_actions` as the Author Desk record of current and historical operational actions associated with a Book Record.

Production stage and author action remain separate concepts. `book_records.production_stage` describes where the work currently sits in the publishing lifecycle; `author_actions` describes whether a specific operational action or information state exists for the author.

#### Table: `public.author_actions`

Implemented fields:

```text
id
book_id
action_type
title
description
due_at
status
author_visible
completed_at
created_at
updated_at
```

`book_id` references `public.book_records(id)` using `ON DELETE RESTRICT`.

Supported `action_type` values:

```text
no_action_required
author_review_required
signature_required
file_available
blackwood_action_in_progress
```

Supported lifecycle `status` values:

```text
open
completed
cancelled
expired
```

`action_type` and `status` are deliberately separate.

For example, an open `no_action_required` record means the current action-state record remains active while confirming that no author action is presently required.

`due_at` is nullable and uses `timestamptz`.

`completed_at` is nullable. A database constraint requires:

- `status = 'completed'` to have a non-null `completed_at`;
- all other statuses to have `completed_at = null`.

`author_visible` defaults to `true`.

`created_at` and `updated_at` default to `now()`.

No automatic `updated_at` trigger has been introduced at this stage.

No `completed_by` field has been introduced because the trusted staff/admin actor model has not yet been designed.

No `related_document_id` field was introduced in Migration 006 because the document model does not yet exist. Document linkage is deferred until the document architecture has been implemented.

#### Author access

Row Level Security is enabled.

Authenticated users receive `SELECT` capability only.

Authors may read an Author Action only when:

- `author_visible = true`;
- the action belongs to a Book Record connected to the authenticated author through `book_contributors`;
- the contributor record has `desk_visible = true`; and
- the corresponding Author Record has `desk_access_enabled = true`.

Authentication alone does not provide Author Desk access.

No authenticated browser `INSERT`, `UPDATE`, or `DELETE` capability is granted.

#### Initial production record

Gualachulain received the first Author Action:

```text
id:             1
book_id:        1
action_type:    no_action_required
title:          No action required
description:    No author action is currently required for Gualachulain.
due_at:         null
status:         open
author_visible: true
completed_at:   null
```

This provides an explicit current Author Desk state rather than requiring the interface to infer that no action is required from the absence of records.

#### Verification

Migration 006 passed the following checks:

1. Schema inspection confirmed all expected columns, nullability and defaults.
2. The Gualachulain Author Action was inserted and read back successfully.
3. Aidan's authenticated Author Desk account could read exactly one accessible Author Action.
4. The ordinary authenticated non-author test account could read zero Author Actions.
5. Anonymous access was rejected with `permission denied for table author_actions`.
6. Setting the Gualachulain action's `author_visible` value to `false` caused the action to disappear from Aidan's Author Desk while the Author Record, Author Relationship, Book Record, Book Contributor, Production Event and Book Editions remained accessible.
7. Restoring `author_visible = true` restored the Author Action without affecting upstream Author Desk records.

Migration 006 is therefore verified for the current Author Desk read-only implementation.
---

### Migration 007 — Documents

**Implemented:** 27 September 2026  
**Status:** VERIFIED

Migration 007 introduced:

`public.documents`

Its purpose is to establish the metadata, ownership and Author Desk access
foundation for publishing documents connected to Blackwood's relationship with
an author.

Migration 007 does not introduce document storage buckets, signed download
URLs, browser uploads, signature workflows or agreement-specific behaviour.

Those capabilities remain separate implementation concerns.

The document ownership model is:

```text
author_records
    └── documents
            ├── optional book_id
            │       └── book_records
            │
            └── optional edition_id
                    └── book_editions
```

Every Document has an explicit `author_id`.

This is deliberate because not every publishing document necessarily belongs to
a particular Book Record. Some documents may apply to the wider publishing
relationship with an author.

Where a document is connected to a specific work, `book_id` identifies that
Book Record.

Where a document is connected to a specific edition, `edition_id` identifies
that Edition Record.

### Implemented fields

The initial implementation contains:

- `id`
- `author_id`
- `book_id`
- `edition_id`
- `document_type`
- `title`
- `version`
- `storage_bucket`
- `storage_path`
- `mime_type`
- `author_visible`
- `requires_signature`
- `signed_at`
- `issued_at`
- `supersedes_document_id`
- `created_at`
- `updated_at`

`author_id` references:

`public.author_records.id`

`book_id` optionally references:

`public.book_records.id`

`edition_id` optionally references:

`public.book_editions.id`

`supersedes_document_id` optionally references:

`public.documents.id`

These relationships use `ON DELETE RESTRICT`.

This follows the Author Desk principle that publishing and legal history should
not disappear through cascading deletion.

### Controlled document types

The initial permitted `document_type` values are:

```text
publishing_agreement
agreement_amendment
royalty_statement
editorial_file
proof
cover_file
production_file
rights_document
author_information
other
```

These values are enforced by a database CHECK constraint.

Arbitrary document categories therefore cannot be inserted into the table.

### Author ownership

Every Document requires an explicit:

`author_id`

This prevents document ownership from being inferred solely from a Book Record,
Edition Record, reader profile or browser-supplied identifier.

A document may exist at author-relationship level without a `book_id`.

A document may also be associated with a Book Record where appropriate.

### Edition relationship

`edition_id` is nullable.

Where an `edition_id` is supplied, the database requires:

```text
book_id is not null
```

This prevents an edition-specific document from existing without also being
associated with a Book Record.

Migration 007 does not attempt to enforce through a simple CHECK constraint
that the selected Edition Record actually belongs to the selected Book Record.

Likewise, the schema does not attempt to prove through a CHECK constraint that
every supplied Book Record belongs to the supplied `author_id`.

Those are cross-table consistency rules and are reserved for the trusted
Blackwood write layer or another controlled database operation.

The Author Desk RLS policy independently verifies the authenticated author's
Book Contributor relationship before exposing a book-specific document.

### Storage metadata integrity

`storage_bucket` and `storage_path` are nullable.

This allows document metadata to exist before a physical file has been placed
into private storage.

Where storage information is supplied, the two values must exist together.

The permitted states are therefore:

```text
storage_bucket = null
storage_path   = null
```

or:

```text
storage_bucket = value
storage_path   = value
```

The database rejects a bucket without a path and rejects a path without a
bucket.

Migration 007 does not create storage buckets or file-delivery infrastructure.

Private storage architecture remains a later implementation stage.

### Document visibility

`author_visible` defaults to:

```text
true
```

This provides a per-document Author Desk visibility control.

A document may remain part of Blackwood's publishing record while being hidden
from the author's current Author Desk view.

The visibility flag does not delete or otherwise alter the document record.

### Signature metadata

Migration 007 introduced:

- `requires_signature`
- `signed_at`

`requires_signature` defaults to:

```text
false
```

These fields provide metadata required for later signature and agreement
workflows.

Migration 007 does not implement the signing workflow itself.

Signed-document immutability, agreement state and signature authority remain
future controlled operations.

### Document issuance

`issued_at` is nullable.

This allows the system to distinguish between the existence of a Document
Record and the later formal issuance of that document where applicable.

No automatic issuance behaviour was introduced in Migration 007.

### Document supersession

`supersedes_document_id` allows a Document Record to identify an earlier
Document Record that it supersedes.

The field references:

`public.documents.id`

using `ON DELETE RESTRICT`.

A database constraint prevents a document from superseding itself.

This establishes the foundation for document history such as:

```text
Original document
        ↓
Replacement / amendment
        ↓
Later replacement / amendment
```

without silently overwriting the earlier record.

Migration 007 does not yet enforce cross-document rules requiring a superseded
document to belong to the same author, Book Record or document category.

Those consistency rules are reserved for the trusted write layer or a later
controlled document workflow.

### Author visibility through Row Level Security

Row Level Security is enabled on:

`public.documents`

Authenticated users receive SELECT capability only.

For a Document to be visible to an authenticated author:

1. `documents.author_visible` must be true;
2. `documents.author_id` must equal `auth.uid()`;
3. the corresponding Author Record must have
   `desk_access_enabled = true`; and
4. where `book_id` is present, the authenticated author must have a matching
   `public.book_contributors` record for that Book Record with
   `desk_visible = true`.

The resulting access path is conceptually:

```text
authenticated user
        ↓
matching author_records identity
        ↓
desk_access_enabled = true
        ↓
documents.author_id = auth.uid()
        ↓
author_visible = true
        ↓
if book-specific:
matching Desk-visible book_contributors record
        ↓
Document visible
```

Authentication alone does not grant document access.

A reader / Archivist account does not grant document access.

Knowledge of a Document ID does not grant document access.

### Browser mutation permissions

The initial implementation grants authenticated users SELECT access only.

No authenticated browser:

- INSERT;
- UPDATE; or
- DELETE

capability was introduced for `public.documents`.

Document creation, visibility changes, storage metadata, signature metadata and
supersession therefore remain controlled Blackwood operations.

### Production data

Migration 007 deliberately created no permanent production Document Record.

A temporary record was created solely for constraint and Row Level Security
verification:

```text
id:                4
author_id:         Aidan Blackwood
book_id:           BLACKWOOD-BOOK-001
edition_id:        null
document_type:     other
title:             Migration 007 Temporary Test Document
version:           TEST
author_visible:    true
requires_signature:false
```

The temporary record was deleted after verification.

The final `public.documents` table therefore contained no production Document
Records at the completion of Migration 007.

Identity values consumed during failed constraint tests and temporary test-data
creation were not reset.

Gaps in generated identity values are permitted and have no operational
meaning.

### Constraint verification

Migration 007 passed database-level constraint tests.

The storage metadata constraint rejected a Document containing:

```text
storage_bucket = value
storage_path   = null
```

The edition relationship constraint rejected a Document containing:

```text
edition_id = value
book_id    = null
```

The controlled document-type constraint rejected the deliberately invalid:

```text
classified_bond_dossier
```

The supersession constraint rejected an attempt to set:

```text
document id = 4
supersedes_document_id = 4
```

The failed self-supersession UPDATE did not alter the stored Document Record.

### Row Level Security verification

Migration 007 was tested through the temporary authenticated Author Desk RLS
diagnostic page.

The existing diagnostic page was extended to query all eight implemented Author
Desk data domains:

```text
author_records
author_relationships
book_records
book_contributors
production_events
book_editions
author_actions
documents
```

The following document-access tests passed.

#### Authenticated author

With the temporary document set to:

```text
author_visible = true
```

Aidan Blackwood could read exactly one accessible Document Record.

The record belonged to the authenticated Author Record and to
`BLACKWOOD-BOOK-001`.

All previously implemented Author Desk RLS tests remained successful.

#### Ordinary authenticated non-author

The ordinary authenticated non-author test account could read:

```text
0 Documents
```

The account also continued to receive no Author Record, Author Relationship,
Book Record, Book Contributor, Production Event, Book Edition or Author Action
data.

This confirmed that ordinary authentication does not imply Author Desk document
access.

#### Anonymous browser

Anonymous access to `public.documents` was rejected with:

```text
permission denied for table documents
```

The existing Author Desk tables likewise remained unavailable anonymously.

#### Per-document visibility

The temporary Document Record was changed to:

```text
author_visible = false
```

After the authenticated author session refreshed, the author could read:

```text
0 Documents
```

while the Author Record, Author Relationship, Book Record, Book Contributor,
Production Event, Book Editions and Author Action remained visible.

This confirmed that the document-level visibility control operates
independently from the wider Author Desk ownership chain.

The temporary Document Record was then restored to:

```text
author_visible = true
```

and became visible to the authenticated author again.

### Cleanup verification

After all constraint and RLS tests were complete, the temporary Document Record
was deleted.

A final query of:

`public.documents`

returned:

```text
0 rows
```

No fabricated agreement, rights document, production file or other permanent
Document Record was created merely to populate the table.

### Deliberately deferred work

Migration 007 does not implement:

- private storage buckets;
- signed download URLs;
- browser uploads;
- document download authorisation;
- signature execution;
- agreement lifecycle behaviour;
- immutable signed-document enforcement;
- trusted staff/admin write identity;
- `created_by`;
- cross-table validation that an Edition belongs to the supplied Book Record;
- cross-table validation that a supplied Book Record belongs to the supplied
  document author;
- cross-document validation of supersession chains;
- automatic document activity events.

These remain later implementation concerns.

Migration 007 establishes the document metadata, ownership, history and
author-read security foundation on which those workflows can be built.

**Migration 007 is verified.**
---

### Migration 008 — Agreements

**Implemented:** 27 September 2026  
**Status:** VERIFIED

Migration 008 introduced:

`public.agreements`

Its purpose is to establish the structured agreement metadata and Author Desk
access foundation for agreements between Blackwood Publishing and an author.

The Agreement Record does not replace the authoritative signed legal document.

Where a signed agreement exists, the signed document remains authoritative and
may be linked to the structured Agreement Record through:

`signed_document_id`

Migration 008 does not introduce document signing, private agreement storage,
agreement execution, browser mutation workflows or permanent production
agreement data.

Those capabilities remain separate implementation concerns.

The agreement relationship is:

```text
author_records
    └── agreements
            ├── optional book_id
            │       └── book_records
            │
            └── optional signed_document_id
                    └── documents
---

### Migration 009 — Rights

**Implemented:** 27 September 2026  
**Status:** VERIFIED

Migration 009 introduced:

`public.rights`

Its purpose is to establish the structured rights metadata and Author Desk
access foundation for rights expressly held by Blackwood Publishing under an
Agreement.

A Rights Record does not itself create, grant or infer a publishing right.

Every Rights Record must be supported by an Agreement through the mandatory:

`agreement_id`

relationship.

The architectural principle is:

```text
author_records
    └── agreements
            └── rights
                    └── optional book_id
```

Rights must not be inferred merely because:

- a Book Record exists;
- an Edition Record exists;
- Blackwood has published a particular format;
- a publication activity has occurred; or
- an author has Author Desk access.

The signed agreement remains authoritative.

### Implemented fields

The initial implementation contains:

- `id`
- `agreement_id`
- `author_id`
- `book_id`
- `rights_reference`
- `right_type`
- `format_scope`
- `territory`
- `language`
- `exclusivity`
- `effective_date`
- `expiry_date`
- `status`
- `summary_author`
- `author_visible`
- `created_at`
- `updated_at`

`agreement_id` references:

`public.agreements.id`

and is mandatory.

`author_id` references:

`public.author_records.id`

and is mandatory.

`book_id` optionally references:

`public.book_records.id`

These relationships use `ON DELETE RESTRICT`.

This follows the Author Desk principle that established contractual and rights
history should not disappear through cascading deletion.

### Explicit agreement dependency

Every Rights Record requires an Agreement.

The database therefore does not permit a standalone Rights Record with no
agreement relationship.

Conceptually:

```text
Agreement
    ↓
Right held under that Agreement
```

not:

```text
Book exists
    ↓
therefore Blackwood must hold rights
```

This distinction is fundamental to the Author Desk rights model.

### Explicit author ownership

Every Rights Record also contains an explicit:

`author_id`

This provides a direct ownership boundary for Row Level Security and prevents
rights ownership from being inferred from browser-supplied Book Record or
Agreement identifiers.

The linked Agreement must belong to the same author before the Rights Record is
exposed through Author Desk RLS.

### Optional Book Record relationship

`book_id` is nullable.

This allows the rights model to support records whose contractual scope may not
require a Book Record relationship while still permitting book-specific rights
where appropriate.

Where `book_id` is supplied, Author Desk access additionally requires a
Desk-visible `book_contributors` relationship for the authenticated author.

Migration 009 does not structurally enforce that the supplied `book_id` matches
the contractual scope of the linked Agreement.

That is a cross-table consistency rule reserved for the trusted Blackwood write
layer or another controlled database operation.

### Controlled right types

The initial permitted `right_type` values are:

```text
publication
translation
audio
adaptation
serialization
anthology
other
```

These values are enforced by a database CHECK constraint.

They describe the broad category of a recorded right.

They do not establish that Blackwood holds any particular right unless a Rights
Record supported by the relevant Agreement actually exists.

### Format scope

`format_scope` is nullable free text.

Migration 009 deliberately does not introduce a rigid format taxonomy for
rights.

The field may later describe the particular format scope supported by the
underlying Agreement where that information is appropriate for the structured
Rights Record.

The database must not manufacture format rights from Edition Records.

### Territory and language

`territory` defaults to:

`Worldwide`

`language` defaults to:

`English`

These fields remain text values rather than controlled enums in Migration 009.

Their presence on a Rights Record describes the scope recorded for that right.

The defaults do not themselves establish contractual rights.

Trusted creation of production Rights Records must use the actual Agreement as
the source of truth.

### Exclusivity

The initial permitted `exclusivity` values are:

```text
exclusive
non_exclusive
```

These values are enforced by a database CHECK constraint.

Exclusivity is mandatory for a Rights Record.

### Rights lifecycle

The initial permitted Rights Record statuses are:

```text
pending
active
expired
reverted
terminated
superseded
```

The default status is:

`pending`

An `active` Rights Record requires a non-null:

`effective_date`

Where both `effective_date` and `expiry_date` exist, the database prevents the
expiry date from being earlier than the effective date.

Migration 009 records current rights state only.

Historical rights events are deliberately deferred to a later migration.

### Author-facing summary

`summary_author` is nullable.

It may contain a plain-English description intended for presentation within the
Author Desk.

The summary is informational only.

It does not replace or override the authoritative signed Agreement.

No internal Blackwood notes field was introduced on the author-readable Rights
Record.

### Author visibility through Row Level Security

Row Level Security is enabled on:

`public.rights`

Authenticated users receive SELECT capability only.

For a Rights Record to be visible to an authenticated author:

1. `rights.author_visible` must be true;
2. `rights.author_id` must equal `auth.uid()`;
3. the corresponding Author Record must have
   `desk_access_enabled = true`;
4. the linked Agreement must belong to the same author;
5. the linked Agreement must have `author_visible = true`; and
6. where `book_id` is present, the authenticated author must have a matching
   `public.book_contributors` record for that Book Record with
   `desk_visible = true`.

The resulting access path is conceptually:

```text
authenticated user
        ↓
matching author_records identity
        ↓
desk_access_enabled = true
        ↓
rights.author_id = auth.uid()
        ↓
rights.author_visible = true
        ↓
linked Agreement belongs to same author
        ↓
linked Agreement is author-visible
        ↓
if book-specific:
matching Desk-visible book_contributors record
        ↓
Rights Record visible
```

Authentication alone does not grant rights access.

A reader / Archivist account does not grant rights access.

Knowledge of a Rights Record ID, Agreement ID or Book Record ID does not grant
rights access.

### Agreement visibility dependency

The Row Level Security policy deliberately requires the linked Agreement to
remain author-visible.

Therefore:

```text
Rights Record author_visible = true
```

is not sufficient by itself.

If the linked Agreement is not author-visible, the dependent Rights Record is
also not exposed through the Author Desk.

This preserves the current Author Desk visibility relationship between the
structured Agreement and the rights recorded beneath it.

### Browser mutation permissions

The initial implementation grants authenticated users SELECT access only.

No authenticated browser:

- INSERT;
- UPDATE; or
- DELETE

capability was introduced for `public.rights`.

Rights creation, amendment, visibility changes and lifecycle changes therefore
remain controlled Blackwood operations.

### Production data

Migration 009 deliberately created no permanent production Rights Record.

The Agreement table contained no production Agreement Record when Migration 009
verification began.

A temporary Agreement was therefore created solely to provide the mandatory
parent relationship required for Rights constraint and Row Level Security
testing.

The temporary Agreement was:

```text
id:                    5
agreement_reference:   MIGRATION-009-AGREEMENT-TEST
agreement_type:        other
book_id:               BLACKWOOD-BOOK-001
status:                draft
author_visible:        true
```

A temporary Rights Record was then created solely for verification:

```text
id:                    5
agreement_id:          5
rights_reference:      MIGRATION-009-RIGHTS-TEST
right_type:            publication
format_scope:          Test scope only
territory:             Worldwide
language:              English
exclusivity:           exclusive
effective_date:        27 September 2026
expiry_date:           none
status:                active
author_visible:        true
```

These values were synthetic test data only.

They do not establish or describe the actual contractual rights held by
Blackwood for Gualachulain.

Both temporary records were deleted after verification.

No permanent production Rights Record was invented merely to populate the
table.

Identity values consumed by failed constraint tests and temporary verification
records were not reset.

Gaps in generated identity values are permitted and have no operational
meaning.

### Constraint verification

Migration 009 passed database-level constraint tests.

The controlled right-type constraint rejected the deliberately invalid:

```text
permission_to_rule_the_world
```

The exclusivity constraint rejected the deliberately invalid:

```text
extremely_exclusive
```

The date-ordering constraint rejected a record containing:

```text
effective_date = 1 October 2026
expiry_date    = 30 September 2026
```

The active-status constraint rejected a Rights Record containing:

```text
status         = active
effective_date = null
```

A valid temporary Rights Record was then created successfully using the
temporary Agreement.

### Row Level Security verification

Migration 009 was tested through the temporary authenticated Author Desk RLS
diagnostic page.

The diagnostic page was extended to query all ten implemented Author Desk data
domains:

```text
author_records
author_relationships
book_records
book_contributors
production_events
book_editions
author_actions
documents
agreements
rights
```

The following Rights access tests passed.

#### Authenticated author

Aidan Blackwood could read exactly one accessible temporary Rights Record.

The record:

- belonged to the authenticated Author Record;
- referenced the temporary Agreement;
- referenced `BLACKWOOD-BOOK-001`;
- was author-visible; and
- passed the existing Desk-visible Book Contributor access path.

All previously implemented Author Desk diagnostic queries continued to pass.

#### Ordinary authenticated non-author

The ordinary authenticated non-author test account could read:

```text
0 Rights Records
```

The account also received no Agreement or other Author Desk publishing data.

This confirmed that ordinary authentication does not imply Author Desk rights
access.

#### Anonymous browser

Anonymous access to:

`public.rights`

was rejected with:

```text
permission denied for table rights
```

The existing Author Desk tables likewise remained unavailable anonymously.

#### Per-record visibility

The temporary Rights Record was changed to:

```text
author_visible = false
```

After refreshing the authenticated author session, the author could read:

```text
0 Rights Records
```

while the temporary parent Agreement remained visible.

The existing Author Record, Author Relationship, Book Record, Book Contributor,
Production Event, Book Editions and Author Action also remained accessible.

This confirmed that Rights Record visibility can be controlled independently
without removing the parent Agreement or disrupting the wider Author Desk
ownership chain.

The temporary Rights Record was then restored to:

```text
author_visible = true
```

and became visible to the authenticated author again.

### Cleanup verification

After all constraint and Row Level Security tests were complete, test data was
removed in dependency order:

```text
1. temporary Rights Record
2. temporary Agreement
```

A final verification returned:

```text
rights       0 rows
agreements   0 rows
```

No identity sequences were reset.

No production Rights Record or Agreement was removed because neither table
contained permanent production data during the Migration 009 verification.

### Deliberately deferred work

Migration 009 does not implement:

- Rights Event history;
- automatic rights lifecycle events;
- sublicence records;
- rights exercise tracking;
- trusted staff/admin browser mutation;
- automatic `updated_at` triggers;
- cross-table enforcement that a Rights Record `book_id` matches the contractual
  scope of its Agreement;
- automatic validation of contractual rights against Edition Records;
- private rights-document delivery;
- agreement execution or signature workflows;
- internal rights negotiation notes;
- automatic Author Desk activity events.

These remain later implementation concerns.

Migration 009 establishes the structured rights, Agreement dependency,
ownership and author-read security foundation on which those workflows can be
built.

**Migration 009 is verified.**
## Migration 010 — Rights History

Migration 010 introduced `public.rights_events`, providing an author-visible historical record for Rights Records while keeping the current rights position in `public.rights`.

### Purpose

`public.rights` represents the current rights position.

`public.rights_events` records historical events that explain how that position developed over time.

This preserves the Author Desk principle that current state and historical record are separate concerns.

### Table: `public.rights_events`

Fields:

- `id` — bigint identity primary key.
- `right_id` — required foreign key to `public.rights`.
- `event_type` — required controlled event type.
- `event_date` — required legal/publishing event date.
- `description_author` — optional author-facing description.
- `author_visible` — controls whether the event may be exposed to the author; defaults to `true`.
- `document_id` — optional supporting-document reference to `public.documents`.
- `created_at` — database creation timestamp.

Supported `event_type` values:

- `granted`
- `activated`
- `amended`
- `expired`
- `reverted`
- `terminated`
- `superseded`
- `sublicensed`
- `note`

`granted` and `activated` are intentionally distinct. A contractual grant may exist before the right becomes effective.

No `from_status` or `to_status` fields are stored at this stage because not every Rights Event represents a status transition.

`event_date` is a `date`, representing the relevant legal or publishing date.

`created_at` is a `timestamptz`, representing when the database record was created.

### Ownership and scope

Rights Events do not duplicate `author_id` or `book_id`.

Ownership and scope are derived through the parent Rights Record:

`rights_events → rights → agreements`

Where the Right is book-specific, access also depends on the authenticated author having a Desk-visible contributor relationship with that Book Record.

An optional `document_id` may link a Rights Event to a supporting Document.

A supporting Document is not mandatory.

### Author visibility and RLS

Row Level Security is enabled.

Authenticated authors may read a Rights Event only when:

- the Rights Event is `author_visible = true`;
- its parent Rights Record is `author_visible = true`;
- the parent Right belongs to the authenticated author;
- that author's Author Desk access is enabled;
- the linked Agreement belongs to the same author and is author-visible; and
- where the Right is book-specific, the authenticated author has a Desk-visible contributor relationship with that Book Record.

This means an individually author-visible Rights Event cannot bypass the visibility or ownership controls of its parent Rights Record.

Anonymous access is not granted.

Browser-side mutation access is not granted.

### Verification

Migration 010 was verified with temporary test data only.

Tests confirmed:

- the expected eight-column schema;
- controlled `event_type` enforcement;
- parent Rights Record foreign-key enforcement;
- optional supporting Document foreign-key enforcement;
- successful creation of a valid Rights Event with no supporting Document;
- the owning author could read the accessible Rights Event;
- an authenticated non-author account could not read it;
- anonymous access was denied;
- setting the Rights Event's own `author_visible` flag to `false` hid the event while leaving its parent Right visible;
- restoring event visibility made the event accessible again;
- setting the parent Right's `author_visible` flag to `false` hid both the Right and its otherwise author-visible Rights Event; and
- restoring the parent Right restored the complete visible chain.

All temporary Migration 010 Rights Event, Right and Agreement records were deleted after verification.

No production Rights Events were created by this migration.

Identity sequences were not reset after testing.

### Deferred controls

The following remain deliberately deferred:

- immutable/append-only enforcement for Rights Events;
- trusted staff/service-role write workflows;
- staff actor or `created_by` attribution;
- cross-table write validation beyond the implemented foreign keys and RLS rules;
- internal-only Rights Event notes;
- automated Rights state transitions derived from events; and
- production Rights and Rights Event data.

These controls should be introduced through the trusted write layer rather than browser-side mutation.
---

## Migration 011 — Advances and Advance Instalments

**Implemented:** 28 September 2026  
**Status:** VERIFIED

Migration 011 introduced:

`public.advances`

and:

`public.advance_instalments`

Its purpose is to establish the contractual advance and advance-instalment
foundation for the Author Desk without confusing contractual obligations,
scheduled instalments and actual movement of money.

The implemented relationship is:

```text
Agreement
    ↓
Advance
    ↓
Advance Instalments
        ↓
future Payment machinery
---

## Migration 012 — Cleared Royalty Ledger

**Implemented:** 28 September 2026  
**Status:** VERIFIED

Migration 012 introduced:

`public.royalty_entries`

Its purpose is to establish the cleared royalty ledger for the Author Desk.

A Royalty Entry represents confirmed royalty value credited to the author's
financial account after the underlying income has been received and reconciled
by Blackwood.

The table does not represent estimated royalties, pending distributor income,
unreconciled sales information, formal statements or payments.

The implemented financial sequence is:

```text
Distributor / sales source
        ↓
received + reconciled by Blackwood
        ↓
Cleared Royalty Ledger
        ↓
future Statement
        ↓
future Payment / Allocation
```

The governing principle is:

```text
If a Royalty Entry exists, the royalty has cleared.
```

Pending or estimated amounts therefore do not belong in
`public.royalty_entries`.

### Implemented fields

The initial implementation contains:

- `id`
- `author_id`
- `book_id`
- `edition_id`
- `source_reference`
- `sales_period_start`
- `sales_period_end`
- `clearance_date`
- `channel`
- `currency`
- `distributable_net_receipts`
- `royalty_rate`
- `royalty_amount`
- `author_visible`
- `created_at`
- `updated_at`

`author_id` references:

`public.author_records.id`

and is mandatory.

`book_id` references:

`public.book_records.id`

and is mandatory.

`edition_id` optionally references:

`public.book_editions.id`

These relationships use `ON DELETE RESTRICT`.

This follows the Author Desk principle that established financial history
should not disappear through cascading deletion.

### Financial ownership

A Royalty Entry belongs financially to the author's account.

The mandatory `author_id` establishes that ownership directly.

The mandatory `book_id` records the work from which the royalty arose.

The relationship is conceptually:

```text
Author financial account
        ↓
Royalty Entry
        ↓
Book that generated the royalty
        ↓
optional specific Edition
```

The Book Record therefore provides the publishing source of the royalty without
becoming the owner of the author's financial balance.

Archiving or otherwise changing the operational state of a Book Record must not
erase the historical royalty ledger.

### Book and Edition attribution

`book_id` is mandatory because a cleared royalty must identify the work from
which the royalty was generated.

`edition_id` is nullable.

This permits a Royalty Entry to identify a particular Edition where the source
information supports that level of attribution while still permitting
work-level royalty entries where no specific Edition attribution is available.

Migration 012 does not structurally enforce that a supplied `edition_id`
belongs to the supplied `book_id`.

That is a cross-table consistency rule reserved for the trusted Blackwood write
layer or another controlled database operation.

### Source reference

Every Royalty Entry requires a:

`source_reference`

The field records the source or reconciliation reference associated with the
cleared royalty.

`source_reference` is deliberately not unique.

A single distributor report, accounting source or reconciliation reference may
legitimately produce more than one Royalty Entry.

Migration 012 verification confirmed that multiple ledger rows may therefore
share the same source reference.

### Sales period

The optional fields:

- `sales_period_start`
- `sales_period_end`

allow a Royalty Entry to record the sales period represented by its source
information.

Either field may be null.

Where both dates are present, the database requires:

```text
sales_period_end >= sales_period_start
```

The database therefore rejects a sales period whose end date precedes its start
date.

### Clearance date

Every Royalty Entry requires:

`clearance_date`

This records the date on which the royalty represented by the ledger entry was
treated as cleared.

The existence of a Royalty Entry means the amount has already passed the
required Blackwood receipt and reconciliation stage.

No separate `pending` or `cleared` status is therefore required on this table.

### Distributable net receipts

Every Royalty Entry requires:

`distributable_net_receipts`

The value must be greater than or equal to zero.

The database rejects negative distributable net receipts.

The field represents the distributable net receipts associated with the ledger
entry rather than the royalty amount itself.

### Royalty rate

`royalty_rate` is nullable.

This allows the cleared ledger to represent entries where the originating
royalty calculation does not require or does not provide a meaningful rate.

Where a royalty rate is supplied, it must be greater than or equal to zero.

The database rejects a negative royalty rate.

### Royalty amount

Every Royalty Entry requires:

`royalty_amount`

The value must not equal zero.

Positive cleared royalty amounts are therefore supported.

Negative cleared royalty amounts are also structurally permitted.

Allowing a negative amount provides flexibility for legitimate financial ledger
situations where a negative cleared entry may be required.

Ordinary corrections to established royalty history should not, however, be
performed by silently rewriting an existing cleared entry.

The planned Royalty Adjustments model remains the intended mechanism for
explicit corrections and adjustments.

### Append-oriented financial history

`public.royalty_entries` is intended to operate as an append-oriented financial
journal.

Once a cleared Royalty Entry exists, later Statement and Payment activity
should reference or allocate that financial history rather than transforming
the Royalty Entry into a Statement or Payment record.

Migration 012 therefore does not contain:

- `statement_id`;
- `payment_id`;
- payment status;
- `paid_at`; or
- a general royalty lifecycle status.

Those concepts belong to later financial records.

The separation is:

```text
Royalty Entry
    = cleared royalty credit

Statement
    = formal accounting presentation

Payment
    = actual movement of money
```

These events are related but are not interchangeable.

### Author visibility through Row Level Security

Row Level Security is enabled on:

`public.royalty_entries`

Authenticated users receive SELECT capability only.

For a Royalty Entry to be visible to an authenticated author:

1. `royalty_entries.author_visible` must be true;
2. `royalty_entries.author_id` must equal `auth.uid()`;
3. the corresponding Author Record must have
   `desk_access_enabled = true`; and
4. the authenticated author must have a matching
   `public.book_contributors` record for the Royalty Entry's Book Record with
   `desk_visible = true`.

The resulting access path is conceptually:

```text
authenticated user
        ↓
royalty_entries.author_id = auth.uid()
        ↓
matching author_records identity
        ↓
desk_access_enabled = true
        ↓
royalty_entries.author_visible = true
        ↓
matching Desk-visible book_contributors record
        ↓
Royalty Entry visible
```

Authentication alone does not grant access to royalty information.

A reader / Archivist account does not grant royalty access.

Knowledge of a Royalty Entry ID, Book Record ID or Edition Record ID does not
grant royalty access.

### Edition visibility is not an accounting visibility gate

The Royalty Entry Row Level Security policy deliberately does not require the
optional linked Edition Record to have:

`book_editions.author_visible = true`

Edition visibility is an operational Author Desk presentation control.

It must not determine whether historical financial information belonging to the
author remains visible.

A cleared Royalty Entry therefore remains governed by:

- author ownership;
- Author Desk access;
- Royalty Entry visibility; and
- the author's Desk-visible relationship with the relevant Book Record.

This prevents an operational change to Edition visibility from accidentally
hiding established financial ledger history.

### Browser mutation permissions

The initial implementation grants authenticated users SELECT access only.

No authenticated browser:

- INSERT;
- UPDATE; or
- DELETE

capability was introduced for `public.royalty_entries`.

Creation and alteration of cleared royalty information therefore remain
controlled Blackwood operations.

The author-facing browser is not trusted to create financial credits or modify
the cleared royalty ledger.

### Production data

Migration 012 deliberately created no permanent production Royalty Entry.

Synthetic records were created solely for database constraint and Row Level
Security verification.

The valid positive test entry represented:

```text
Source reference:             MIGRATION-012-ROYALTY-TEST
Book:                         BLACKWOOD-BOOK-001
Edition:                      Paperback
Currency:                     GBP
Distributable net receipts:   100.00
Royalty rate:                 0.100000
Royalty amount:               10.00
Author visible:               true
```

Two temporary negative-value test entries were also created using:

```text
Source reference:             MIGRATION-012-NEGATIVE-ROYALTY-TEST
Currency:                     GBP
Distributable net receipts:   0.00
Royalty rate:                 null
Royalty amount:               -5.00
Author visible:               true
```

The duplicate negative test records also confirmed that `source_reference` is
not unique, as designed.

All synthetic Royalty Entries were deleted after verification.

No production royalty value was invented merely to populate the ledger.

Identity values consumed during failed constraint tests and temporary
verification were not reset.

Gaps in generated identity values are permitted and have no operational
meaning.

### Constraint verification

Migration 012 passed database-level constraint and foreign-key tests.

The sales-period constraint rejected a record containing:

```text
sales_period_start = 30 September 2026
sales_period_end   = 1 September 2026
```

The distributable-net-receipts constraint rejected:

```text
distributable_net_receipts = -1.00
```

The royalty-rate constraint rejected:

```text
royalty_rate = -0.100000
```

The royalty-amount constraint rejected:

```text
royalty_amount = 0.00
```

A negative Royalty Entry containing:

```text
royalty_amount = -5.00
```

was accepted as designed.

Foreign-key verification confirmed that the database rejected:

- a nonexistent `author_id`;
- a nonexistent `book_id`; and
- a nonexistent `edition_id`.

A valid positive synthetic Royalty Entry was then created successfully.

### Row Level Security verification

Migration 012 was tested through the temporary authenticated Author Desk RLS
diagnostic page.

The diagnostic page was extended to include:

`public.royalty_entries`

alongside the previously implemented Author Desk data domains.

The following royalty-ledger access tests passed.

#### Authenticated author

Aidan Blackwood could read the three accessible synthetic Royalty Entries
created during Migration 012 testing.

These consisted of:

- two negative-value test entries; and
- one positive cleared-royalty test entry.

Each visible record belonged to the authenticated Author Record and to
`BLACKWOOD-BOOK-001`.

#### Ordinary authenticated non-author

The ordinary authenticated non-author test account could read:

```text
0 Royalty Entries
```

The account continued to receive no Author Desk publishing or financial data.

This confirmed that ordinary authentication does not imply access to the
cleared royalty ledger.

#### Anonymous browser

Anonymous access to:

`public.royalty_entries`

was rejected with:

```text
permission denied for table royalty_entries
```

The existing Author Desk tables likewise remained unavailable anonymously.

#### Per-record visibility

The positive synthetic Royalty Entry was temporarily changed to:

```text
author_visible = false
```

The authenticated author then saw exactly two Royalty Entries:

```text
MIGRATION-012-NEGATIVE-ROYALTY-TEST
MIGRATION-012-NEGATIVE-ROYALTY-TEST
```

The hidden positive Royalty Entry remained present in the database but was not
exposed through author RLS.

The positive entry was then restored to:

```text
author_visible = true
```

and became visible to the authenticated author again.

This confirmed that Royalty Entry visibility can be controlled independently
without disrupting the wider Author Desk ownership chain.

### Cleanup verification

After all constraint and Row Level Security tests were complete, every
synthetic Migration 012 Royalty Entry was deleted.

The final cleanup verification returned:

```text
temporary_royalty_entries
0
```

No production Royalty Entry was removed because no permanent production
royalty data had been created.

Identity sequences were not reset.

### Deliberately deferred work

Migration 012 does not implement:

- Royalty Adjustments;
- Royalty Statements;
- Statement Lines;
- Payments;
- Payment Allocations;
- Payment Requests;
- automatic calculation of royalties from distributor or sales data;
- distributor import or reconciliation infrastructure;
- trusted staff/service-role write workflows;
- automatic `updated_at` triggers;
- cross-table validation that an Edition belongs to the supplied Book Record;
- immutable or append-only enforcement at database level;
- automatic Author Desk activity events; or
- production royalty data.

These remain later implementation concerns.

Migration 012 establishes the cleared royalty journal, financial ownership,
Book and optional Edition attribution, database constraints and author-read
security foundation on which the later Statement and Payment architecture can
be built.

**Migration 012 is verified.**
