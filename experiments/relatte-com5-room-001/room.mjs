// reLATTE COM5 Room 001
// Receiver-local ROroomOM projection adapter for relatte.enterable-particular/v0.
// A projection packet proposes an encounter surface. It does not import source authority.

const ROLES = Object.freeze(['COMPOST','COMPOSE','COMPUTE','COMMUTE','COMMUNE']);
const INSTRUMENT_KINDS = new Set([
  'residual-shelf','relation-board','receipt-console','road-map','participation-room',
  'audio-player','video-player','image-viewer','text-sheet','document-viewer','source-inspector',
]);
const REQUIRED_BOUNDARY = Object.freeze([
  'PROJECTION != AUTHORITY',
  'DOOR != CROSSING',
  'MEDIA REF != MEDIA CONTENT',
  'ROOM RENDERING != SOURCE MUTATION',
  'RECEIVER ENCOUNTER != SOURCE IDENTITY',
]);

const fail = (code, explanation) => ({ ok:false, code, explanation });
const plain = value => value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const strictText = (value,max=500) => typeof value === 'string'
  && value.length > 0
  && value.length <= max
  && value === value.trim();

function parseInput(value) {
  if (typeof value === 'string') {
    if (value.length > 262144) return fail('too-large','The enterable-particular packet exceeds 256 KiB.');
    try { value = JSON.parse(value); }
    catch { return fail('invalid-json','The handoff is not valid JSON.'); }
  }

  if (!plain(value)) return fail('malformed','Expected a plain JSON object.');
  if (value.schema !== 'relatte.enterable-particular/v0')
    return fail('wrong-format','Expected relatte.enterable-particular/v0.');
  if (!strictText(value.subject,500))
    return fail('invalid-subject','The source subject is missing or malformed.');
  if (value.projection_status !== 'derived-non-authoritative' || value.authority !== 'none')
    return fail('authority-overclaim','ROroomOM accepts only explicitly non-authoritative reLATTE projections.');

  if (!Array.isArray(value.doors) || value.doors.length !== ROLES.length)
    return fail('invalid-doors','Exactly five COM5 doors are required.');

  for (let index=0; index<ROLES.length; index+=1) {
    const door=value.doors[index];
    if (!plain(door) || door.role !== ROLES[index] || !Array.isArray(door.observations) || !Array.isArray(door.instruments))
      return fail('invalid-door','Door order or structure is invalid.');

    for (const instrument of door.instruments) {
      if (!plain(instrument)
        || !INSTRUMENT_KINDS.has(instrument.kind)
        || !['door','media'].includes(instrument.source)
        || !(instrument.ref === null || strictText(instrument.ref,1000))
        || !(instrument.media_type === null || strictText(instrument.media_type,200))
        || !strictText(instrument.note,1000))
        return fail('invalid-instrument','A proposed room instrument is malformed.');

      if (instrument.source === 'door' && instrument.ref !== null)
        return fail('door-instrument-overclaim','Structural door instruments may not smuggle source refs.');
      if (instrument.source === 'media' && instrument.ref === null)
        return fail('media-instrument-missing-ref','Media instruments require an addressed source ref.');
    }
  }

  if (!Array.isArray(value.neighbor_refs) || value.neighbor_refs.some(ref=>!strictText(ref,1000)))
    return fail('invalid-neighbors','Neighbor refs must be bounded strings.');
  if (!Array.isArray(value.media_refs))
    return fail('invalid-media-refs','media_refs must be an array.');

  for (const media of value.media_refs) {
    if (!plain(media) || !strictText(media.address,1000) || !strictText(media.role,200)
      || !(media.media_type === null || strictText(media.media_type,200))
      || !strictText(media.source_crossing_id,1000)
      || media.source_crossing_id !== value.subject)
      return fail('invalid-media-ref','Media refs must remain addressed to the focal source crossing.');
  }

  if (!(value.encounter === null || plain(value.encounter)))
    return fail('invalid-encounter','Encounter context must be null or a bounded object.');
  if (plain(value.encounter) && value.encounter.subject !== value.subject)
    return fail('encounter-subject-mismatch','Encounter context must refer to the same focal subject.');

  if (!plain(value.history_cut)
    || !Number.isInteger(value.history_cut.accepted_record_count)
    || value.history_cut.accepted_record_count < 0
    || !Number.isInteger(value.history_cut.rejected_record_count)
    || value.history_cut.rejected_record_count < 0)
    return fail('invalid-history-cut','History-cut counts are malformed.');

  if (!Array.isArray(value.boundary)
    || REQUIRED_BOUNDARY.some(law=>!value.boundary.includes(law)))
    return fail('missing-boundary','Required non-authority boundaries are absent.');

  return { ok:true, packet:clone(value) };
}

