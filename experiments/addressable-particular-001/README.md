# ADDRESSABLE-PARTICULAR-001

**Experimental reference kernel.** This slice tests one claim:

> **Addressability does not entail identity.**

It is stacked directly on **FRANKENSTEIN-001** because that crossing already demonstrates fresh receiver identity, explicit acceptance, source-reference preservation, and non-inherited authority. This experiment generalizes only the smallest part that appears to survive several unrelated cases.

## Primitive

A particular may be reachable through a stable coordinate without the coordinate defining what the particular *is*.

The kernel therefore keeps these statements separate:

- address ≠ occupant
- occupancy ≠ identity
- identity ≠ representation
- ancestry ≠ equivalence
- recurrence ≠ occurrence
- address ≠ order
- relation ≠ authority
- availability ≠ traversal

A phase crossing carries only a tiny witness capsule:

```
source witness
ancestry
claimed relation
unresolved residue
return address
```

The receiving medium gets a **fresh particular identity** and an opaque local payload. There is intentionally no universal media schema.

## Four questions the kernel can answer

1. **WHAT IS HERE?** — explicit occupancy claims at a coordinate.
2. **HOW IS IT RELATED?** — explicit witnessed relations only.
3. **WHAT MAY I ACTUALLY INFER?** — order/authority queries return unknown unless separately witnessed.
4. **WHERE CAN I RETURN?** — a stable coordinate can survive while occupants, media, and encounters remain plural.

## Three hostile specimens

### 1. Phase crossing

```
CUP ACT
→ PRINT MARK
→ RECEIPT
→ DOOR
→ ROOM SCORE
→ FILM CUE
→ SONG MOTIF
```

Every descendant has fresh identity and native payload. The original source witness, ancestry, unresolved residue, and return address can survive. Authority does **not** ride the crossing. Deleting a descendant does not mutate its ancestors.

### 2. Rival 007

Two independent books both occupy `lemon:007`.

The resolver may return both. It is forbidden to infer publication chronology, fictional chronology, reader order, or genealogical order from filesystem order, alphabetical order, insertion order, shared address, or a later common descendant.

Each order axis can be asserted only by a separate witnessed relation.

### 3. Anniversary as re-entry

The founding witness occupies `calendar:09/24`. Calling `eligibility('static-day', 2028)` merely makes the door *eligible*. It does not write an occurrence.

Only an explicit `arrive(...)` call creates a fresh occurrence particular.

So a missed year remains genuinely empty:

```
eligible door + no participation = no occurrence
```

Fresh annual occurrences share an address with the founding witness without becoming the founding witness, descendants of it, or inheritors of its authority.

## Run

Requires Node 22+ and no dependencies.

```bash
node experiments/addressable-particular-001/test.cjs
```

Expected result:

```
4 ADDRESSABLE-PARTICULAR-001 hostile tests passed.
```

## Non-goals

This is not a global Static object model, canonical ontology, distributed database, authenticated provenance system, automatic canon resolver, scheduler, or permission framework.

It deliberately does **not** infer transitive equivalence, chronology, authority, identity, or occurrence from convenience structure.

The experiment succeeds if the three specimens remain representable without a universal interchange format and without silently adding facts the witnesses never supplied.
