# Room 007 — Human ↔ AI Crossing Rail

Room 007 adds the first user-facing human/AI crossing primitive to the COM⁵ workstation.

> The AI is a participant in the Room. It is not the Room, the navigator, or the authority.

The first slice is intentionally narrow:

    existing compiled Room Score
       ↓
    verified Play Memory projection
       ↓
    AI participant proposes ONE media timing change
       ↓
    visible crossing rail
       ↓
    HUMAN: ACCEPT | HOLD | REFUSE
       ↓
    local crossing receipt

Nothing changes before ACCEPT.

## The proposal must answer five human questions

Every staged proposal exposes:

1. WHO proposed this?
2. WHAT did it use?
3. WHY this?
4. WHAT will change?
5. WHAT will not change?

It also states who decides: the human local encounter.

## First bounded patch

Room 007 permits one proposal operation only:

    SET_MEDIA_OFFSET_MS

The proposal may change one already-resolved audio/video track offset from one bounded integer value to another.

It may not change:

- source subject;
- any instrument sourceRef;
- any resolved media SHA-256;
- lyric sourceRef;
- lyric cue ranges;
- reLATTE history;
- source media bytes.

That restriction is the point of the first slice. The crossing machinery can be tested without granting a generic agent edit surface.

## Memory influence

createAiRoomScoreProposal() independently projects the current receipt-backed Play Memory ledger for the source particular.

The proposal records:

- verified memory capsule refs;
- current invitation kinds such as REOPEN, MUTATE_NEARBY, COMPOST_RESIDUE, REPRISE or CONTRAST;
- memory projection authority;
- prophecy authority.

Memory may explain why an AI participant offered a mutation.

    MEMORY INFLUENCE != PERMISSION

An invitation never applies a patch.

## Proposal integrity + stale-score protection

Each proposal gets a deterministic SHA-256 over its semantic core.

Before any human decision is resolved, ROroomOM:

- recomputes the proposal hash;
- confirms the proposal targets this source subject and encounter;
- recomputes the current Room Score hash;
- refuses if the score changed after proposal creation.

Thus:

    EDITED PROPOSAL → REFUSE
    STALE PRECONDITION → REFUSE

## Human decisions

### HOLD

HOLD records a crossing receipt and changes nothing. A UI may keep the proposal available for a later explicit decision.

### REFUSE

REFUSE records that the human declined this proposal. It changes nothing and does not erase that the proposal occurred.

### ACCEPT

ACCEPT re-validates the patch, recompiles only the receiver-local Room Score arrangement, and emits a receipt with:

- proposal id/hash;
- AI participant identity;
- human decision;
- pre-score SHA-256;
- post-score SHA-256;
- exact applied patch;
- changed = true/false.

The upstream song, video, lyrics, and reLATTE history are untouched.

## Crossing laws

    AI PARTICIPANT != SYSTEM
    PROMPT != AUTHORITY
    INTERPRETATION != INTENT
    PROPOSAL != CONSENT
    MEMORY INFLUENCE != PERMISSION
    ACCEPTANCE REQUIRES HUMAN CROSSING

    AI PROPOSAL != HUMAN DECISION
    HOLD != ACCEPT
    REFUSE != ERASURE
    ACCEPT != SOURCE AUTHORITY
    LOCAL SCORE CHANGE != SOURCE MUTATION

## Why this is the user-facing layer

The UI does not hide the AI behind a magic button. It makes the crossing itself visible:

    AI PARTICIPANT
       ↓
    proposal + basis + limits
       ↓
    HUMAN THRESHOLD
       ↓
    ACCEPT / HOLD / REFUSE
       ↓
    attributable receipt

This is the first executable form of human/AI cross-crossings in the Static workstation.

## Stable compression

> AI may propose a road inside the Room. The human still crosses it.
