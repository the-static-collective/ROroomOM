'use strict';

(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RSCEpistemicInstrument = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const POSTURES = ['fresh', 'bounded-window', 'lineage-enabled', 'owner-local'];

  function fail(message) {
    const err = new Error(message);
    err.name = 'InstrumentError';
    throw err;
  }

  function text(value, label, max = 240) {
    if (typeof value !== 'string' || !value.trim()) fail(label + ' must be a non-empty string');
    if (value.length > max) fail(label + ' is too long');
    return value.trim();
  }

  function stringArray(value, label, maxItems = 64) {
    if (!Array.isArray(value)) fail(label + ' must be an array');
    if (value.length > maxItems) fail(label + ' is too large');
    const out = [];
    const seen = new Set();
    for (const item of value) {
      const clean = text(item, label + ' item', 160);
      if (!seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    }
    return out;
  }

  function validateReseed(packet) {
    if (!packet || typeof packet !== 'object' || Array.isArray(packet)) fail('Reseed packet must be an object');
    if (packet.kind !== 'rsc.reseed-packet') fail('Expected kind rsc.reseed-packet');
    if (String(packet.version) !== '0') fail('Expected RSC reseed version 0');
    if (packet.human_selection_required !== true) fail('Reseed packet must require human selection');
    if (!Array.isArray(packet.recommended_next_experiments)) fail('Missing recommended_next_experiments');

    const recommendations = packet.recommended_next_experiments.map((item, index) => {
      if (!item || typeof item !== 'object') fail('Recommendation ' + index + ' must be an object');
      return {
        crossing_id: text(item.crossing_id, 'crossing_id'),
        title: text(item.title, 'title', 300),
        selection_status: item.selection_status || null,
        cost: item.cost || null,
        reversible: item.reversible === true,
        requires: Array.isArray(item.requires) ? item.requires.slice(0, 64) : [],
        produces: Array.isArray(item.produces) ? item.produces.slice(0, 64) : []
      };
    });

    return {
      reseed_id: text(packet.reseed_id || 'unidentified-reseed', 'reseed_id'),
      source_seed_sha256: typeof packet.source_seed_sha256 === 'string' ? packet.source_seed_sha256 : null,
      title: typeof packet.title === 'string' ? packet.title : 'Untitled RSC composition',
      laws: Array.isArray(packet.laws) ? packet.laws.slice(0, 64) : [],
      recommendations
    };
  }

  function findRecommendation(packet, crossingId) {
    const parsed = validateReseed(packet);
    const id = text(crossingId, 'crossing_id');
    const rec = parsed.recommendations.find(x => x.crossing_id === id);
    if (!rec) fail('Crossing is not in the reseed packet recommendation set');
    if (rec.selection_status && rec.selection_status !== 'recommendation-only') {
      fail('Recommendation has unexpected selection status: ' + rec.selection_status);
    }
    return { parsed, rec };
  }

  function prepareSelection(packet, input) {
    if (!input || typeof input !== 'object') fail('Selection input must be an object');
    const { parsed, rec } = findRecommendation(packet, input.crossing_id);

    const posture = text(input.context_posture, 'context_posture');
    if (!POSTURES.includes(posture)) fail('Unknown context posture: ' + posture);

    const capability = text(input.capability, 'capability');
    const destination = text(input.destination, 'destination');
    const suppliedKeys = stringArray(input.supplied_context_keys || [], 'supplied_context_keys');
    const forbiddenKeys = stringArray(input.forbidden_context_keys || [], 'forbidden_context_keys');

    const overlap = suppliedKeys.filter(key => forbiddenKeys.includes(key));
    if (overlap.length) fail('A context key cannot be both supplied and forbidden: ' + overlap.join(', '));

    return {
      kind: 'roroomom.epistemic-selection',
      version: '0',
      status: 'prepared',
      prepared_at: new Date().toISOString(),
      source_reseed_id: parsed.reseed_id,
      source_seed_sha256: parsed.source_seed_sha256,
      crossing_id: rec.crossing_id,
      recommendation_title: rec.title,
      capability,
      context_posture: posture,
      destination,
      context_manifest: {
        supplied_context_keys: suppliedKeys,
        forbidden_context_keys: forbiddenKeys,
        supplied_context_sha256: null
      },
      preserved_laws: [
        'RECOMMENDATION != SELECTION',
        'PREPARE != EXECUTE',
        'CONTEXT GRANT != AUTHORITY',
        'CONTEXT DIGEST != CONTEXT CONTENT'
      ],
      authority: 'none',
      human_selection_required: true,
      execution_requested: false
    };
  }

  function confirmSelection(prepared, confirmation) {
    if (!prepared || prepared.kind !== 'roroomom.epistemic-selection' || prepared.status !== 'prepared') {
      fail('Expected a prepared ROroomOM epistemic selection');
    }
    if (!confirmation || confirmation.explicit !== true) fail('Explicit human selection is required');

    return {
      ...prepared,
      status: 'selected',
      selected_at: new Date().toISOString(),
      selected_by: 'local-human',
      human_selection_required: false,
      execution_requested: false,
      selection_note: typeof confirmation.note === 'string' ? confirmation.note.slice(0, 500) : ''
    };
  }

  function buildExecutionParcel(selected, contextSha256) {
    if (!selected || selected.kind !== 'roroomom.epistemic-selection' || selected.status !== 'selected') {
      fail('Expected an explicitly selected epistemic request');
    }
    const digest = text(contextSha256, 'supplied_context_sha256', 128);
    if (!/^[a-f0-9]{64}$/i.test(digest)) fail('supplied_context_sha256 must be a 64-character hex SHA-256');

    return {
      kind: 'roroomom.epistemic-execution-parcel',
      version: '0',
      created_at: new Date().toISOString(),
      source_selection: {
        source_reseed_id: selected.source_reseed_id,
        crossing_id: selected.crossing_id,
        selected_at: selected.selected_at
      },
      request: {
        capability: selected.capability,
        context_posture: selected.context_posture,
        destination: selected.destination,
        context_manifest: {
          ...selected.context_manifest,
          supplied_context_sha256: digest
        }
      },
      boundary: 'Portable request only. This parcel does not prove delivery, execution, isolation, or authority.',
      execution_authority: 'destination-local'
    };
  }

  function witnessReceipt(selected, receipt) {
    if (!selected || selected.kind !== 'roroomom.epistemic-selection' || selected.status !== 'selected') {
      fail('Expected an explicitly selected epistemic request');
    }
    if (!receipt || typeof receipt !== 'object' || receipt.kind !== 'ghot.receipt') {
      fail('Expected a GHoT receipt');
    }
    if (String(receipt.version) !== '0') fail('Expected GHoT receipt version 0');
    if (receipt.capability !== selected.capability) fail('Receipt capability does not match selection');
    if (receipt.context_posture !== selected.context_posture) fail('Receipt context posture does not match selection');

    const audit = receipt.context_audit;
    if (!audit || typeof audit !== 'object') fail('Receipt has no context audit');
    const digest = text(audit.supplied_context_sha256, 'receipt supplied_context_sha256', 128);
    if (!/^[a-f0-9]{64}$/i.test(digest)) fail('Receipt context digest is not a SHA-256');
    const suppliedKeys = stringArray(audit.supplied_context_keys || [], 'receipt supplied_context_keys');
    const forbiddenPresent = stringArray(audit.forbidden_context_keys_present || [], 'forbidden_context_keys_present');

    const expectedSupplied = selected.context_manifest.supplied_context_keys;
    const unexpectedKeys = suppliedKeys.filter(key => !expectedSupplied.includes(key));
    const missingKeys = expectedSupplied.filter(key => !suppliedKeys.includes(key));

    if (forbiddenPresent.length) fail('Receipt reports forbidden context contamination: ' + forbiddenPresent.join(', '));
    if (unexpectedKeys.length || missingKeys.length) {
      fail(
        'Receipt supplied-context keys differ from selected manifest' +
        (unexpectedKeys.length ? '; unexpected: ' + unexpectedKeys.join(', ') : '') +
        (missingKeys.length ? '; missing: ' + missingKeys.join(', ') : '')
      );
    }

    return {
      kind: 'roroomom.epistemic-receipt-witness',
      version: '0',
      witnessed_at: new Date().toISOString(),
      source_reseed_id: selected.source_reseed_id,
      crossing_id: selected.crossing_id,
      capability: selected.capability,
      context_posture: selected.context_posture,
      destination: selected.destination,
      ghot_receipt_id: receipt.receipt_id || null,
      ghot_status: receipt.status || null,
      supplied_context_sha256: digest,
      supplied_context_keys: suppliedKeys,
      contamination_reported: false,
      disposition: 'accepted-for-inspection',
      authority: 'none',
      local_consequence: 'none',
      laws: [
        'RECEIPT != AUTHORITY',
        'WITNESS != EXECUTION',
        'CONTEXT DIGEST != CONTEXT CONTENT',
        'DISTRIBUTION != INDEPENDENCE'
      ]
    };
  }

  return {
    POSTURES,
    validateReseed,
    findRecommendation,
    prepareSelection,
    confirmSelection,
    buildExecutionParcel,
    witnessReceipt
  };
});
