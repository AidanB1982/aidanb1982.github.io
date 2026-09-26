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

### Migration 001 — Author Records

**Implemented:** 26 September 2026  
**Status:** Verified

The first Author Desk database object implemented in Supabase is:

`public.author_records`

Its purpose is to establish the authenticated publishing identity used by the Author Desk while keeping that identity separate from the existing Archivist / reader profile.

Current identity structure:

```text
auth.users
   ├── member_profiles
   │      └── Archivist / reader identity
   │
   └── author_records
          └── Author Desk publishing identity
