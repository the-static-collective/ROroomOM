# RSC Epistemic Instrument 001

**Status:** bounded offline ROroomOM experiment  
**Branch:** `experiment/rsc-epistemic-instrument-001`  
**Parent Room:** `experiment/relatte-com5-room-009-guest-port`  
**Donor contracts:** GHoT `rsc-composer-001` and `epistemic-capability-001`

## One sentence

ROroomOM receives an RSC recommendation, lets a human inspect and explicitly select an epistemic capability posture, binds the exact intended context by SHA-256, exports a portable execution parcel, and independently witnesses a returned GHoT receipt without claiming that recommendation, export, or receipt grants authority.

## The loop

```text
RSC RESEED PACKET
      ↓
ROOM RECEIVES RECOMMENDATION
      ↓
PREPARE
  capability
  context posture
  destination
  supplied keys
  forbidden keys
      ↓
INSPECT
      ↓
EXPLICIT HUMAN SELECTION
      ↓
LOCAL CONTEXT SHA-256
      ↓
EXPORT EXECUTION PARCEL
      ↓
      ·
   elsewhere
      ·
      ↓
GHOT RECEIPT RETURNS
      ↓
ROOM CHECKS
  capability match
  posture match
  visible context-key match
  contamination report
      ↓
LOCAL WITNESS
```

## Laws

```text
RECOMMENDATION != SELECTION
PREPARE != EXECUTE
CONTEXT GRANT != AUTHORITY
CONTEXT DIGEST != CONTEXT CONTENT
RECEIPT != AUTHORITY
WITNESS != EXECUTION
DISTRIBUTION != INDEPENDENCE
```

## What is executable now

Open `index.html` directly in a modern browser.

The instrument can:

1. import an `rsc.reseed-packet`;
2. expose only the packet's recommended experiments as selectable crossings;
3. prepare a local `roroomom.epistemic-selection`;
4. refuse confirmation until the user explicitly selects the prepared request;
5. compare the actual top-level context keys against the selected context manifest;
6. SHA-256 the exact canonicalized context locally in the browser;
7. export a `roroomom.epistemic-execution-parcel`;
8. import or paste a `ghot.receipt`;
9. reject mismatched capability or context posture;
10. reject any receipt reporting forbidden-context contamination;
11. reject visible context-key drift from the selected manifest;
12. emit a local `roroomom.epistemic-receipt-witness`.

The browser never sends the context anywhere by itself.

The execution parcel contains the context digest and manifest, not the context bytes.

## Deliberately not implemented

This experiment does **not**:

- call a GHoT node;
- claim that parcel export proves delivery;
- claim that a GHoT receipt proves model independence;
- ingest a receipt as project authority;
- modify the source RSC packet;
- modify GHoT;
- inherit execution grants from the RSC recommendation;
- infer a context posture from prose;
- silently select a destination.

A later adapter may connect the parcel to a real GHoT transport, but that adapter must own its own delivery and execution boundary.

## Files

- `core.js` — deterministic packet validation and local selection/witness logic;
- `index.html` — offline human cockpit;
- `fixture-rsc-reseed.json` — bounded demonstration RSC packet;
- `fixture-ghot-receipt.json` — bounded demonstration receipt;
- `test.cjs` — Node contract tests.

The two fixture files are explicitly demonstrations. They are not claims of live execution or canonical composer output.

## Test

```bash
node experiments/rsc-epistemic-instrument-001/test.cjs
```

The test covers:

- RSC packet admission;
- recommendation-only preparation;
- refusal without explicit human selection;
- selected parcel construction;
- context digest binding;
- successful receipt witnessing;
- contaminated receipt refusal;
- posture mismatch refusal;
- supplied-context-key drift refusal.

## Cross-project provenance

The RSC shape comes from:

- `the-static-collective/GHoT`
- branch `rsc-composer-001`
- PR #2

The epistemic capability shape comes from:

- `the-static-collective/GHoT`
- branch `epistemic-capability-001`
- PR #3

The Room does not copy their authority.

It imports bounded records and applies a receiver-local decision.

## The new seam

The first RSC paper proposed that a generative artifact should enlarge future option-space.

This experiment gives that claim a visible operational form.

The RSC Composer can recommend a crossing.

GHoT can represent a capability with an epistemic posture.

ROroomOM can now make the crucial middle act explicit:

> **a human can see what knowledge will cross before choosing whether the crossing should occur.**

That is the first actual cockpit for Recursive Systems Composition.
