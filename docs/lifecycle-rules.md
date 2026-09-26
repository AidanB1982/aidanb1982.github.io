# Blackwood Publishing — Author Desk Lifecycle Rules

**Version:** 1.0  
**Status:** Architecture Draft  
**Date:** September 2026  
**System:** Blackwood Author Desk  
**Companion Documents:** `docs/data-model.md`, `docs/permissions.md`

---

# 1. Purpose

This document defines lifecycle and state-transition rules for the Blackwood
Publishing Author Desk.

The Data Model defines what records exist.

The Permissions Model defines who may access or change them.

This document defines how those records move through time.

Its purpose is to prevent individually valid states from forming invalid
publishing combinations.

The principal lifecycle domains are:

- Author Relationship;
- Book Record;
- Production;
- Author Actions;
- Editions and Publication;
- Documents;
- Agreements;
- Rights;
- Advances;
- Royalties;
- Statements;
- Payments.

This document describes intended behaviour.

It does not yet contain SQL constraints, triggers or functions.

---

# 2. Governing Principle

Publishing records are not merely current values.

They describe processes.

A process has:

- a starting state;
- permitted transitions;
- terminal or historical states;
- events that caused transitions;
- actors responsible for those events.

The Author Desk should therefore model meaningful state changes rather than
allowing arbitrary status values to be written at any time.

---

# 3. State and History

Where a record has a current state, significant changes should normally produce
history.

Example:

CURRENT PRODUCTION STAGE

Production

HISTORY

Contracted
Editorial
Author Revision
Beta and Proof
Production

The current state answers:

"Where is the book now?"

The history answers:

"How did it get here?"

Both matter.

---

# 4. Transition Rule

A status being valid does not mean every transition into that status is valid.

For example:

`published`

may be a valid publication state.

That does not automatically mean:

`contracted -> published`

should be an ordinary production transition.

Lifecycle implementation must distinguish:

VALID VALUE

from:

VALID TRANSITION

---

# 5. Exceptional Transitions

Real publishing does not always proceed neatly.

The system must therefore permit authorised exceptional transitions where
necessary.

Examples may include:

- returning a book from Production to Editorial;
- delaying publication after Pre-publication;
- withdrawing an edition;
- correcting a statement;
- superseding an agreement.

Exceptional transitions should not require rewriting history.

They should generate an event explaining what occurred.

---

# 6. Transition Actors

Every significant state change should eventually record who or what performed
it.

Possible actors:

- Blackwood Administrator;
- Author through an authorised workflow;
- trusted system process.

For important events, record:

- previous state;
- new state;
- timestamp;
- actor;
- reason or note where appropriate.

---

# 7. Author Relationship Lifecycle

The initial relationship states are:

- prospective
- contracted
- active
- inactive
- concluded

---

# 8. Author Relationship Meaning

## prospective

Blackwood is considering or preparing a publishing relationship.

This state alone must not grant Author Desk access.

---

## contracted

A publishing agreement has been entered into and onboarding may begin.

Author Desk access may be established separately.

---

## active

The author has an active publishing relationship with Blackwood.

The author may have one or more active or historical Book Records.

---

## inactive

The relationship currently has no active operational publishing work but
historical records remain.

Inactive does not mean deleted.

---

## concluded

The formal publishing relationship has ended.

Historical Book Records, agreements, rights events, statements and payments
remain preserved according to applicable retention requirements.

---

# 9. Normal Author Relationship Transitions

Preferred progression:

prospective
    |
    v
contracted
    |
    v
active
    |
    v
inactive
    |
    v
concluded

Not every relationship must pass through every state.

For example, a contracted relationship may become concluded without a long
inactive period.

---

# 10. Author Relationship Rules

1. A prospective record does not itself create Author Desk access.
2. Contracted status should normally be supported by an agreement.
3. Active status does not imply every Book Record is currently in production.
4. Inactive status must preserve historical publishing records.
5. Concluded status must not erase contractual or financial history.
6. Reopening a relationship should create a deliberate administrative event.

---

# 11. Book Record Lifecycle

The Book Record is intended to survive the active production lifecycle.

Its operational state should not be identical to its production stage.

Suggested Book Record states:

- active
- paused
- archived

These describe the operational record.

They do not replace production or publication status.

---

# 12. Book Record State Meaning

## active

The Book Record is part of the current or continuing Blackwood publishing
record.

This may include a published backlist title.

---

## paused

Operational work is temporarily paused.

The underlying agreements and historical records remain.

---

## archived

The Book Record is no longer part of ordinary active workflow but is retained
as publishing history.

Archived does not mean deleted.

---

# 13. Book Record Rules

