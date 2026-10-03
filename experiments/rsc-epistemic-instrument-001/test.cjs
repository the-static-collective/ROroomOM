'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('./core.js');

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixture-rsc-reseed.json'), 'utf8')
);
const receiptFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixture-ghot-receipt.json'), 'utf8')
);

function expectThrow(fn, contains) {
  let threw = false;
  try { fn(); } catch (err) {
    threw = true;
    if (contains) assert(String(err.message).includes(contains), err.message);
  }
  assert(threw, 'Expected function to throw');
}

const parsed = core.validateReseed(fixture);
assert.equal(parsed.recommendations.length, 2);
assert.equal(parsed.recommendations[0].selection_status, 'recommendation-only');

const prepared = core.prepareSelection(fixture, {
  crossing_id: 'epistemic-capability-contract',
  capability: 'listen.analyze',
  context_posture: 'fresh',
  destination: 'ghot://worker/fresh',
  supplied_context_keys: ['current_track'],
  forbidden_context_keys: ['catalog_history', 'prior_dj_transcripts']
});
assert.equal(prepared.status, 'prepared');
assert.equal(prepared.execution_requested, false);
assert.equal(prepared.authority, 'none');

expectThrow(
  () => core.confirmSelection(prepared, { explicit: false }),
  'Explicit human selection is required'
);

const selected = core.confirmSelection(prepared, {
  explicit: true,
  note: 'Use the fresh listener posture for the first bounded specimen.'
});
assert.equal(selected.status, 'selected');
assert.equal(selected.selected_by, 'local-human');
assert.equal(selected.execution_requested, false);

const parcel = core.buildExecutionParcel(
  selected,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);
assert.equal(parcel.request.context_posture, 'fresh');
assert.equal(parcel.execution_authority, 'destination-local');
assert.equal(
  parcel.request.context_manifest.supplied_context_sha256,
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);

const witness = core.witnessReceipt(selected, receiptFixture);
assert.equal(witness.disposition, 'accepted-for-inspection');
assert.equal(witness.authority, 'none');
assert.equal(witness.contamination_reported, false);

const contaminated = JSON.parse(JSON.stringify(receiptFixture));
contaminated.context_audit.forbidden_context_keys_present = ['catalog_history'];
expectThrow(
  () => core.witnessReceipt(selected, contaminated),
  'forbidden context contamination'
);

const wrongPosture = JSON.parse(JSON.stringify(receiptFixture));
wrongPosture.context_posture = 'lineage-enabled';
expectThrow(
  () => core.witnessReceipt(selected, wrongPosture),
  'context posture does not match'
);

const wrongKeys = JSON.parse(JSON.stringify(receiptFixture));
wrongKeys.context_audit.supplied_context_keys = ['current_track', 'motif_index'];
expectThrow(
  () => core.witnessReceipt(selected, wrongKeys),
  'supplied-context keys differ'
);

console.log('RSC Epistemic Instrument 001: 8 bounded checks passed.');
