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
    resolvedMedia:{},
    resolvedText:{},
    roomScore:null,
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
    resolvedMedia:clone(room.resolvedMedia ?? {}),
    resolvedText:Object.fromEntries(
      Object.entries(room.resolvedText ?? {}).map(([id,item])=>[
        id,
        {
          organ:item.organ,
          status:item.status,
          address:item.address,
          sha256:item.sha256,
          mediaType:item.mediaType,
          byteLength:item.byteLength,
          lineCount:item.lineCount,
          authority:'none',
        },
      ]),
    ),
    roomScore:room.roomScore ? clone(room.roomScore) : null,
    sourceAuthority:'none',
    destinationDisposition:'held',
    sourceMutated:false,
    sharedWorldChanged:false,
    boundary:[
      'ROOM RECEIPT != reLATTE RECEIPT',
      'LOCAL ENCOUNTER != SOURCE IDENTITY',
      'INSTRUMENT USE != SOURCE MUTATION',
      'ROOM SCORE != SOURCE',
      'SYNC != MERGER',
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


const SHA_ADDRESS = /^sha256:([a-f0-9]{64})$/;

const MEDIA_RESOLVER_CONTRACTS = Object.freeze({
  'audio-player': Object.freeze({
    organ:'autodiscography-vault.audio-resolver-v0',
    expectedStatuses:Object.freeze(['resolved-verified']),
    expectedMediaTypes:Object.freeze(['audio/wav','audio/mpeg']),
  }),
  'video-player': Object.freeze({
    organ:'haunted-blender.accepted-video-resolver-v0',
    expectedStatuses:Object.freeze(['resolved-filmmaker-accepted-private-take']),
    expectedMediaTypes:Object.freeze(['video/mp4']),
  }),
});

export function prepareMediaResolution(room, localInstrumentId) {
  if (!room?.ok || room.status !== 'local-encounter' || !Array.isArray(room.instrumentDeck))
    return fail('room-not-open','Enter a COM5 door before resolving media.');
  if (room.phase === 'away')
    return fail('away','Return to the room before resolving media.');

  const instrument=room.instrumentDeck.find(item=>item.localInstrumentId===localInstrumentId);
  if (!instrument)
    return fail('unknown-instrument','Instrument is not in this local deck.');

  const contract=MEDIA_RESOLVER_CONTRACTS[instrument.kind];
  if (!contract)
    return fail('no-media-resolver','No bounded resolver is defined for this instrument kind yet.');
  if (typeof instrument.sourceRef !== 'string' || !SHA_ADDRESS.test(instrument.sourceRef))
    return fail('unaddressed-media','Media resolution requires a sha256 content address.');

  return {
    schema:'roroomom.media-resolution-request/v0',
    localInstrumentId,
    instrumentKind:instrument.kind,
    address:instrument.sourceRef,
    expectedOrgan:contract.organ,
    expectedStatuses:[...contract.expectedStatuses],
    expectedMediaTypes:[...contract.expectedMediaTypes],
    authority:'none',
    boundary:[
      'MEDIA REQUEST != RESOLUTION',
      'RESOLVER MAY NOT SUBSTITUTE ADDRESS',
      'PLAYBACK != SOURCE MUTATION',
    ],
  };
}

function validPlaybackUrl(value, digest) {
  if (typeof value !== 'string') return false;
  try {
    const url=new URL(value);
    return url.protocol==='http:'
      && ['127.0.0.1','localhost'].includes(url.hostname)
      && /^\d+$/.test(url.port)
      && url.username===''
      && url.password===''
      && url.pathname===`/v0/media/${digest}`
      && url.search===''
      && url.hash==='';
  } catch {
    return false;
  }
}

export function acceptMediaResolution(room, localInstrumentId, resolution) {
  const request=prepareMediaResolution(room,localInstrumentId);
  if (request.ok===false) return request;

  const match=SHA_ADDRESS.exec(request.address);
  const digest=match?.[1];
  if (!digest
    || !plain(resolution)
    || resolution.organ!==request.expectedOrgan
    || !request.expectedStatuses.includes(resolution.status)
    || resolution.address!==request.address
    || resolution.sha256!==digest
    || !request.expectedMediaTypes.includes(resolution.mediaType)
    || !Number.isSafeInteger(resolution.byteLength)
    || resolution.byteLength<=0
    || resolution.authority!=='none'
    || !validPlaybackUrl(resolution.playbackUrl,digest)) {
    return fail('media-resolution-mismatch','Media organ result does not match the requested local instrument.');
  }

  const accepted={
    organ:resolution.organ,
    status:resolution.status,
    address:resolution.address,
    sha256:resolution.sha256,
    mediaType:resolution.mediaType,
    byteLength:resolution.byteLength,
    playbackUrl:resolution.playbackUrl,
    ...(resolution.distributionAuthorized===false ? {distributionAuthorized:false} : {}),
    authority:'none',
  };

  return {
    ...room,
    resolvedMedia:{
      ...(room.resolvedMedia ?? {}),
      [localInstrumentId]:accepted,
    },
    localHistory:[
      ...room.localHistory,
      {
        type:'MEDIA_RESOLVED',
        localInstrumentId,
        address:accepted.address,
        organ:accepted.organ,
      },
    ],
    sourceMutated:false,
    sharedWorldChanged:false,
  };
}


const ROOM_SCORE_SCHEMA = 'roroomom.room-score/v0';
const LOCAL_TEXT_ORGAN = 'roroomom.local-addressed-text/v0';

function bytesOf(value) {
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  return null;
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle)
    throw new Error('WEBCRYPTO_UNAVAILABLE');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

export function prepareTextResolution(room, localInstrumentId) {
  if (!room?.ok || room.status !== 'local-encounter' || !Array.isArray(room.instrumentDeck))
    return fail('room-not-open','Enter a COM5 door before resolving text.');
  if (room.phase === 'away')
    return fail('away','Return to the room before resolving text.');

  const instrument=room.instrumentDeck.find(item=>item.localInstrumentId===localInstrumentId);
  if (!instrument)
    return fail('unknown-instrument','Instrument is not in this local deck.');
  if (instrument.kind !== 'text-sheet')
    return fail('not-text-sheet','Only text-sheet instruments accept local addressed text bytes.');
  if (typeof instrument.sourceRef !== 'string' || !SHA_ADDRESS.test(instrument.sourceRef))
    return fail('unaddressed-text','Text resolution requires a sha256 content address.');
  if (!['text/plain','text/markdown'].includes(instrument.mediaType))
    return fail('unsupported-text-type','Text Sheet accepts plain text or Markdown only.');

  return {
    schema:'roroomom.local-text-resolution-request/v0',
    localInstrumentId,
    address:instrument.sourceRef,
    expectedMediaType:instrument.mediaType,
    authority:'none',
    boundary:[
      'LOCAL FILE != SOURCE AUTHORITY',
      'TEXT BYTES MUST MATCH ADDRESS',
      'DISPLAY != SOURCE MUTATION',
    ],
  };
}

export async function acceptLocalTextBytes(room, localInstrumentId, suppliedBytes) {
  const request=prepareTextResolution(room,localInstrumentId);
  if (request.ok===false) return request;

  const bytes=bytesOf(suppliedBytes);
  if (!bytes || bytes.byteLength===0 || bytes.byteLength>262144)
    return fail('invalid-text-bytes','Text Sheet bytes must be between 1 byte and 256 KiB.');

  let text;
  try {
    text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  } catch {
    return fail('invalid-text-encoding','Text Sheet must be valid UTF-8.');
  }
  if (text.includes('\u0000'))
    return fail('invalid-text-content','Text Sheet may not contain NUL bytes.');

  let digest;
  try {
    digest=await sha256Hex(bytes);
  } catch {
    return fail('digest-unavailable','SHA-256 is unavailable in this local runtime.');
  }

  const match=SHA_ADDRESS.exec(request.address);
  if (!match || digest!==match[1])
    return fail('text-address-mismatch','Local text bytes do not match the Text Sheet address.');

  const lineCount=text.split(/\r?\n/).length;
  const accepted={
    organ:LOCAL_TEXT_ORGAN,
    status:'resolved-exact-local-text',
    address:request.address,
    sha256:digest,
    mediaType:request.expectedMediaType,
    byteLength:bytes.byteLength,
    lineCount,
    text,
    authority:'none',
  };

  return {
    ...room,
    resolvedText:{
      ...(room.resolvedText ?? {}),
      [localInstrumentId]:accepted,
    },
    localHistory:[
      ...room.localHistory,
      {
        type:'TEXT_RESOLVED',
        localInstrumentId,
        address:accepted.address,
        organ:accepted.organ,
      },
    ],
    sourceMutated:false,
    sharedWorldChanged:false,
  };
}

function boundedInteger(value,min,max) {
  return Number.isInteger(value) && value>=min && value<=max;
}

function scoreInstrument(room,id,kind=null) {
  const instrument=room.instrumentDeck.find(item=>item.localInstrumentId===id);
  if (!instrument) return null;
  if (kind && instrument.kind!==kind) return null;
  return instrument;
}

export function compileRoomScore(room, spec) {
  if (!room?.ok || room.status !== 'local-encounter')
    return fail('room-not-open','Enter a COM5 door before compiling a Room Score.');
  if (room.phase === 'away')
    return fail('away','Return to the room before compiling a Room Score.');
  if (!plain(spec) || spec.schema!==ROOM_SCORE_SCHEMA)
    return fail('invalid-score','Expected roroomom.room-score/v0.');
  if (!strictText(spec.title,200))
    return fail('invalid-score-title','Room Score requires a bounded title.');
  if (!strictText(spec.clock,500))
    return fail('invalid-score-clock','Room Score requires one local media clock.');
  if (!Array.isArray(spec.mediaTracks) || spec.mediaTracks.length<1 || spec.mediaTracks.length>8)
    return fail('invalid-media-tracks','Room Score requires 1-8 media tracks.');

  const clockInstrument=scoreInstrument(room,spec.clock);
  if (!clockInstrument || !['audio-player','video-player'].includes(clockInstrument.kind))
    return fail('invalid-score-clock','Room Score clock must be an audio or video Lego.');
  if (!room.resolvedMedia?.[spec.clock])
    return fail('unresolved-score-clock','Room Score clock media must be resolved first.');

  const seen=new Set();
  const mediaTracks=[];
  for (const track of spec.mediaTracks) {
    if (!plain(track)
      || !strictText(track.instrument,500)
      || !boundedInteger(track.offsetMs,-600000,600000)
      || seen.has(track.instrument))
      return fail('invalid-media-track','Room Score media track is malformed or duplicated.');

    const instrument=scoreInstrument(room,track.instrument);
    const resolved=room.resolvedMedia?.[track.instrument];
    if (!instrument || !['audio-player','video-player'].includes(instrument.kind) || !resolved)
      return fail('unresolved-media-track','Every Room Score media track must already be resolved.');

    seen.add(track.instrument);
    mediaTracks.push({
      instrument:track.instrument,
      kind:instrument.kind,
      sourceRef:instrument.sourceRef,
      resolvedSha256:resolved.sha256,
      organ:resolved.organ,
      offsetMs:track.offsetMs,
    });
  }
  if (!seen.has(spec.clock))
    return fail('clock-not-in-tracks','Room Score clock must also be a media track.');

  if (!plain(spec.lyricTrack)
    || !strictText(spec.lyricTrack.instrument,500)
    || !Array.isArray(spec.lyricTrack.cues)
    || spec.lyricTrack.cues.length<1
    || spec.lyricTrack.cues.length>500)
    return fail('invalid-lyric-track','Room Score requires one bounded lyric cue track.');

  const lyricInstrument=scoreInstrument(room,spec.lyricTrack.instrument,'text-sheet');
  const lyric=room.resolvedText?.[spec.lyricTrack.instrument];
  if (!lyricInstrument || !lyric)
    return fail('unresolved-lyric-track','Room Score lyric Text Sheet must be resolved first.');

  let previous=-1;
  const cues=[];
  for (const cue of spec.lyricTrack.cues) {
    if (!plain(cue)
      || !boundedInteger(cue.atMs,0,24*60*60*1000)
      || cue.atMs<previous
      || !boundedInteger(cue.fromLine,1,lyric.lineCount)
      || !boundedInteger(cue.toLine,cue.fromLine,lyric.lineCount))
      return fail('invalid-lyric-cue','Lyric cues must be ordered and address existing line ranges.');

    previous=cue.atMs;
    cues.push({
      atMs:cue.atMs,
      fromLine:cue.fromLine,
      toLine:cue.toLine,
    });
  }

  const compiled={
    schema:ROOM_SCORE_SCHEMA,
    status:'compiled-local-arrangement',
    title:spec.title,
    clock:spec.clock,
    mediaTracks,
    lyricTrack:{
      instrument:spec.lyricTrack.instrument,
      sourceRef:lyricInstrument.sourceRef,
      resolvedSha256:lyric.sha256,
      lineCount:lyric.lineCount,
      cues,
    },
    authority:'none',
    boundary:[
      'ROOM SCORE != SOURCE',
      'SYNC != MERGER',
      'CUE != CLAIM',
      'LOCAL ARRANGEMENT != SOURCE MUTATION',
      'COMPOSITION != OWNERSHIP',
    ],
  };

  return {
    ...room,
    roomScore:compiled,
    localHistory:[
      ...room.localHistory,
      {
        type:'ROOM_SCORE_COMPILED',
        title:compiled.title,
        clock:compiled.clock,
        mediaTrackCount:compiled.mediaTracks.length,
        lyricCueCount:compiled.lyricTrack.cues.length,
      },
    ],
    sourceMutated:false,
    sharedWorldChanged:false,
  };
}

export function roomScoreFrame(room, elapsedMs) {
  if (!room?.ok || !room.roomScore)
    return fail('score-not-compiled','Compile a Room Score first.');
  if (!Number.isFinite(elapsedMs) || elapsedMs<0 || elapsedMs>24*60*60*1000)
    return fail('invalid-score-time','Room Score time must be a bounded nonnegative number.');

  const score=room.roomScore;
  const lyric=room.resolvedText?.[score.lyricTrack.instrument];
  if (!lyric || lyric.sha256!==score.lyricTrack.resolvedSha256)
    return fail('stale-lyric-resolution','Resolved lyric bytes changed after score compilation.');

  for (const track of score.mediaTracks) {
    const resolved=room.resolvedMedia?.[track.instrument];
    if (!resolved || resolved.sha256!==track.resolvedSha256 || resolved.organ!==track.organ)
      return fail('stale-media-resolution','Resolved media changed after score compilation.');
  }

  let activeCue=null;
  for (const cue of score.lyricTrack.cues) {
    if (cue.atMs<=elapsedMs) activeCue=cue;
    else break;
  }

  const lines=lyric.text.split(/\r?\n/);
  const lyricFrame=activeCue ? {
    ...activeCue,
    text:lines.slice(activeCue.fromLine-1,activeCue.toLine).join('\n'),
  } : null;

  return {
    ok:true,
    status:'room-score-frame',
    elapsedMs,
    clock:score.clock,
    media:score.mediaTracks.map(track=>({
      instrument:track.instrument,
      kind:track.kind,
      desiredTimeSeconds:Math.max(0,(elapsedMs+track.offsetMs)/1000),
      sourceRef:track.sourceRef,
    })),
    lyric:lyricFrame,
    authority:'none',
  };
}