1. Creating a Book Record should not automatically create an Edition.
2. Creating a Book Record should not automatically create rights.
3. Creating a Book Record should not imply publication.
4. Archiving a Book Record must not delete related records.
5. Historical financial and contractual records survive Book Record archival.
6. A Book Record may contain both active and historical Editions.

---

# 14. Production Lifecycle

The canonical Blackwood production lifecycle is:

1. Contracted
2. Editorial
3. Author Revision
4. Beta and Proof
5. Production
6. Pre-publication
7. Published
8. In Print

These stages describe the publishing journey of the acquired work.

---

# 15. Production Stage Codes

Suggested internal codes:

- contracted
- editorial
- author_revision
- beta_proof
- production
- pre_publication
- published
- in_print

Display labels may differ from stored codes.

---

# 16. Contracted

Meaning:

The work has entered Blackwood's contracted publishing programme.

Typical activity:

- onboarding;
- initial planning;
- agreement recording;
- manuscript and materials collection;
- initial production scheduling.

Expected next stage:

Editorial

---

# 17. Editorial

Meaning:

The work is undergoing Blackwood's editorial process.

Typical activity:

- editorial review;
- structural work;
- line or copy editing where applicable;
- editorial discussion.

Possible next stages:

- Author Revision;
- remain in Editorial;
- exceptional return to Contracted/administrative hold.

---

# 18. Author Revision

Meaning:

The author is working on revisions arising from the editorial process.

Typical activity:

- manuscript revision;
- responding to editorial queries;
- delivering revised material.

Possible next stages:

- Editorial;
- Beta and Proof.

Returning to Editorial is legitimate where further editorial work is required.

---

# 19. Beta and Proof

Meaning:

The manuscript is undergoing appropriate beta, proof or final textual review
processes.

Typical activity:

- beta reading where applicable;
- proofreading;
- correction review;
- final text preparation.

Possible next stages:

- Author Revision;
- Editorial;
- Production.

The process may move backwards where material corrections require it.

---

# 20. Production

Meaning:

The approved text is being prepared as publication editions.

Typical activity:

- cover production;
- typesetting;
- ebook preparation;
- metadata preparation;
- ISBN assignment;
- production proofing.

Possible next stages:

- Beta and Proof;
- Pre-publication.

---

# 21. Pre-publication

Meaning:

The work is materially prepared for publication and entering release
preparation.

Typical activity:

- final metadata;
- distribution setup;
- advance copies;
- publicity preparation;
- publication scheduling;
- final files.

Possible next stages:

- Production;
- Published.

A delay may return the title to Production without destroying the earlier
Pre-publication event.

---

# 22. Published

Meaning:

The work has reached its publication date or has otherwise been formally
released.

Possible next stage:

In Print

Published should represent a meaningful publishing event.

It should not be used merely because an ISBN exists or a file has been
uploaded.

---

# 23. In Print

Meaning:

The title is an established published work within Blackwood's active catalogue
or continuing publication programme.

"In Print" may include appropriate print-on-demand and digital availability,
subject to Blackwood's contractual definition.

This stage does not imply that rights can never expire or revert.

---

# 24. Normal Production Transitions

Normal forward progression:

contracted
    |
    v
editorial
    |
    v
author_revision
    |
    v
beta_proof
    |
    v
production
    |
    v
pre_publication
    |
    v
published
    |
    v
in_print

---

# 25. Permitted Production Returns

Publishing requires controlled backwards movement.

Initially acceptable return paths include:

author_revision -> editorial

beta_proof -> author_revision

beta_proof -> editorial

production -> beta_proof

pre_publication -> production

Other backwards transitions should require explicit administrative handling.

---

# 26. Production Transition Rules

1. Every production-stage change should generate a production history event.
2. The previous history must remain intact.
3. Authors cannot directly change production stage.
4. Backwards transitions should support an explanatory note.
5. Published status should require deliberate administrative action.
6. Production stage should not be inferred from author action status.
7. Production stage should not automatically determine agreement status.
8. Production stage should not automatically determine rights status.

---

# 27. Production Holds

A production hold should not require inventing a fake production stage.

Instead, production may eventually have a separate operational flag such as:

- active
- on_hold

A book could therefore be:

Production Stage:
Editorial

Operational State:
On Hold

This preserves the distinction between where the work is in the process and
whether work is currently progressing.

The exact implementation remains for SQL design.

---

# 28. Author Action Lifecycle

Author actions are separate from production stages.

Initial action types include:

- no_action_required
- author_review_required
- signature_required
- file_available
- blackwood_action_in_progress

Operational action records may use statuses such as:

- open
- completed
- cancelled
- expired

---

# 29. Action Creation

An action is created when a specific author-facing event requires tracking.

