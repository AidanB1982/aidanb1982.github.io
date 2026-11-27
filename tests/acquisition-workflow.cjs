"use strict";
const assert = require("node:assert/strict");
const flow = require("../js/blackwood-acquisition-workflow.js");

assert.equal(flow.PUBLIC.submissions, "/pages/submissions.html");
assert.equal(flow.PUBLIC.charter, "/pages/author-charter.html");
assert.equal(flow.PUBLIC.desk, "/pages/authordesk.html");
assert.equal(flow.mayReceiveSubmission(false, true), false, "closed intake denies submission");
assert.equal(flow.mayReceiveSubmission(true, false), false, "unsecured intake denies submission");
assert.equal(flow.mayReceiveSubmission(true, true), true, "only independently approved secure intake can receive");

const submission = flow.stages("submission").map(x => x[0]);
assert.deepEqual(submission, [
 "received","eligibility","initial_read","acquisition_note","editorial_discussion",
 "commercial_review","rights_review","author_fit","acquisition_decision",
]);
const offers = flow.stages("offer").map(x => x[0]);
assert.deepEqual(offers, [
 "offer_review","offer_authorised","heads_of_terms","terms_agreed","contract_prepared",
 "contract_issued","signed_verified","author_record","book_record","desk_access",
 "welcome","editorial_handover",
]);
assert.deepEqual(flow.PRODUCTION, [
 "Contracted","Editorial","Author revision","Beta and proof","Production",
 "Pre-publication","Published","In print",
]);
assert.deepEqual(flow.next("submission","acquisition_decision"), [
 "offer_review","declined","information_requested",
]);
assert.deepEqual(flow.next("submission","information_requested"),["eligibility","withdrawn"]);
assert.deepEqual(flow.next("submission","declined"),[]);
assert.deepEqual(flow.next("offer","editorial_handover"),[]);
assert.deepEqual(flow.next("offer","terms_agreed"),["contract_prepared"]);

const allOfferProofs = {
 editorialApproved: true, commercialApproved: true, rightsApproved: true,
 acquisitionDecisionApproved: true,
};
assert.equal(flow.readyForOffer(null),false);
assert.equal(flow.readyForOffer({editorialApproved:true}),false);
assert.equal(flow.readyForOffer(allOfferProofs),true);
assert.deepEqual(flow.verifyTransition("submission","acquisition_decision","offer_review",allOfferProofs),{
 allowed:true,missing:[],reason:"Eligible for a publisher-recorded decision; no external action is performed.",
});
assert.deepEqual(flow.verifyTransition("submission","acquisition_decision","offer_review",{}).missing,
 ["editorialApproved","commercialApproved","rightsApproved","acquisitionDecisionApproved"]);
assert.equal(flow.verifyTransition("offer","offer_review","offer_authorised",{}).allowed,false);
assert.equal(flow.verifyTransition("offer","offer_review","offer_authorised",allOfferProofs).allowed,true);
assert.equal(flow.verifyTransition("offer","terms_agreed","contract_issued",allOfferProofs).allowed,false,"cannot skip contract preparation");
assert.equal(flow.verifyTransition("offer","contract_issued","signed_verified",{}).allowed,false,"unsigned contracts never become signed");
assert.equal(flow.verifyTransition("offer","contract_issued","signed_verified",{signedAgreementIndependentlyVerified:true}).allowed,true);
assert.equal(flow.verifyTransition("offer","signed_verified","author_record",{}).allowed,false);
assert.equal(flow.verifyTransition("offer","book_record","desk_access",{bookRecordLinked:true}).allowed,false,"linking book does not grant desk");
assert.equal(flow.verifyTransition("offer","book_record","desk_access",{
 bookRecordLinked:true,authorIdentityVerified:true,accessIndependentlyTested:true,
}).allowed,true,"desk introduction requires verified access");
assert.equal(flow.verifyTransition("offer","desk_access","welcome",{deskAccessVerified:true}).allowed,false,"portal verification alone does not mean welcome given");
assert.equal(flow.verifyTransition("offer","desk_access","welcome",{
 deskAccessVerified:true,namedPublishingContactConfirmed:true,welcomePackPrepared:true,
}).allowed,true);
assert.equal(flow.verifyTransition("offer","welcome","editorial_handover",{welcomeProvided:true}).allowed,false);
assert.equal(flow.verifyTransition("offer","welcome","editorial_handover",{
 welcomeProvided:true,firstEditorialMilestoneRecorded:true,
}).allowed,true);
assert.equal(flow.verifyTransition("offer","welcome","contract_prepared",{}).allowed,false,"no backwards contract steps");
assert.equal(flow.verifyTransition("unknown","received","signed_verified",{}).allowed,false);
console.log("PASS: two Blackwood Publishing workflows, closed submissions, evidence gates, contract and Author Desk protections");
