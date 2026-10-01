# Room 008 — Offer / Echo / Cross

Room 008 closes the reciprocal half of the human/AI crossing rail.

Room 007 proved:

    AI proposal
      -> human ACCEPT / HOLD / REFUSE
      -> attributable receipt

Room 008 makes the path into that proposal explicit too:

    HUMAN OFFER
      -> AI ECHO
      -> AI PROPOSAL
      -> HUMAN DECISION
      -> receipt

The AI does not silently convert natural language into permission.

## 1. Human Offer

A Human Offer is a deterministic hashed capability envelope bound to the current Room Score.

It declares:

- human intent;
- exactly which scored Lego are offered;
- exactly which actions are permitted;
- whether Play Memory may be read;
- which explicit human verdict classes may be visible to the AI;
- maximum media timing delta;
- protected invariants;
- current source subject, encounter and Room Score SHA-256.

First-slice capabilities are:

    INSPECT_ROOM_SCORE
    READ_PLAY_MEMORY
    PROPOSE_MEDIA_OFFSET_MS

The offer carries:

    authority = human-local-offer

and the laws:

    REQUEST != PERMISSION
    INTENT != INTERPRETATION
    OFFER != COMMAND
    MEMORY AVAILABLE != MEMORY INVITED
    SILENCE != CONSENT

## 2. AI Echo

Before an offer-bound proposal can exist, an identified AI participant must Echo the offer.

The Echo records:

- participant identity;
- exact Human Offer id/hash;
- what the AI believes the human meant;
- capabilities it heard;
- offered material it heard;
- protected invariants it heard;
- explicit uncertainties;
- only the Play Memory the Human Offer permitted it to observe.

The Echo has:

    authority = echo-only

and:

    ECHO != INTENT
    INTERPRETATION != AUTHORITY
    HEARD CAPABILITY != NEW CAPABILITY
    MEMORY OBSERVED != MEMORY AUTHORITY
    ECHO != PROPOSAL

The Room—not the AI participant—gates the memory view.

If the ledger contains KEEP and WEIRD memories but the Human Offer permits WEIRD only, the Echo receives the verified WEIRD memory projection only. KEEP does not appear in its memory refs or invitations.

## 3. Offer-bound proposal

An AI Room Score proposal may now bind:

    humanOfferId + hash
    aiEchoId + hash

Before constructing the proposal, ROroomOM verifies:

- Human Offer integrity;
- Human Offer current-score precondition;
- AI Echo integrity;
- AI Echo binding to the Human Offer;
- proposal participant equals Echo participant;
- PROPOSE_MEDIA_OFFSET_MS was permitted;
- proposed instrument was actually offered;
- absolute timing delta is within the human maximum.

Only the material offered by the human appears in the proposal basis.

Only the memory admitted by the Echo appears in the proposal basis.

## 4. Human decision

The Room 007 ACCEPT / HOLD / REFUSE boundary remains unchanged.

The final crossing receipt now also carries the Offer/Echo lineage.

So one local consequence can be traced as:

    human offer
      -> AI echo
      -> AI proposal
      -> human decision
      -> pre/post Room Score hashes

without any source bytes, source identity or reLATTE history becoming AI-owned.

## 5. Visible rail

The workstation now exposes four stages:

    1 HUMAN -> OFFER
    2 AI -> ECHO
    3 AI -> PROPOSAL
    4 HUMAN -> DECISION

The proposal button stays locked until a current Human Offer and its AI Echo exist.

The first Human Offer UI makes these permissions visible:

- offer song;
- offer video;
- offer text;
- allow/deny Play Memory;
- allow KEEP / WEIRD / COMPOST independently;
- maximum timing delta.

The AI Echo visibly states what it heard before the proposal exists.

## Stable laws

    REQUEST != PERMISSION
    INTENT != INTERPRETATION
    ECHO != INTENT
    INTERPRETATION != AUTHORITY
    PROPOSAL != CONSENT
    MEMORY AVAILABLE != MEMORY INVITED
    MEMORY INFLUENCE != PERMISSION
    SILENCE != CONSENT
    ACCEPTANCE REQUIRES HUMAN CROSSING

> The human offers a bounded world. The AI echoes the world it heard. Only then may it propose a road through it.