export function openNavigator(input) {
  const parsed=parseInput(input);
  if (!parsed.ok) return parsed;

  return {
    ok:true,
    status:'held-projection',
    sourceSubject:parsed.packet.subject,
    projectionStatus:parsed.packet.projection_status,
    sourceAuthority:'none',
    sourceEncounter:clone(parsed.packet.encounter),
    doors:parsed.packet.doors.map(door=>({
      role:door.role,
      observationCount:door.observations.length,
      instrumentCount:door.instruments.length,
    })),
    neighbors:[...parsed.packet.neighbor_refs],
    packet:parsed.packet,
    localHistory:[{type:'OPEN_NAVIGATOR',subject:parsed.packet.subject}],
    sourceMutated:false,
  };
}

const LABELS = Object.freeze({
  'residual-shelf':'Residual Shelf',
  'relation-board':'Relation Board',
  'receipt-console':'Receipt Console',
  'road-map':'Road Map',
  'participation-room':'Participation Table',
  'audio-player':'Song / Audio Player',
  'video-player':'Video Window',
  'image-viewer':'Image Wall',
  'text-sheet':'Text / Lyric Sheet',
  'document-viewer':'Document Desk',
  'source-inspector':'Source Inspector',
});

function freshId() {
  const random = globalThis.crypto?.randomUUID?.();
  return random ? 'room-encounter:'+random : 'room-encounter:'+Date.now().toString(36);
}

export function enterDoor(navigator, role, approved, localId=null) {
  if (!navigator?.ok || navigator.status !== 'held-projection' || !plain(navigator.packet))
    return fail('navigator-not-open','Open a valid reLATTE projection first.');
  if (approved !== true)
    return fail('acceptance-required','Entering a source projection requires an explicit local acceptance.');
  if (!ROLES.includes(role))
    return fail('unknown-door','Choose one of the five COM5 doors.');

  const door=navigator.packet.doors.find(candidate=>candidate.role===role);
  if (!door) return fail('door-unavailable','The selected door is missing.');

  const encounterId=localId ?? freshId();
  if (!strictText(encounterId,500))
    return fail('invalid-encounter-id','Local encounter id is malformed.');

  const instrumentDeck=door.instruments.map((instrument,index)=>({
    localInstrumentId:`lego:${index+1}:${instrument.kind}`,
    kind:instrument.kind,
    label:LABELS[instrument.kind],
    source:instrument.source,
    sourceRef:instrument.ref,
    mediaType:instrument.media_type,
    sourceNote:instrument.note,
    localDisposition:'available',
  }));

  return {
    ok:true,
    status:'local-encounter',
    encounterId,
    sourceSubject:navigator.sourceSubject,
    sourceDoor:role,
    sourceAuthority:'none',
    sourceEncounter:clone(navigator.sourceEncounter),
    sourceObservations:clone(door.observations),
    sourceNeighbors:[...navigator.neighbors],
    instrumentDeck,
    phase:'entered',
    localHistory:[{
      type:'ENTER_DOOR',
      door:role,
      sourceSubject:navigator.sourceSubject,
    }],
    sourceMutated:false,
    destinationDisposition:'held',
    sharedWorldChanged:false,
  };
}

