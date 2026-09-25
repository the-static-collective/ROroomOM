/* ADDRESSABLE-PARTICULAR-001
 * Tiny experimental kernel for addressability without collapse.
 * Coordinates locate; explicit witnessed relations relate; neither manufactures identity,
 * order, occurrence, chronology, or authority.
 */
'use strict';

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value, label) => {
  assert(typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 180, 'Invalid ' + label);
  return value;
};
const witness = value => {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Witness must be an object');
  return clone(value);
};

class AddressableField {
  constructor() {
    this.particulars = new Map();
    this.coordinates = new Map();
    this.occupancies = new Map();
    this.relations = new Map();
    this.recurrences = new Map();
  }

  addCoordinate({ id, kind = 'generic', metadata = {} }) {
    id = text(id, 'coordinate id');
    assert(!this.coordinates.has(id), 'Coordinate already exists: ' + id);
    this.coordinates.set(id, Object.freeze({ id, kind: text(kind, 'coordinate kind'), metadata: clone(metadata) }));
    return this.coordinate(id);
  }

  ensureCoordinate(id, kind = 'generic') {
    if (!this.coordinates.has(id)) this.addCoordinate({ id, kind });
    return this.coordinate(id);
  }

  coordinate(id) {
    const value = this.coordinates.get(id);
    assert(value, 'Unknown coordinate: ' + id);
    return clone(value);
  }

  addParticular({
    id,
    kind,
    localWitness,
    sourceWitness = localWitness,
    ancestry = [],
    claimedRelation = null,
    unresolvedResidue = [],
    returnAddress = null,
    payload = {}
  }) {
    id = text(id, 'particular id');
    assert(!this.particulars.has(id), 'Particular already exists: ' + id);
    assert(Array.isArray(ancestry) && ancestry.every(x => typeof x === 'string'), 'Ancestry must be string ids');
    assert(Array.isArray(unresolvedResidue), 'Unresolved residue must be an array');

    const value = {
      id,
      kind: text(kind, 'particular kind'),
      localWitness: witness(localWitness),
      conserved: {
        sourceWitness: witness(sourceWitness),
        ancestry: [...ancestry],
        claimedRelation: claimedRelation == null ? null : text(claimedRelation, 'claimed relation'),
        unresolvedResidue: clone(unresolvedResidue),
        returnAddress: returnAddress == null ? null : text(returnAddress, 'return address')
      },
      payload: clone(payload)
    };
    this.particulars.set(id, value);
    return this.particular(id);
  }

  particular(id) {
    const value = this.particulars.get(id);
    assert(value, 'Unknown particular: ' + id);
    return clone(value);
  }

  cross({
    id,
    sourceId,
    kind,
    localWitness,
    relation = 'derived-from',
    payload = {},
    unresolvedResidue = []
  }) {
    const source = this.particular(sourceId);
    const next = this.addParticular({
      id,
      kind,
      localWitness,
      sourceWitness: source.conserved.sourceWitness,
      ancestry: [...source.conserved.ancestry, source.id],
      claimedRelation: relation,
      unresolvedResidue: [...source.conserved.unresolvedResidue, ...clone(unresolvedResidue)],
      returnAddress: source.conserved.returnAddress,
      payload
    });
    this.relate({
      id: 'cross:' + id,
      from: id,
      to: sourceId,
      type: relation,
      witness: localWitness,
      metadata: { carried: ['sourceWitness', 'ancestry', 'claimedRelation', 'unresolvedResidue', 'returnAddress'] }
    });
    return next;
  }

  removeParticular(id) {
    assert(this.particulars.has(id), 'Unknown particular: ' + id);
    this.particulars.delete(id);
    for (const [claimId, claim] of this.occupancies) {
      if (claim.particular === id) this.occupancies.delete(claimId);
    }
    for (const [relationId, relation] of this.relations) {
      if (relation.from === id || relation.to === id) this.relations.delete(relationId);
    }
    return true;
  }

  occupy({ id, coordinate, particular, witness: occupancyWitness, role = 'occupant', metadata = {} }) {
    id = text(id, 'occupancy id');
    assert(!this.occupancies.has(id), 'Occupancy already exists: ' + id);
    this.ensureCoordinate(coordinate);
    this.particular(particular);
    const claim = {
      id,
      coordinate,
      particular,
      role: text(role, 'occupancy role'),
      witness: witness(occupancyWitness),
      metadata: clone(metadata)
    };
    this.occupancies.set(id, claim);
    return clone(claim);
  }

  occupants(coordinate) {
    this.coordinate(coordinate);
    const claims = [...this.occupancies.values()]
      .filter(x => x.coordinate === coordinate)
      .map(clone)
      .sort((a, b) => a.id.localeCompare(b.id));
    return {
      coordinate,
      occupancyClaims: claims,
      occupants: [...new Set(claims.map(x => x.particular))].sort(),
      ordering: 'not-asserted',
      note: 'Array order is deterministic presentation only; it is not chronology, precedence, or authority.'
    };
  }

  selectOccupant(coordinate, particular) {
    const before = this.semanticDigest();
    const result = this.occupants(coordinate);
    assert(result.occupants.includes(particular), 'Particular does not occupy coordinate');
    const selected = this.particular(particular);
    assert(before === this.semanticDigest(), 'Selection must be observational only');
    return selected;
  }

  relate({ id, from, to, type, witness: relationWitness, metadata = {} }) {
    id = text(id, 'relation id');
    assert(!this.relations.has(id), 'Relation already exists: ' + id);
    this.particular(from);
    this.particular(to);
    assert(from !== to, 'Self relation requires a separate explicit model');
    const relation = {
      id,
      from,
      to,
      type: text(type, 'relation type'),
      witness: witness(relationWitness),
      metadata: clone(metadata)
    };
    this.relations.set(id, relation);
    return clone(relation);
  }

