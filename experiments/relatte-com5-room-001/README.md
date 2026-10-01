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
npm run --silent enter:song > /tmp/enterable-song.json
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


## Room 002 — real organ dock + return request

This branch adds the first actual Collective organ behind a Magic-Lego workstation block: **Static Workbench Source Inspector**.

Run Static Workbench v0.2 locally on its normal loopback port, then from this experiment directory:

```bash
python3 organ_bridge.py
```

Open `http://127.0.0.1:13702/`.

The page can now:

1. discover sanitized Workbench-local repository entries;
2. choose one repository and a bounded Markdown/text path;
3. **prepare** the exact source read;
4. explicitly **inspect** the same bytes only if HEAD/content remain unchanged;
5. show the inspected excerpt in the Room without claiming source authority.

The adapter reuses ROroomOM's existing `WorkbenchReadAdapter`; it does not add a second filesystem reader.

```text
SOURCE REF != LOCAL PATH
WORKBENCH READ != SOURCE AUTHORITY
INSPECTION != ADMISSION
```

The same Room can also export a bounded navigation request for one source-projected neighbor:

```text
Room encounter at A
→ ask reLATTE to re-center on B
→ request carries authority = none
→ reLATTE independently re-verifies A → B
→ fresh enterable B
```

The Room cannot manufacture a road by naming an arbitrary identifier.

```text
ROOM REQUEST != VERIFIED ROAD
REQUESTED SUBJECT != AUTHORIZED SUBJECT
reLATTE MUST REVERIFY NEIGHBOR
```

CI now exercises the complete loop using the actual producer and consumer branches:

```text
reLATTE signed history
→ real enterable packet
→ ROroomOM COMPOSE room
→ Room navigation request
→ reLATTE road re-verification
→ fresh destination packet
```

This is the first round trip where navigation and inhabitation remain owned by separate projects.


## Room 003 — verified audio becomes playable

The first media Lego is now backed by an independently governed organ: **Autodiscography Vault**.

The Room still receives only a reLATTE content address:

```text
audio-player
sourceRef = sha256:<digest>
```

Resolution proceeds through three separate boundaries:

```text
reLATTE address
→ ROroomOM media-resolution request
→ Autodiscography Vault resolver
→ verified receipt lookup
→ exact local byte re-verification
→ read-only loopback media URL
→ ROroomOM verifies returned digest/address
→ browser audio controls
```

The Room never opens a Vault path and the Vault never receives Room authority.

### Run locally

Start the Vault resolver from the `autodiscography-vault` checkout:

```bash
npm run resolver:serve -- \
  --vault-root /path/to/Autodiscography-Vault \
  --port 13703 \
  --room-origin http://127.0.0.1:13702
```

Then run this experiment's bridge:

```bash
python3 organ_bridge.py --port 13702 --workbench-port 13700 --vault-port 13703
```

Open `http://127.0.0.1:13702/`.

Enter a COMPOSE room containing an `audio-player` whose `sourceRef` is the SHA-256 address of a verified Vault audio object. Press **Resolve verified audio**. Only after the Vault returns the same address/digest and a compatible read-only playback URL does the card become a browser `<audio controls>` player.

The bundled demo packet uses synthetic placeholder hashes, so its player will correctly refuse unless a matching local Vault object exists. Use a real reLATTE packet whose audio ref matches admitted Vault bytes for live playback.

### Media laws

```text
MEDIA REQUEST != RESOLUTION
RESOLVER MAY NOT SUBSTITUTE ADDRESS
PLAYER != OWNER
PLAYBACK != SOURCE MUTATION
VAULT RESOLUTION != ROOM ADMISSION
```

### CI proof

Room 003 CI now:

1. verifies reLATTE and the existing Room round trip;
2. checks out the Vault resolver branch;
3. admits a synthetic RIFF/WAVE object into a temporary Vault;
4. starts the real loopback Vault resolver;
5. requests a browser-origin byte range and checks `206`, CORS, RIFF and WAVE bytes;
6. resolves the exact hash through the ROroomOM Vault organ;
7. upgrades the matching audio Lego through the Room kernel;
8. confirms source mutation and shared-world mutation remain false.

That is the first real media-byte crossing in the COM⁵ workstation.