Examples:

- review a proof;
- sign an agreement;
- download a file;
- provide information.

An action should contain enough context for the author to understand what is
required.

---

# 30. Action Open State

An open action may contain:

- title;
- description;
- related Book Record;
- action type;
- due date where applicable;
- related document;
- completion method.

An open action must not imply that the author can modify the underlying Book
Record.

---

# 31. Action Completion

An author may complete an action only where that action explicitly supports
author completion.

Completing an action may trigger a trusted process.

Example:

AUTHOR
reviews proof
    |
    v
ACTION
completed
    |
    v
BLACKWOOD
reviews resulting state

The action completion should not necessarily move the production stage
automatically.

---

# 32. Action Cancellation

Blackwood may cancel an action where it is no longer required.

Cancelled actions should normally remain in history.

Cancellation is different from completion.

---

# 33. Action Expiry

An action may expire where its valid period ends.

Expiry should not silently imply author completion.

Where expiry affects publishing workflow, Blackwood should determine the next
operational step.

---

# 34. Edition Lifecycle

Suggested Edition states:

- planned
- preparing
- scheduled
- published
- unavailable
- withdrawn
- archived

These describe a specific edition rather than the intellectual work as a whole.

---

# 35. Edition State Meaning

## planned

The edition is intended but not yet in active production.

## preparing

The edition is being produced or configured.

## scheduled

The edition has an intended publication date and is prepared for release.

## published

The edition has been released.

## unavailable

The edition temporarily cannot be supplied.

## withdrawn

Blackwood has deliberately withdrawn the edition.

## archived

The edition is retained as historical publishing data and is not part of
ordinary current operations.

---

# 36. Normal Edition Transitions

planned
   |
   v
preparing
   |
   v
scheduled
   |
   v
published

A published edition may later become:

unavailable

or:

withdrawn

Historical records remain.

---

# 37. Edition Rules

1. An Edition belongs to a Book Record.
2. An Edition may have its own ISBN.
3. An ISBN does not itself mean an Edition is published.
4. Publication date belongs to the Edition where appropriate.
5. Withdrawing one Edition does not automatically withdraw every Edition.
6. Edition history should survive withdrawal.
7. Publication status should not alter contractual rights automatically.

---

# 38. Publication Date Changes

Before publication, a scheduled publication date may change.

The current Edition may display the latest approved date.

Material date changes should be recorded in history where useful.

After publication, the historical publication date should not normally be
silently rewritten.

A correction to erroneous metadata is different from changing publishing
history.

---

# 39. Document Lifecycle

Suggested document states:

- draft
- issued
- signed
- superseded
- archived

Not every document type will use every state.

---

# 40. Draft Document

A draft document is not yet an authoritative issued record.

Examples:

- draft agreement;
- draft statement;
- proof awaiting approval.

Drafts may normally be replaced or revised.

Authors should only see drafts where Blackwood deliberately makes them
author-visible.

---

# 41. Issued Document

An issued document has been formally provided as a publishing record.

Examples may include:

- issued royalty statement;
- formal author-facing production document.

Issued documents require stronger historical protection than drafts.

---

# 42. Signed Document

A signed document records an executed agreement or other signed instrument.

Once signed:

- the file must not be silently overwritten;
- the historical document must remain accessible according to permissions;
- later changes should use amendments or replacement agreements.

---

# 43. Superseded Document

A superseded document has been replaced for current operational purposes but
remains part of history.

Example:

Agreement v1
    |
    +-- Amendment
    |
    +-- Replacement Agreement

Superseded does not mean deleted.

---

# 44. Archived Document

An archived document is retained but removed from ordinary current workflow.

Archival must not be used to conceal records that remain relevant to rights,
finance or contractual history.

---

# 45. Document Transition Rules

1. Draft documents may be revised.
2. Issued documents should not be silently overwritten.
3. Signed documents should not be silently overwritten.
4. Superseding a document must preserve the earlier record.
5. Historical documents should retain issue/signature dates.
6. File storage changes must not destroy document identity.
7. Document state must not be inferred merely from file existence.

---

# 46. Agreement Lifecycle

Suggested agreement states:

- draft
- awaiting_signature
- active
- expired
- terminated
- superseded

---

# 47. Agreement Draft

The agreement is being prepared.

It is not yet an executed publishing agreement.

Draft agreement information may change.

---

# 48. Awaiting Signature

The agreement has reached a form intended for execution and awaits required
signature activity.

This state must not be treated as equivalent to active.

---

# 49. Active Agreement

The agreement has been executed and is currently operative according to its
terms.

An active agreement should reference the signed authoritative document.

---

# 50. Expired Agreement

The contractual term has ended according to the agreement.

