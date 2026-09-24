# ROroomOM × Living Deck 001 — the porch receives a card composition

**Status:** independent local-only experiment based on the existing ROroomOM Room 006 experimental branch. Existing Room 005/006 files and source authority are unchanged.

This creates an actual **playable guest room** that consumes the portable JSON proposal exported by [Static Field Living Deck PR #12](https://github.com/the-static-collective/static-field/pull/12). The handoff is real file interoperability. It is **not** an imported PostEmahh'n issued card, deployed Full Measure project, canonical Static Field occurrence, or execution through ROroomOM's protected capability bridge.

## Try locally

1. In the Static Field Living Deck checkout, run `python3 -m http.server 8000 --bind 127.0.0.1` from `experiments/postemahhn-living-deck-001`. Open `http://127.0.0.1:8000`, select Cicada → Porch Radio + ECHO, compose, then click **Export Full Measure × ROroomOM proposal**.
2. In this ROroomOM checkout, run `python3 -m http.server 8001 --bind 127.0.0.1` from `experiments/living-deck-room-001`. Open `http://127.0.0.1:8001` and choose the downloaded proposal file.
3. Inspect, attempt, leave and return. Export the local guest-room receipt. Note the persistent `sharedWorldChanged: false` and `destinationDisposition: held`.

For a local contract test, from this directory:

```sh
node --test tests/*.test.mjs
# To include the actual cross-repo producer:
STATIC_FIELD_DECK_DIR=/path/to/static-field node --test tests/*.test.mjs
```

GitHub Actions checks out the current Static Field experiment branch separately and runs the producer→consumer test; the workflow needs only read permissions.

## Gate and origin

The accepted file is a bounded `static-field.living-deck-portable-proposal` version 1. The receiving room validates the declared cards, sticker relation, ordered receipt, issued-card nonclaims, Full Measure project-draft nonclaims, and the ROroomOM creative handoff. It does not trust a claimed `verified: true` in a user-supplied file. A tampered card pairing is refused; a valid proposal may be played only in its own isolated local preview.

The pinned Jubilee design is an actual historical document describing Genesis RECEIVE/HOLD/POUR, **not** an issued card receipt. No source-owned PostEmahh'n card/sticker verifier has been integrated. The source document cannot attest physical card custody or authorize arbitrary executable tools.

The parent ROroomOM bridge already has separate prepare → explicit approval → bounded execution semantics for its own two operations. This guest room does not call that bridge or add a third privileged operation.

## Next real admission frontier

To progress past preview, obtain one genuine source-issued PostEmahh'n card and sticker receipt from its independent implementation, implement a trusted import verifier, and add destination-owned admit/hold/refuse adapters to Full Measure and ROroomOM. Only a separate explicit world-policy decision could later emit a canonical Static Field event.


## Three-repository carrier: card → local quest → local room

The guest room now also accepts the `full-measure.living-deck-room-request` exported by [Full Measure experimental PR #48](https://github.com/the-static-collective/full-measure-world-layer/pull/48). The request carries the original Static Field proposal plus a separately generated **unconfirmed local quest receipt**. ROroomOM independently replays its declared quest actions and checks its phase, receipt reference, source composition, no-confirmation fields, and lack of external authority. An invalid or forged local quest history is refused. A valid history is carried forward as *preview residue*, never as a confirmed deed.

One fully manual path is:

```text
Static Field Fellowship Table → Export Full Measure × ROroomOM proposal
Full Measure Living Deck quest → Inspect / Join / Attempt / Report locally
Full Measure → Carry quest to ROroomOM (JSON)
ROroomOM local guest room → import JSON, Inspect / Attempt / Leave / Return
ROroomOM → export local encounter receipt
```

All three are independently hosted localhost pages; no service-to-service network or production datastore write occurs. GitHub Actions checks out both producer branches and exercises the actual card → quest → room chain in one isolated Node contract test. External project admission still requires distinct reviewed adapters and genuine source-issued card/sticker proofs.
