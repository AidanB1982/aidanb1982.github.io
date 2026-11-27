"use strict";
/*
 * Blackwood Publishing acquisition process — pure decision model.
 * The public submissions page is CLOSED. This file cannot accept manuscripts,
 * write cases, sign contracts, grant Author Desk access or send messages.
 */
(function (root) {
  const SUBMISSION = Object.freeze([
    ["received", "Submission received", "Only after approved secure intake records a manuscript. Receipt does not imply acceptance."],
    ["eligibility", "Eligibility check", "Confirm the published window criteria, requested materials, authorship and AI disclosures."],
    ["initial_read", "Initial manuscript read", "Record the editor's assessment and any missing information."],
    ["acquisition_note", "Acquisition note", "Record why the work belongs on the list and how Blackwood will support it."],
    ["editorial_discussion", "Editorial discussion", "Assess the professional editorial programme and the author's revision needs."],
    ["commercial_review", "Commercial and title P&L review", "Assess editorial, design, printing, marketing, capacity and channel economics."],
    ["rights_review", "Rights review", "Verify availability and scope of rights without assuming ownership transfers."],
    ["author_fit", "Author-fit review", "Consider the relationship and whether Blackwood can support the author responsibly."],
    ["acquisition_decision", "Acquisition decision", "Publisher decides: decline, request information or approve an offer review."],
  ]);
  const OFFER = Object.freeze([
    ["offer_review", "Offer readiness review", "For direct invitations or approved submissions: verify editorial case, P&L, rights and acquisition decision."],
    ["offer_authorised", "Offer authorised", "Publisher has approved a proposed offer; no agreement is signed yet."],
    ["heads_of_terms", "Heads of Terms", "Discuss scope, formats, territory, term, obligations, payment and reversion terms."],
    ["terms_agreed", "Terms agreed in principle", "Confirm the outline, while preserving the distinction from a publishing contract."],
    ["contract_prepared", "Publishing agreement prepared", "Prepare contract-specific terms and rights schedule for professional review."],
    ["contract_issued", "Agreement issued for signing", "Record the approved version and pending author/publisher signatures."],
    ["signed_verified", "Signed agreement verified", "Verify the actual signed agreement and both parties' obligations."],
    ["author_record", "Author Record confirmed", "Verify the author identity, named publishing contact and contractual relationship."],
    ["book_record", "Book Record confirmed", "Link the verified agreement to existing author and Book Records and agreed publishing rights."],
    ["desk_access", "Author Desk access verified", "Independently test the author's existing per-book access and confidentiality permissions."],
    ["welcome", "Welcome Pack and Author Desk introduction", "Personalise the pack, explain the portal and identify the next author action."],
    ["editorial_handover", "Editorial handover", "Confirm editor, manuscript materials and first agreed production milestone."],
  ]);
  const PRODUCTION = Object.freeze([
    "Contracted", "Editorial", "Author revision", "Beta and proof",
    "Production", "Pre-publication", "Published", "In print",
  ]);
  const GATES = Object.freeze({
    eligibility: ["secureReceiptVerified"],
    initial_read: ["eligibilityReviewed"],
    acquisition_note: ["initialReadRecorded"],
    editorial_discussion: ["acquisitionRationaleRecorded"],
    commercial_review: ["editorialReviewRecorded"],
    rights_review: ["titleEconomicsReviewed"],
    author_fit: ["rightsPositionReviewed"],
    acquisition_decision: ["authorFitReviewed"],
    offer_authorised: ["editorialApproved","commercialApproved","rightsApproved","acquisitionDecisionApproved"],
    heads_of_terms: ["offerApprovedByPublisher"],
    terms_agreed: ["headsOfTermsReviewedWithAuthor"],
    contract_prepared: ["headsOfTermsAgreedInPrinciple"],
    contract_issued: ["contractVersionReviewed","contractRightsScheduleVerified"],
    signed_verified: ["signedAgreementIndependentlyVerified"],
    author_record: ["signedAgreementIndependentlyVerified","authorIdentityVerified"],
    book_record: ["authorRecordLinked","signedAgreementIndependentlyVerified"],
    desk_access: ["bookRecordLinked","authorIdentityVerified","accessIndependentlyTested"],
    welcome: ["deskAccessVerified","namedPublishingContactConfirmed","welcomePackPrepared"],
    editorial_handover: ["welcomeProvided","firstEditorialMilestoneRecorded"],
    declined: ["declineDecisionRecorded"],
    information_requested: ["informationRequestRecorded"],
    withdrawn: ["withdrawalRecorded"],
  });
  const PUBLIC = Object.freeze({
    submissions: "/pages/submissions.html",
    charter: "/pages/author-charter.html",
    desk: "/pages/authordesk.html",
  });
  function stages(journey) {
    return journey === "submission" ? SUBMISSION : journey === "offer" ? OFFER : [];
  }
  function next(journey, stage) {
    const ids = stages(journey).map(step => step[0]);
    const index = ids.indexOf(stage);
    if (index < 0 || stage === "withdrawn" || stage === "declined") return [];
    if (journey === "submission") {
      if (stage === "acquisition_decision") return ["offer_review","declined","information_requested"];
      if (stage === "information_requested") return ["eligibility","withdrawn"];
      return [ids[index + 1], "withdrawn"].filter(Boolean);
    }
    return [ids[index + 1]].filter(Boolean);
  }
  function requirements(stage) { return (GATES[stage] || []).slice(); }
  function verifyTransition(journey, from, to, evidence) {
    const special = journey === "submission" && from === "acquisition_decision"
      && to === "offer_review";
    const follow = special || next(journey,from).includes(to);
    if (!follow) return { allowed: false, missing: [], reason: "That stage transition is not permitted." };
    const required = special ? GATES.offer_authorised : requirements(to);
    const missing = required.filter(key => !evidence || evidence[key] !== true);
    return missing.length
      ? { allowed: false, missing, reason: "Verified supporting evidence and publisher approval are required." }
      : { allowed: true, missing: [], reason: "Eligible for a publisher-recorded decision; no external action is performed." };
  }
  function mayReceiveSubmission(open, secureIntake) {
    return open === true && secureIntake === true;
  }
  function readyForOffer(evidence) {
    return GATES.offer_authorised.every(key => evidence && evidence[key] === true);
  }
  const api = Object.freeze({ SUBMISSION, OFFER, PRODUCTION, PUBLIC, stages, next, requirements, verifyTransition, mayReceiveSubmission, readyForOffer });
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BlackwoodAcquisitionWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