Expiry does not erase:

- historical rights;
- statements;
- payments;
- prior publication history;
- contractual documents.

---

# 51. Terminated Agreement

The agreement ended before ordinary expiry under its contractual provisions or
another valid arrangement.

The reason and effective date should be recorded.

Termination must not erase historical records.

---

# 52. Superseded Agreement

A later agreement has replaced the agreement for current purposes.

The earlier agreement remains historical.

The replacement relationship should be explicit.

---

# 53. Normal Agreement Transitions

draft
   |
   v
awaiting_signature
   |
   v
active
   |
   +--------> expired
   |
   +--------> terminated
   |
   +--------> superseded

---

# 54. Agreement Rules

1. Draft is not active.
2. Awaiting signature is not active.
3. Active should require an executed agreement.
4. Signed agreement files must be preserved.
5. Expiry must not delete the agreement.
6. Termination must preserve the reason/effective date.
7. Supersession must link old and new records.
8. Agreement state changes may affect rights but must not silently rewrite
   rights history.
9. The signed legal document remains authoritative.

---

# 55. Agreement Amendment

An amendment should not require changing the original signed agreement.

Suggested relationship:

AGREEMENT
    |
    +-- AMENDMENT 1
    |
    +-- AMENDMENT 2

Each amendment should have:

- its own identity;
- date;
- signed document where applicable;
- relationship to the original agreement.

The current plain-English summary may incorporate the amended position while
the legal document chain remains intact.

---

# 56. Rights Lifecycle

A rights record represents an express right licensed to Blackwood.

Suggested rights states:

- granted
- active
- sublicensed
- expired
- reverted
- terminated

The exact vocabulary may be refined during SQL design.

---

# 57. Rights Grant

A right should enter the system only where supported by the relevant agreement
or other valid rights instrument.

The system must not infer rights from:

- publication;
- ISBN assignment;
- Book Record creation;
- Edition creation;
- author account creation.

---

# 58. Active Right

An active right is a right currently licensed to Blackwood according to the
relevant agreement.

Its scope may include:

- format;
- language;
- territory;
- exclusivity;
- term.

---

# 59. Sublicensed Right

Where Blackwood has contractual authority to exploit a subsidiary right through
a third party, the activity should be recorded.

Sublicensing does not erase the underlying grant.

Material sublicence records should remain connected to:

- the right;
- the agreement;
- the Book Record;
- relevant income where applicable.

---

# 60. Expired Right

A right may expire when the relevant contractual term ends.

Expiry should preserve the historical period during which Blackwood held the
right.

---

# 61. Reverted Right

A reverted right has returned to the author according to the agreement or a
subsequent written arrangement.

The reversion event should record:

- effective date;
- affected right;
- relevant document;
- reason or mechanism where appropriate.

Reversion must not erase historical exploitation.

---

# 62. Rights Transition Rules

Possible progression:

granted
   |
   v
active
   |
   +--------> sublicensed
   |
   +--------> expired
   |
   +--------> reverted
   |
   +--------> terminated

A sublicensed right may remain active underneath the sublicence relationship.

Therefore sublicensing may ultimately be better represented as a related event
or entity rather than a mutually exclusive status.

This will be decided during SQL design.

---

# 63. Rights Rules

1. Rights must have documentary authority.
2. Rights scope must be explicit.
3. Rights not granted must not be inferred.
4. Rights changes create history.
5. Reversion does not delete prior rights history.
6. Agreement expiry and rights expiry are related but not assumed identical.
7. A Book Record may continue historically after rights revert.
8. Author-facing summaries are informational.
9. Signed agreements remain authoritative.

---

# 64. Advance Lifecycle

Suggested advance states:

- agreed
- payable
- paid
- recouping
- earned_out

Not every agreement includes an advance.

---

# 65. Advance Agreed

An advance has been contractually agreed.

This does not necessarily mean it has been paid.

---

# 66. Advance Payable

The contractual conditions for payment have been satisfied and payment is due.

---

# 67. Advance Paid

The advance payment has been made.

The payment event should be separately recorded.

---

# 68. Advance Recouping

Author royalties are being applied against the unrecouped advance according to
the agreement.

Recoupment reduces the remaining advance balance.

It does not mean the author is repaying Blackwood from unrelated personal
funds.

---

# 69. Advance Earned Out

Qualifying author royalties have fully recouped the advance.

Subsequent qualifying cleared royalties may become payable according to the
agreement.

---

# 70. Advance Rules

1. No advance record should exist unless an advance applies.
2. Agreed does not mean paid.
3. Paid should correspond to an actual payment event.
4. Recoupment must follow the agreement.
5. Remaining balance must be calculable from recorded activity.
6. Earned-out status should arise from financial records rather than arbitrary
   manual declaration where practical.
