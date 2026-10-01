# Room 009 — Guest Port

Room 009 turns Offer / Echo / Cross into a portable, transport-neutral guest protocol.

> Many minds. One offer. Separate crossings.

The first slice is for independently declared AI participants.

It does not assume a provider API, shared agent runtime, shared conversation, or shared model state.

## Portable flow

    HUMAN OFFER
        ↓
    GUEST PORT PACKET
        ↓
    any transport
    copy/paste | file | local model | API adapter | chat
        ↓
    GUEST DRAFT
        ↓
    ROroomOM validates + seals locally
        ↓
    GUEST RESPONSE
        ↓
    import to Room
        ↓
    open ONE crossing
        ↓
    HUMAN ACCEPT / HOLD / REFUSE

Transport never becomes authority.

    TRANSPORT != PARTICIPANT
    MODEL PROVIDER != AUTHORITY

Participant identity in this first slice is declared metadata, not cryptographic provider authentication.

    DECLARED PARTICIPANT != VERIFIED PROVIDER IDENTITY

A future provider adapter may add authenticated identity evidence without changing the Guest Port crossing grammar.

## Guest Port packet

Schema:

    roroomom.guest-port/v0

The packet contains only the bounded world exported by the current Human Offer:

- source subject and encounter;
- Room Score SHA-256 and title;
- Human Offer id/hash;
- offered Lego only;
- current timing values for offered media tracks;
- allowed capabilities;
- maximum timing delta;
- protected invariants;
- only the Play Memory permitted by the Human Offer;
- response grammar.

It does not expose the whole Room.

    GUEST PACKET != ROOM ACCESS

The packet is deterministic and content-addressed.

On import, ROroomOM reconstructs the expected packet from the current Room + Human Offer + permitted memory ledger and requires an exact packet hash match.

Thus a packet becomes stale when its bounded world changes.

## Guest Draft

An outside participant does not need to compute ROroomOM hashes.

It may return plain JSON:

    {
      "schema": "roroomom.guest-response-draft/v0",
      "participant": {
        "type": "ai-participant",
        "id": "ai:guest-example",
        "label": "Guest Example",
        "provider": "whatever-carried-this",
        "model": "optional-model-name"
      },
      "understanding": "What I heard in the offer.",
      "uncertainties": [
        "What remains uncertain."
      ],
      "proposal": {
        "op": "SET_MEDIA_OFFSET_MS",
        "instrument": "lego:4:video-player",
        "value": 500,
        "rationale": "Why I would try this."
      }
    }

The proposal field may be null. An Echo without a proposal is valid.

ROroomOM validates the draft against the Guest Port capability envelope and seals it into:

    roroomom.guest-port-response/v0

The sealed response receives a deterministic response id/hash.

## Multiple guests

Many responses may refer to the exact same Guest Port packet.

ROroomOM preserves them independently.

    SAME OFFER != SAME INTERPRETATION
    MULTIPLE ECHOES != CONSENSUS
    AGREEMENT != TRUTH
    DISAGREEMENT != FAILURE
    PROPOSAL SET != DECISION

Two guests proposing the same timing value remain two separate attributable responses.

Two guests disagreeing is not an error.

No response set elects a winner.

## Open one crossing

Importing a Guest Response does not execute it.

The Room converts one selected, valid Guest Response proposal into the already-proven local proposal shape and opens it on the Human Decision rail.

Then:

    ACCEPT | HOLD | REFUSE

works exactly as before.

Accepting Guest B does not erase Guest A or Guest C.

But because the accepted local Room Score now has a new hash, the old Guest Port packet is stale for further consequential imports.

That forces a new bounded offer/packet for the new local world instead of letting sibling proposals silently drift across state changes.

## Response projection

ROroomOM may render a descriptive set of Guest Responses, but the projection carries authority = none.

It may show:

- participant declaration;
- Echo;
- uncertainties;
- proposal or no proposal.

It may not produce:

- consensus;
- ranking;
- winner;
- automatic merge;
- automatic execution.

## Stable laws

    TRANSPORT != PARTICIPANT
    MODEL PROVIDER != AUTHORITY
    DECLARED PARTICIPANT != VERIFIED PROVIDER IDENTITY

    SAME OFFER != SAME INTERPRETATION
    MULTIPLE ECHOES != CONSENSUS
    AGREEMENT != TRUTH
    DISAGREEMENT != FAILURE

    GUEST RESPONSE != ROOM CONSEQUENCE
    PROPOSAL SET != DECISION
    ACCEPTANCE REQUIRES HUMAN CROSSING

> A Guest Port lets many minds approach the same bounded world without pretending they became one mind.