  relationClaims(a, b) {
    this.particular(a);
    this.particular(b);
    return [...this.relations.values()]
      .filter(r => (r.from === a && r.to === b) || (r.from === b && r.to === a))
      .map(r => ({ ...clone(r), direction: r.from === a ? 'a-to-b' : 'b-to-a' }))
      .sort((x, y) => x.id.localeCompare(y.id));
  }

  claimOrder({ id, axis, before, after, witness: orderWitness, metadata = {} }) {
    return this.relate({
      id,
      from: before,
      to: after,
      type: 'order:' + text(axis, 'order axis'),
      witness: orderWitness,
      metadata
    });
  }

  compareOrder(a, b, axis) {
    this.particular(a);
    this.particular(b);
    const type = 'order:' + text(axis, 'order axis');
    const forward = [...this.relations.values()].some(r => r.from === a && r.to === b && r.type === type);
    const backward = [...this.relations.values()].some(r => r.from === b && r.to === a && r.type === type);
    if (forward && backward) return 'contested';
    if (forward) return 'before';
    if (backward) return 'after';
    return 'unknown';
  }

  grantAuthority({ id, grantor, subject, scope, witness: authorityWitness, metadata = {} }) {
    return this.relate({
      id,
      from: grantor,
      to: subject,
      type: 'authority:' + text(scope, 'authority scope'),
      witness: authorityWitness,
      metadata
    });
  }

  authorityClaims(subject) {
    this.particular(subject);
    return [...this.relations.values()]
      .filter(r => r.to === subject && r.type.startsWith('authority:'))
      .map(clone)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  defineRecurrence({ id, coordinate, month, day, foundingParticular, witness: recurrenceWitness }) {
    id = text(id, 'recurrence id');
    assert(!this.recurrences.has(id), 'Recurrence already exists: ' + id);
    assert(Number.isInteger(month) && month >= 1 && month <= 12, 'Invalid month');
    assert(Number.isInteger(day) && day >= 1 && day <= 31, 'Invalid day');
    this.ensureCoordinate(coordinate, 'calendar-address');
    this.particular(foundingParticular);
    const recurrence = {
      id,
      coordinate,
      month,
      day,
      foundingParticular,
      witness: witness(recurrenceWitness)
    };
    this.recurrences.set(id, recurrence);
    this.occupy({
      id: 'recurrence:' + id + ':founding',
      coordinate,
      particular: foundingParticular,
      witness: recurrenceWitness,
      role: 'founding-witness'
    });
    return clone(recurrence);
  }

  eligibility(recurrenceId, year) {
    const recurrence = this.recurrences.get(recurrenceId);
    assert(recurrence, 'Unknown recurrence: ' + recurrenceId);
    assert(Number.isInteger(year) && year >= 1 && year <= 9999, 'Invalid year');
    const mm = String(recurrence.month).padStart(2, '0');
    const dd = String(recurrence.day).padStart(2, '0');
    return Object.freeze({
      schema: 'addressable-particular/eligibility-v1',
      recurrenceId,
      coordinate: recurrence.coordinate,
      date: String(year).padStart(4, '0') + '-' + mm + '-' + dd,
      foundingParticular: recurrence.foundingParticular,
      eligible: true
    });
  }

  arrive({ eligibility, occurrenceId, localWitness, payload = {} }) {
    assert(eligibility && eligibility.schema === 'addressable-particular/eligibility-v1' && eligibility.eligible === true, 'Invalid eligibility token');
    const recurrence = this.recurrences.get(eligibility.recurrenceId);
    assert(recurrence, 'Unknown recurrence');
    const expected = this.eligibility(recurrence.id, Number(eligibility.date.slice(0, 4)));
    assert(JSON.stringify(expected) === JSON.stringify(eligibility), 'Eligibility token does not match recurrence');

    const occurrence = this.addParticular({
      id: occurrenceId,
      kind: 'occurrence',
      localWitness,
      sourceWitness: localWitness,
      ancestry: [],
      claimedRelation: null,
      unresolvedResidue: [],
      returnAddress: recurrence.coordinate,
      payload: { ...clone(payload), recurrenceId: recurrence.id, date: eligibility.date }
    });
    this.occupy({
      id: 'occurrence:' + occurrenceId + ':annual-address',
      coordinate: recurrence.coordinate,
      particular: occurrenceId,
      witness: localWitness,
      role: 'reentry-occurrence',
      metadata: { recurrenceId: recurrence.id, date: eligibility.date }
    });
    this.ensureCoordinate('calendar:' + eligibility.date, 'dated-occurrence-address');
    this.occupy({
      id: 'occurrence:' + occurrenceId + ':dated-address',
      coordinate: 'calendar:' + eligibility.date,
      particular: occurrenceId,
      witness: localWitness,
      role: 'actual-occurrence',
      metadata: { recurrenceId: recurrence.id }
    });
    return occurrence;
  }

  sameParticular(a, b) {
    this.particular(a);
    this.particular(b);
    return a === b;
  }

  semanticDigest() {
    const normalize = map => [...map.values()].map(clone).sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify({
      particulars: normalize(this.particulars),
      coordinates: normalize(this.coordinates),
      occupancies: normalize(this.occupancies),
      relations: normalize(this.relations),
      recurrences: normalize(this.recurrences)
    });
  }
}

module.exports = { AddressableField };