7. An unearned advance must not automatically be represented as author debt.

---

# 71. Financial Lifecycle Overview

The financial lifecycle should separate:

SOURCE ACTIVITY
      |
      v
RECEIPT / REPORTING
      |
      v
RECONCILIATION
      |
      v
ROYALTY CALCULATION
      |
      v
CLEARED AUTHOR ROYALTY
      |
      +------> ADVANCE RECOUPMENT where applicable
      |
      v
STATEMENT
      |
      v
PAYABLE BALANCE
      |
      v
PAYMENT REQUEST / PAYMENT PROCESS
      |
      v
PAID

These stages must not be collapsed into one generic status.

---

# 72. Source Activity

Source activity may originate from:

- distributor reports;
- retailer reports;
- direct sales;
- subsidiary-rights income;
- other qualifying receipts.

Source activity is not automatically a cleared author royalty.

---

# 73. Receipt and Reporting

A sales or income report may describe activity before Blackwood has actually
received and reconciled the relevant funds.

Reported activity must therefore remain distinct from payable author income.

---

# 74. Reconciliation

Reconciliation establishes that the relevant financial information and receipt
have been sufficiently matched and classified for accounting purposes.

Unreconciled information must not be shown as withdrawable author money.

---

# 75. Royalty Calculation

The contractual royalty calculation may depend upon:

- title;
- Edition;
- channel;
- format;
- Distributable Net Receipts;
- royalty rate;
- advance position;
- contractual deductions where expressly applicable.

The calculation should be traceable.

---

# 76. Cleared Author Royalty

A royalty becomes author-facing as cleared income only after Blackwood has
received, reconciled and classified the relevant amount as payable or
allocatable to the author's account.

The governing Author Desk principle is:

"If you can see it, you can withdraw it."

Accordingly:

- estimated royalties are not cleared;
- pending retailer income is not cleared;
- unreconciled reports are not cleared;
- expected future receipts are not cleared.

---

# 77. Cleared Royalty Statuses

Suggested states:

- cleared
- allocated_to_statement
- payable
- payment_requested
- paid
- adjusted

These states may be refined during SQL design.

---

# 78. Cleared

The royalty amount has been confirmed as part of the author's financial record.

It may still need statement allocation or advance treatment.

---

# 79. Allocated to Statement

The royalty entry has been included in a formal royalty statement.

The link to the statement should be explicit.

---

# 80. Payable

The amount is eligible for payment to the author according to the agreement and
current financial position.

Where an advance remains unrecouped, otherwise qualifying royalties may instead
be applied to recoupment.

---

# 81. Payment Requested

Where Author Desk withdrawal requests are enabled, the author has requested
settlement of eligible payable funds.

This state must reserve or otherwise protect the requested balance against
duplicate withdrawal.

The exact financial locking mechanism will be designed later.

---

# 82. Paid

The royalty amount has been settled through a completed payment allocation.

Paid history must not be silently reversed.

A genuine correction should use an adjustment or reversal mechanism.

---

# 83. Adjusted

A financial correction has affected the original royalty record.

The original historical entry should remain traceable.

The adjustment should explain the change.

---

# 84. Royalty Rules

1. Authors cannot create royalty entries.
2. Authors cannot alter royalty amounts.
3. Unreconciled data is not author payable.
4. Cleared entries require traceable source information.
5. Advance recoupment must be represented separately.
6. Statement allocation must be traceable.
7. Payment allocation must be traceable.
8. Corrections use adjustments rather than silent rewriting.
9. Paid records remain historical.
10. The same eligible balance must not be paid twice.

---

# 85. Royalty Statement Lifecycle

Suggested statement states:

- preparing
- issued
- corrected
- superseded

---

# 86. Statement Preparing

The statement is being assembled or reviewed.

It is not yet the formal author statement.

Draft statement values may change.

The author does not automatically receive access to a preparing statement.

---

# 87. Statement Issued

The statement has been formally issued.

At issue:

- statement number should be established;
- statement period should be established;
- financial lines should be fixed;
- issue date should be recorded;
- author-facing document should be retained.

An issued statement becomes historical accounting evidence.

---

# 88. Statement Corrected

A material correction has been required.

The correction should not silently overwrite the issued statement.

The original statement remains retained.

The corrected statement should identify its relationship to the original.

---

# 89. Statement Superseded

A replacement statement has become the current authoritative statement for the
relevant purpose.

The superseded statement remains historical.

---

# 90. Statement Rules

