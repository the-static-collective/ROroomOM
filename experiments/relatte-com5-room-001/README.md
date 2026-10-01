# reLATTE × COM⁵ × ROroomOM Room 001

**Status:** local experimental receiver / Magic-Lego projection specimen.

> **The navigator finds the particular. The door chooses the projection. The Room composes the encounter.**

This experiment consumes the portable `relatte.enterable-particular/v0` projection introduced by reLATTE PR #14.

It turns one source particular into five possible **receiver-local ROroomOM encounters**:

```text
COMPOST → Residual Shelf
COMPOSE → Relation Board + addressed media instruments
COMPUTE → Receipt Console
COMMUTE → Road Map
COMMUNE → Participation Table
```

The source subject remains the same through all five doors. Every door entry creates a fresh ROroomOM-local encounter identity.

```text
FIVE DOORS != FIVE SUBJECTS
SOURCE SUBJECT != LOCAL ENCOUNTER
PROJECTION != AUTHORITY
```

## Try it

From this directory:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/`.

Choose **Load specimen** or import a JSON packet emitted by a compatible reLATTE checkout.

To generate one from reLATTE PR #14:

```bash
npm run enter:song > /tmp/enterable-song.json
```

Then import that JSON into the Room page.

## What "Magic Lego" means here

ROroomOM does not receive a finished page.

It receives a bounded set of renderer proposals and assembles them into a local instrument deck.

A COMPOSE door carrying verified addressed payload refs may yield:

```text
Relation Board
Song / Audio Player
Text / Lyric Sheet
Video Window
Image Wall
Document Desk
Source Inspector
```

depending on the declared media refs.

The first implementation deliberately does **not fetch the addressed media bytes**. The blocks show the media address and type. Fetching/resolving content is a later adapter with its own transport and trust boundary.

```text
MEDIA REF != MEDIA CONTENT
PLAYER != OWNERSHIP
MEDIA TYPE != SEMANTIC MEANING
```

A text block is labeled Text / Lyric Sheet because the renderer can serve that shape; only the source role can justify calling a particular text payload "lyrics."

## Local encounter boundary

Opening the navigator is observational.

Entering a door requires explicit local acceptance.

The Room then creates:

- a fresh local encounter id;
- a local instrument deck;
- a local action trace;
- leave/return behavior;
- an optional ROroomOM-owned encounter receipt.

The receipt is not a reLATTE receipt and does not mutate the source.

```text
ROOM RECEIPT != reLATTE RECEIPT
LOCAL ENCOUNTER != SOURCE IDENTITY
INSTRUMENT USE != SOURCE MUTATION
```

## Test

```bash
node --test test.mjs
```

The contract tests cover five-door preservation, fresh receiver-local identity, distinct COMPOSE/COMMUTE rooms over the same source subject, explicit door acceptance, local instrument use, leave/return, receipt non-collapse, and authority-inflation refusal.

## Architectural composition

```text
              reLATTE navigator
                    │
                 particular
                    │
       ┌────┬────┬──┼──┬────┐
       ↓    ↓    ↓  ↓  ↓
      C₁   C₂   C₃ C₄ C₅
       └────┴────┴──┼──┴────┘
                    ↓
                 ROroomOM
                Magic Lego
                Workstation
                    ↓
             local encounter
                    ↓
               local receipt
                    ↓
                return road
```

**Design law:** the Room may inhabit a projection without claiming to become its source.