export function useInstrument(room, localInstrumentId) {
  if (!room?.ok || room.status !== 'local-encounter' || !Array.isArray(room.instrumentDeck))
    return fail('room-not-open','Enter a COM5 door before using an instrument.');
  if (room.phase === 'away')
    return fail('away','Return to the room before using an instrument.');

  const instrument=room.instrumentDeck.find(item=>item.localInstrumentId===localInstrumentId);
  if (!instrument) return fail('unknown-instrument','Instrument is not in this local deck.');
  if (room.localHistory.length >= 100) return fail('trace-full','Export the local encounter before adding more actions.');

  return {
    ...room,
    localHistory:[
      ...room.localHistory,
      {
        type:'USE_INSTRUMENT',
        localInstrumentId,
        kind:instrument.kind,
        sourceRef:instrument.sourceRef,
      },
    ],
    sourceMutated:false,
    sharedWorldChanged:false,
  };
}

export function actEncounter(room, action) {
  if (!room?.ok || room.status !== 'local-encounter')
    return fail('room-not-open','Enter a COM5 door before acting.');
  if (!['LEAVE','RETURN'].includes(action))
    return fail('unsupported-action','Only LEAVE and RETURN are defined at the room level.');
  if (action === 'LEAVE' && room.phase === 'away')
    return fail('already-away','The encounter is already away.');
  if (action === 'RETURN' && room.phase !== 'away')
    return fail('not-away','RETURN applies only after LEAVE.');

  return {
    ...room,
    phase:action==='LEAVE'?'away':'returned',
    localHistory:[...room.localHistory,{type:action}],
    sourceMutated:false,
    sharedWorldChanged:false,
  };
}

export function exportEncounterReceipt(room) {
  if (!room?.ok || room.status !== 'local-encounter')
    return fail('room-not-open','Nothing to export.');

  return {
    format:'roroomom.relatte-com5-local-encounter',
    version:1,
    encounterId:room.encounterId,
    sourceSubject:room.sourceSubject,
    sourceDoor:room.sourceDoor,
    sourceEncounter:clone(room.sourceEncounter),
    instruments:room.instrumentDeck.map(item=>({
      localInstrumentId:item.localInstrumentId,
      kind:item.kind,
      source:item.source,
      sourceRef:item.sourceRef,
      mediaType:item.mediaType,
    })),
    localHistory:clone(room.localHistory),
    sourceAuthority:'none',
    destinationDisposition:'held',
    sourceMutated:false,
    sharedWorldChanged:false,
    boundary:[
      'ROOM RECEIPT != reLATTE RECEIPT',
      'LOCAL ENCOUNTER != SOURCE IDENTITY',
      'INSTRUMENT USE != SOURCE MUTATION',
    ],
  };
}

export { ROLES };


export function makeNavigationRequest(room, targetSubject) {
  if (!room?.ok || room.status !== 'local-encounter' || !Array.isArray(room.sourceNeighbors))
    return fail('room-not-open','Enter a COM5 door before requesting navigator movement.');
  if (!strictText(targetSubject,1000))
    return fail('invalid-target','Choose a bounded destination subject.');
  if (!room.sourceNeighbors.includes(targetSubject))
    return fail('not-source-neighbor','The source projection did not expose that subject as a neighbor.');

  return {
    format:'roroomom.relatte-navigation-request/v0',
    version:0,
    source_subject:room.sourceSubject,
    requested_subject:targetSubject,
    source_door:room.sourceDoor,
    encounter_id:room.encounterId,
    authority:'none',
    requested_action:'recenter-if-verified-neighbor',
    boundary:[
      'ROOM REQUEST != VERIFIED ROAD',
      'REQUESTED SUBJECT != AUTHORIZED SUBJECT',
      'reLATTE MUST REVERIFY NEIGHBOR',
    ],
  };
}