1. Preparing statements may change.
2. Issued statements should become immutable or strongly controlled.
3. Statement lines must correspond to the issued statement.
4. Corrections preserve the original.
5. Statement numbers should not be casually reused.
6. Statement issue does not itself prove payment.
7. Early payment does not replace formal statement history.
8. Formal statements remain part of the author's permanent publishing record.

---

# 91. Payment Lifecycle

Suggested payment states:

- available
- requested
- approved
- processing
- paid
- failed
- cancelled

Not every payment must necessarily pass through an author request.

For example, Blackwood may initiate scheduled or contractual payment.

---

# 92. Available

Eligible cleared funds exist for settlement.

This may be a calculated state rather than a stored Payment record.

The SQL design will determine the implementation.

---

# 93. Requested

The author has requested payment of an eligible amount.

A request must not exceed the eligible balance.

The requested amount should be protected against duplicate requests.

---

# 94. Approved

Blackwood has approved the payment for processing.

Approval does not mean the payment has completed.

---

# 95. Processing

The payment has entered the actual payment process.

This may eventually involve:

- manual bank processing;
- accounting software;
- payment provider;
- another approved mechanism.

---

# 96. Paid

The payment has completed.

A paid payment should record:

- amount;
- currency;
- payment date;
- payment reference;
- relevant allocations.

A completed payment is historical.

---

# 97. Failed

The payment attempt did not complete.

Failure must not cause the underlying eligible royalty balance to disappear.

The exact release/retry mechanism will be designed during financial
implementation.

---

# 98. Cancelled

The payment or payment request was cancelled before completion.

Cancellation must not masquerade as payment.

Eligible funds may become available again where appropriate.

---

# 99. Normal Requested-Payment Transitions

available
    |
    v
requested
    |
    v
approved
    |
    v
processing
    |
    +--------> paid
    |
    +--------> failed

A request may also become:

cancelled

before completed payment.

---

# 100. Payment Rules

1. A request cannot create money.
2. A request cannot exceed eligible funds.
3. Authors cannot approve their own payment.
4. Approved does not mean paid.
5. Processing does not mean paid.
6. Paid requires a completed payment event.
7. Failed payment must not destroy the underlying entitlement.
8. Cancelled requests must not remain reserved indefinitely.
9. Payment allocations must prevent double settlement.
10. Completed payments must remain historical.

---

# 101. Payment Without Author Request

Blackwood may need to pay an author without an Author Desk withdrawal request.

The lifecycle must therefore support:

eligible funds
    |
    v
Blackwood initiated payment
    |
    v
approved / processing
    |
    v
paid

The existence of payment requests must not make them the only legitimate route
to settlement.

---

# 102. Cross-Lifecycle Rules

Individual lifecycle domains must remain related without being incorrectly
collapsed together.

Examples:

An agreement may be active while a Book Record is archived.

A Book Record may be active while one Edition is withdrawn.

A title may be Published while a new Edition is still Preparing.

A right may revert while historical royalty statements remain available.

A production action may be completed without automatically advancing the
production stage.

A royalty statement may be issued before the associated payment occurs.

These combinations are legitimate.

---

# 103. Invalid Assumptions

The system must not assume:

`agreement active`
means
`book published`

or:

`book published`
means
`all editions published`

or:

`statement issued`
means
`payment completed`

or:

`royalty calculated`
means
`money withdrawable`

or:

`author action completed`
means
`production stage advanced`

or:

`rights expired`
means
`Book Record deleted`

or:

`relationship concluded`
means
`financial history removed`

---

# 104. Event History

Significant lifecycle transitions should eventually generate event records.

Potential event types include:

- author_relationship_changed;
- production_stage_changed;
- production_hold_started;
- production_hold_ended;
- author_action_created;
- author_action_completed;
- edition_scheduled;
- edition_published;
- edition_withdrawn;
- document_issued;
- document_signed;
- agreement_activated;
- agreement_expired;
- agreement_terminated;
- right_granted;
- right_reverted;
- royalty_cleared;
- royalty_adjusted;
- statement_issued;
- statement_corrected;
- payment_requested;
- payment_approved;
- payment_paid;
- payment_failed.

Exact event codes will be decided during implementation.

---

# 105. Event Requirements

Important lifecycle events should record, where relevant:

- entity type;
- entity ID;
- previous state;
- new state;
- actor;
- timestamp;
- author-visible description;
- internal description;
- supporting document or reference.

Event history should not depend entirely on free-text notes.

---

# 106. Current State Reconstruction

Where practical, important current states should be reconcilable with their
history.

For example:

Book Record current production stage:
Production

Latest production transition:
Beta and Proof -> Production

If these disagree unexpectedly, the system should treat that as a data
integrity problem.

The exact database strategy may use:

- controlled update functions;
- triggers;
- transactional writes;
- derived current state.

This remains for SQL design.

---

# 107. Transactional Changes

Some lifecycle transitions require several records to change together.

Example:

ISSUE ROYALTY STATEMENT

may require:

1. create/finalise statement;
2. freeze statement lines;
3. link royalty entries;
4. change royalty allocation state;
5. store statement document;
6. create audit event.

Those operations should eventually occur through a controlled transactional
process rather than unrelated browser updates.

---

# 108. Idempotency

Sensitive system operations should be designed so accidental repeated requests
do not create duplicate outcomes.

Examples:

- issuing the same statement twice;
- recording the same payment twice;
- completing the same author action twice;
- granting the same right twice;
- generating duplicate payment allocations.

Exact idempotency mechanisms will be defined during implementation.

---

# 109. Timestamps

Important lifecycle timestamps should be explicit.

Examples:

- contracted_at;
- stage_changed_at;
- action_completed_at;
- edition_published_at;
- agreement_signed_at;
- agreement_expired_at;
- right_reverted_at;
- royalty_cleared_at;
- statement_issued_at;
- payment_requested_at;
- payment_paid_at.

`updated_at` alone is not sufficient historical evidence.

---

# 110. Date Versus Timestamp

The SQL design should distinguish between:

DATE

and:

TIMESTAMPTZ

according to meaning.

Examples likely suited to DATE:

- publication date;
- statement period start;
- statement period end.

Examples likely suited to TIMESTAMPTZ:

- payment request created;
- document issued;
- action completed;
- system event created.

Exact choices will be made during schema design.

---

# 111. Author-Facing Status Language

Internal state codes and author-facing language do not need to be identical.

Example:

Internal:

`beta_proof`

Author Desk:

`Beta and Proof`

Internal:

`pre_publication`

Author Desk:

`Pre-publication`

This allows stable machine-readable values without sacrificing clear language.

---

# 112. Status Language Principle

Author-facing status text should be:

- clear;
- calm;
- factual;
- specific.

Avoid gamified or exaggerated language.

The Author Desk is a publishing record, not a progress game.

---

# 113. Terminal States

A terminal state means the current lifecycle process has ended.

It does not mean the record can be deleted.

Examples may include:

- concluded relationship;
- expired agreement;
- terminated agreement;
- reverted right;
- withdrawn Edition;
- paid payment;
- cancelled action.

Terminal records remain part of history.

---

# 114. Reopening Terminal States

Reopening a terminal state should be exceptional.

Where legitimate new activity occurs, creating a new related record may be
better than mutating the old one.

Examples:

A new agreement may be preferable to reactivating an expired agreement.

A new payment attempt may be preferable to rewriting a failed historical
payment.

A new author action may be preferable to reopening a completed action.

The correct approach depends on the domain.

---

# 115. Historical Correction Principle

There is a difference between:

correcting erroneous data

and:

rewriting history.

Example:

An ISBN was mistyped.

Correcting the typo may be appropriate.

But:

A royalty statement was issued with an incorrect amount.

Silently changing the issued statement is not appropriate.

The second case requires a correction process that preserves what was
originally issued.

---

# 116. Cancellation Principle

Cancellation means:

"This process did not complete."

It must not mean:

"This process never existed."

Cancelled operational records may remain historically relevant.

---

# 117. Archival Principle

Archival means:

"This record is no longer part of ordinary active workflow."

It must not mean:

"Hide or destroy the historical record."

Archived publishing data may still be required for:

- rights history;
- accounting;
- author reference;
- legal record;
- backlist history.

---

# 118. Deletion Principle

Lifecycle transitions should solve most ordinary record-management needs without
hard deletion.

Hard deletion is not a lifecycle state.

It is a data-management operation reserved for exceptional circumstances.

---

# 119. Author Notification

Some lifecycle events may eventually trigger author notification.

Possible examples:

- author action created;
- proof available;
- agreement ready for signature;
- publication date materially changed;
- statement issued;
- payment completed.

Notification behaviour is not part of v1 lifecycle implementation.

The underlying events should nevertheless be designed so notifications can be
added later without restructuring the core data model.

---

# 120. Blackwood Notification

Some author-driven events may eventually notify Blackwood.

Examples:

- author completes review;
- author signs document;
- author submits requested information;
- author requests payment.

Again, notification delivery is separate from the lifecycle event itself.

---

# 121. Failure States

External operations can fail.

Examples:

- file generation;
- document delivery;
- payment processing;
- email delivery;
- external accounting integration.

Failure should not create a false successful lifecycle state.

For example:

A payment provider request being sent does not mean:

`paid`

The system should record success only when the required success condition has
actually occurred.

---

# 122. SQL Enforcement Direction

Not every lifecycle rule must necessarily be implemented as a database CHECK
constraint.

Possible enforcement mechanisms include:

- CHECK constraints;
- foreign keys;
- controlled enums or reference tables;
- database functions;
- triggers;
- Edge Functions;
- application workflows;
- transactional RPCs.

The mechanism should match the importance and complexity of the rule.

---

# 123. Rules Suitable for Strong Database Enforcement

Likely examples include:

- valid state values;
- required ownership relationships;
- foreign-key integrity;
- unique statement numbers;
- non-negative financial constraints where appropriate;
- valid currency codes where adopted;
- unique payment references where appropriate.

---

# 124. Rules Likely Requiring Controlled Functions

Examples may include:

- production stage transition plus history event;
- agreement activation;
- rights reversion;
- statement issuance;
- royalty adjustment;
- payment request creation;
- payment completion;
- document supersession.

These operations affect multiple records and should not rely on unrelated
client writes.

---

# 125. Lifecycle Acceptance Tests

Before implementation is considered complete, the system should prove the
following behaviours.

### Production

A normal forward transition succeeds.

A permitted backwards transition succeeds and records history.

An unauthorised author transition fails.

History remains after current state changes.

### Actions

An author can complete an eligible own action.

An author cannot complete another author's action.

Completion does not unexpectedly alter production state.

### Agreements

Draft can progress to awaiting signature.

Executed agreement can become active.

Signed agreement cannot be silently replaced.

Expired agreement remains accessible historically.

### Rights

Rights cannot exist without appropriate authority/reference.

Rights reversion creates history.

Reversion does not delete prior exploitation history.

### Statements

Preparing statement may change.

Issued statement becomes controlled.

Correction preserves the original.

Statement issue does not falsely mark payment complete.

### Payments

Request cannot exceed eligible balance.

Duplicate payment cannot settle the same balance twice.

Failed payment does not destroy entitlement.

Paid record remains historical.

---

# 126. Invalid-State Tests

The implementation should deliberately attempt invalid combinations.

Examples:

- author directly changes production stage;
- author directly grants Blackwood a right;
- unsigned draft agreement marked active without required process;
- statement marked paid without payment record;
- payment exceeds eligible balance;
- same royalty entry allocated twice;
- deleted agreement with surviving active rights;
- withdrawn Edition causing unrelated Editions to disappear.

The database/application should reject or safely handle these cases.

---

# 127. v1 Lifecycle Decisions

The following are established for v1:

1. Production has a controlled lifecycle.
2. Production history is retained.
3. Controlled backwards production transitions are permitted.
4. Author actions are separate from production stage.
5. Book Record state is separate from production stage.
6. Edition state is separate from Book Record state.
7. Agreement state is separate from rights state.
8. Signed agreements are historical records.
9. Rights require express authority.
10. Rights reversion preserves history.
11. Financial reporting and payable royalties are separate.
12. Only cleared amounts become author-facing payable income.
13. Statements and payments are separate events.
14. Issued statements are historical.
15. Completed payments are historical.
16. Corrections use adjustments or superseding records.
17. Significant transitions should record actor and time.
18. Terminal state does not mean deletion.
19. Sensitive multi-record transitions should use controlled processes.
20. The same financial entitlement must not be settled twice.

---

# 128. Decisions Reserved for SQL Design

The following remain deliberately unresolved:

- exact enum versus lookup-table implementation;
- whether current production state is stored or derived;
- exact production hold implementation;
- exact transition enforcement mechanism;
- exact agreement-signature workflow;
- sublicence entity design;
- advance recoupment calculation implementation;
- financial import architecture;
- exact payable-balance calculation;
- payment reservation/locking mechanism;
- statement numbering;
- multi-currency behaviour;
- transactional RPC design;
- audit trigger design;
- notification implementation;
- external accounting integration.

These must be decided deliberately during implementation.

---

# 129. Lifecycle Review Rule

Every new lifecycle feature must answer:

1. What state does the record begin in?
2. What states may follow?
3. Which transitions are normal?
4. Which transitions are exceptional?
5. Who may perform each transition?
6. What history must be preserved?
7. Does the transition affect another domain?
8. Must several records change transactionally?
9. Can the operation safely be repeated?
10. What proves the transition actually succeeded?

If those questions cannot be answered, the lifecycle is not ready to be
implemented.

---

# 130. Final Principle

The Author Desk should present publishing progress simply without pretending
publishing itself is simple.

An author may see:

Editorial

or:

Statement Issued

or:

Payment Paid

Behind those few words must be a reliable record of:

what happened,
when it happened,
who caused it,
what came before,
what may happen next,
and what must never be silently rewritten.

That history is what turns a dashboard into a publishing record.
