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
      || !boundedInteger(track.offsetMs,0,600000)
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


export function actRoomScore(room, action) {
  if (!room?.ok || room.status!=='local-encounter' || !room.roomScore)
    return fail('score-not-compiled','Compile a Room Score before conducting it.');
  if (!['CONDUCT','STOP'].includes(action))
    return fail('unsupported-score-action','Room Score supports CONDUCT and STOP only.');
  if (room.phase==='away')
    return fail('away','Return to the room before conducting its score.');
  if (room.localHistory.length>=100)
    return fail('trace-full','Export the local encounter before adding more actions.');

  return {
    ...room,
    localHistory:[
      ...room.localHistory,
      {
        type:action==='CONDUCT'?'ROOM_SCORE_CONDUCT':'ROOM_SCORE_STOP',
        title:room.roomScore.title,
        clock:room.roomScore.clock,
      },
    ],
    sourceMutated:false,
    sharedWorldChanged:false,
  };
}


const PERFORMANCE_MEMORY_SCHEMA = 'roroomom.performance-memory/v0';
const PERFORMANCE_MEMORY_PROJECTION_SCHEMA = 'roroomom.performance-memory-projection/v0';
const HUMAN_VERDICTS = new Set(['keep','weird','compost']);

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '['+value.map(canonicalJson).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(value[key])).join(',')+'}';
}

async function hashCanonicalLocal(value) {
  const bytes=new TextEncoder().encode(canonicalJson(value));
  return sha256Hex(bytes);
}

function conducted(room) {
  return room.localHistory.some(entry=>entry?.type==='ROOM_SCORE_CONDUCT');
}

function scoredBlocks(room) {
  const score=room.roomScore;
  if (!score) return [];
  const blocks=[];
  for (const track of score.mediaTracks ?? []) {
    blocks.push({
      localInstrumentId:track.instrument,
      kind:track.kind,
      sourceRef:track.sourceRef,
      resolvedSha256:track.resolvedSha256,
      organ:track.organ,
    });
  }
  const lyric=score.lyricTrack;
  if (lyric) {
    blocks.push({
      localInstrumentId:lyric.instrument,
      kind:'text-sheet',
      sourceRef:lyric.sourceRef,
      resolvedSha256:lyric.resolvedSha256,
      organ:LOCAL_TEXT_ORGAN,
    });
  }
  return blocks;
}

export async function createPerformanceMemory(room, humanVerdict) {
  if (!room?.ok || room.status!=='local-encounter')
    return fail('room-not-open','Enter a room before making performance memory.');
  if (!room.roomScore)
    return fail('score-not-compiled','Compile a Room Score before making performance memory.');
  if (!conducted(room))
    return fail('not-performed','A compiled score must actually be conducted before it can become performance memory.');
  if (!plain(humanVerdict) || !HUMAN_VERDICTS.has(humanVerdict.verdict))
    return fail('invalid-human-verdict','Performance memory requires explicit keep, weird, or compost.');
  if (typeof humanVerdict.reopenRequested!=='boolean')
    return fail('invalid-reopen-choice','Performance memory requires an explicit reopenRequested boolean.');

  const receipt=exportEncounterReceipt(room);
  if (receipt?.ok===false) return receipt;

  const encounterReceiptSha256=await hashCanonicalLocal(receipt);
  const blocks=scoredBlocks(room);
  const fact={
    sourceSubject:room.sourceSubject,
    sourceDoor:room.sourceDoor,
    encounterId:room.encounterId,
    encounterReceiptSha256,
    scoreTitle:room.roomScore.title,
    scoreClock:room.roomScore.clock,
    scoreMediaTrackCount:room.roomScore.mediaTracks.length,
    scoreLyricCueCount:room.roomScore.lyricTrack.cues.length,
    performedBlocks:blocks,
  };

  const learning={
    schema:'roroomom.performance-learning/v0',
    sourceReceiptSha256:encounterReceiptSha256,
    humanVerdict:humanVerdict.verdict,
    reopenRequested:humanVerdict.reopenRequested,
    playedSourceRefs:[...new Set(blocks.map(block=>block.sourceRef))].sort(),
    instrumentKinds:[...new Set(blocks.map(block=>block.kind))].sort(),
    authority:'derived-from-receipt-and-explicit-human-verdict',
  };

  const core={
    schema:PERFORMANCE_MEMORY_SCHEMA,
    fact,
    humanVerdict:{
      verdict:humanVerdict.verdict,
      reopenRequested:humanVerdict.reopenRequested,
      authority:'explicit-human-local-verdict',
    },
    learning,
    boundary:[
      'PLAYBACK != PREFERENCE',
      'RECEIPT != LEARNING',
      'LEARNING != PROPHECY',
      'HUMAN VERDICT != SOURCE AUTHORITY',
      'MEMORY != SOURCE MUTATION',
    ],
    authority:'none',
  };

  const memorySha256=await hashCanonicalLocal(core);
  return {
    ...core,
    memorySha256,
    memoryId:'memory:'+memorySha256,
  };
}

function validPerformanceMemoryShape(memory) {
  return plain(memory)
    && memory.schema===PERFORMANCE_MEMORY_SCHEMA
    && /^[a-f0-9]{64}$/.test(memory.memorySha256 ?? '')
    && memory.memoryId==='memory:'+memory.memorySha256
    && plain(memory.fact)
    && strictText(memory.fact.sourceSubject,1000)
    && Array.isArray(memory.fact.performedBlocks)
    && plain(memory.humanVerdict)
    && HUMAN_VERDICTS.has(memory.humanVerdict.verdict)
    && typeof memory.humanVerdict.reopenRequested==='boolean'
    && plain(memory.learning)
    && memory.authority==='none';
}

async function validPerformanceMemory(memory) {
  if (!validPerformanceMemoryShape(memory)) return false;
  const core={
    schema:memory.schema,
    fact:memory.fact,
    humanVerdict:memory.humanVerdict,
    learning:memory.learning,
    boundary:memory.boundary,
    authority:memory.authority,
  };
  return await hashCanonicalLocal(core)===memory.memorySha256;
}

function memoryMatches(memory,{sourceSubject=null,sourceRef=null}={}) {
  if (sourceSubject!==null && memory.fact.sourceSubject!==sourceSubject) return false;
  if (sourceRef!==null && !memory.fact.performedBlocks.some(block=>block.sourceRef===sourceRef)) return false;
  return sourceSubject!==null || sourceRef!==null;
}

export async function projectPerformanceMemory(memories, selector={}) {
  if (!Array.isArray(memories))
    return fail('invalid-memory-ledger','Performance memory ledger must be an array.');
  if (!plain(selector)
    || (selector.sourceSubject!==undefined && !strictText(selector.sourceSubject,1000))
    || (selector.sourceRef!==undefined && !strictText(selector.sourceRef,1000))
    || (selector.sourceSubject===undefined && selector.sourceRef===undefined))
    return fail('invalid-memory-selector','Select a sourceSubject and/or sourceRef.');

  const valid=[];
  for (const memory of memories) {
    if (await validPerformanceMemory(memory)) valid.push(memory);
  }
  const selected=valid.filter(memory=>memoryMatches(memory,{
    sourceSubject:selector.sourceSubject ?? null,
    sourceRef:selector.sourceRef ?? null,
  }));

  const verdictCounts={keep:0,weird:0,compost:0};
  let reopenRequests=0;
  for (const memory of selected) {
    verdictCounts[memory.humanVerdict.verdict]+=1;
    if (memory.humanVerdict.reopenRequested) reopenRequests+=1;
  }

  const invitations=[];
  const latest=selected.at(-1) ?? null;
  if (latest?.humanVerdict.reopenRequested) {
    invitations.push({
      kind:'REOPEN',
      reason:'latest-explicit-human-reopen-request',
      evidenceRefs:[latest.memoryId],
      authority:'invitation-only',
    });
  }
  if (verdictCounts.weird>0) {
    const evidence=selected.filter(memory=>memory.humanVerdict.verdict==='weird').map(memory=>memory.memoryId);
    invitations.push({
      kind:'MUTATE_NEARBY',
      reason:'explicit-weird-verdict-exists',
      evidenceRefs:evidence.slice(-8),
      authority:'invitation-only',
    });
  }
  if (verdictCounts.compost>0) {
    const evidence=selected.filter(memory=>memory.humanVerdict.verdict==='compost').map(memory=>memory.memoryId);
    invitations.push({
      kind:'COMPOST_RESIDUE',
      reason:'explicit-compost-verdict-exists',
      evidenceRefs:evidence.slice(-8),
      authority:'invitation-only',
    });
  }
  if (verdictCounts.keep>0) {
    const evidence=selected.filter(memory=>memory.humanVerdict.verdict==='keep').map(memory=>memory.memoryId);
    invitations.push({
      kind:'REPRISE',
      reason:'explicit-keep-verdict-exists',
      evidenceRefs:evidence.slice(-8),
      authority:'invitation-only',
    });
  }
  if (selected.length>=3) {
    invitations.push({
      kind:'CONTRAST',
      reason:'three-or-more-attributable-performances',
      evidenceRefs:selected.slice(-3).map(memory=>memory.memoryId),
      authority:'invitation-only',
    });
  }

  return {
    schema:PERFORMANCE_MEMORY_PROJECTION_SCHEMA,
    selector:{
      ...(selector.sourceSubject!==undefined ? {sourceSubject:selector.sourceSubject} : {}),
      ...(selector.sourceRef!==undefined ? {sourceRef:selector.sourceRef} : {}),
    },
    playCount:selected.length,
    verdictCounts,
    reopenRequests,
    memoryRefs:selected.map(memory=>memory.memoryId),
    learningRefs:selected.map(memory=>memory.memorySha256),
    prophecy:{
      schema:'roroomom.performance-prophecy/v0',
      status:'imagined-from-receipt-backed-memory',
      invitations,
      authority:'imagined-non-authoritative',
    },
    boundary:[
      'PAST PERFORMANCE != CURRENT TRUTH',
      'PLAY COUNT != PREFERENCE',
      'MEMORY PRESSURE != PROGRAMMING AUTHORITY',
      'PROPHECY != AUTHORITY',
      'REOPEN != REPLAY',
    ],
    authority:'none',
  };
}


const AI_PROPOSAL_SCHEMA='roroomom.ai-room-score-proposal/v0';
const HUMAN_AI_RECEIPT_SCHEMA='roroomom.human-ai-crossing-receipt/v0';
const HUMAN_AI_DECISIONS=new Set(['ACCEPT','HOLD','REFUSE']);
const HUMAN_OFFER_SCHEMA='roroomom.human-offer/v0';
const AI_ECHO_SCHEMA='roroomom.ai-offer-echo/v0';
const GUEST_PORT_SCHEMA='roroomom.guest-port/v0';
const GUEST_DRAFT_SCHEMA='roroomom.guest-response-draft/v0';
const GUEST_RESPONSE_SCHEMA='roroomom.guest-port-response/v0';
const GUEST_PROPOSAL_SCHEMA='roroomom.guest-room-score-proposal/v0';
const OFFER_ACTIONS=new Set([
  'INSPECT_ROOM_SCORE',
  'READ_PLAY_MEMORY',
  'PROPOSE_MEDIA_OFFSET_MS',
]);

async function roomScoreSha256(room) {
  if (!room?.roomScore) throw new Error('ROOM_SCORE_REQUIRED');
  return hashCanonicalLocal(room.roomScore);
}

function validAiParticipant(value) {
  return plain(value)
    && strictText(value.id,200)
    && (value.label===undefined || strictText(value.label,200))
    && (value.provider===undefined || strictText(value.provider,200))
    && (value.model===undefined || strictText(value.model,200));
}

function validOffsetPatch(room, patch) {
  if (!plain(patch)
    || patch.op!=='SET_MEDIA_OFFSET_MS'
    || !strictText(patch.instrument,500)
    || !boundedInteger(patch.value,0,600000))
    return false;
  return room.roomScore?.mediaTracks?.some(track=>track.instrument===patch.instrument) ?? false;
}


function uniqueStrings(values,max=20) {
  if (!Array.isArray(values) || values.length>max) return null;
  const out=[];
  for (const value of values) {
    if (!strictText(value,500) || out.includes(value)) return null;
    out.push(value);
  }
  return out;
}

function offerProtectedInvariants() {
  return [
    'source subject',
    'source media bytes',
    'instrument source refs',
    'resolved media sha256',
    'lyric source ref',
    'lyric cue ranges',
    'reLATTE history',
    'publication authority',
  ];
}

export async function createHumanOffer(room, spec) {
  if (!room?.ok || room.status!=='local-encounter' || !room.roomScore)
    return fail('score-not-compiled','Compile a Room Score before making a human offer.');
  if (!plain(spec) || !strictText(spec.intent,1000))
    return fail('invalid-human-intent','Human offer requires a bounded intent statement.');

  const offeredInstruments=uniqueStrings(spec.offeredInstruments,16);
  if (!offeredInstruments || offeredInstruments.length===0)
    return fail('invalid-offered-material','Human offer requires at least one explicit offered instrument.');

  const availableBlocks=new Map(scoredBlocks(room).map(block=>[block.localInstrumentId,block]));
  const offered=[];
  for (const id of offeredInstruments) {
    const block=availableBlocks.get(id);
    if (!block)
      return fail('unavailable-offered-material','Human offer named an instrument outside the current Room Score.');
    offered.push(clone(block));
  }

  const allowedActions=uniqueStrings(spec.allowedActions,8);
  if (!allowedActions || allowedActions.length===0 || allowedActions.some(action=>!OFFER_ACTIONS.has(action)))
    return fail('invalid-offer-capability','Human offer contains an unsupported capability.');

  if (!plain(spec.memoryPolicy) || typeof spec.memoryPolicy.enabled!=='boolean')
    return fail('invalid-memory-policy','Human offer requires an explicit memory policy.');

  const allowedVerdicts=uniqueStrings(spec.memoryPolicy.allowedVerdicts ?? [],3);
  if (!allowedVerdicts || allowedVerdicts.some(verdict=>!HUMAN_VERDICTS.has(verdict)))
    return fail('invalid-memory-policy','Memory verdict filter must contain only keep, weird, or compost.');
  if (!spec.memoryPolicy.enabled && allowedVerdicts.length!==0)
    return fail('invalid-memory-policy','Disabled memory policy may not carry allowed verdicts.');
  if (spec.memoryPolicy.enabled && !allowedActions.includes('READ_PLAY_MEMORY'))
    return fail('memory-not-authorized','Memory cannot be enabled without READ_PLAY_MEMORY permission.');

  if (!boundedInteger(spec.maxOffsetDeltaMs,0,600000))
    return fail('invalid-offer-limit','Human offer requires a bounded maximum timing delta.');

  const scoreSha256=await roomScoreSha256(room);
  const core={
    schema:HUMAN_OFFER_SCHEMA,
    target:{
      sourceSubject:room.sourceSubject,
      encounterId:room.encounterId,
      roomScoreSha256:scoreSha256,
      roomScoreTitle:room.roomScore.title,
    },
    intent:spec.intent,
    offered,
    capabilities:{
      allowedActions,
      maxOffsetDeltaMs:spec.maxOffsetDeltaMs,
    },
    memoryPolicy:{
      enabled:spec.memoryPolicy.enabled,
      allowedVerdicts,
    },
    protected:offerProtectedInvariants(),
    authority:'human-local-offer',
    boundary:[
      'REQUEST != PERMISSION',
      'INTENT != INTERPRETATION',
      'OFFER != COMMAND',
      'MEMORY AVAILABLE != MEMORY INVITED',
      'SILENCE != CONSENT',
    ],
  };
  const offerSha256=await hashCanonicalLocal(core);
  return {
    ...core,
    offerSha256,
    offerId:'human-offer:'+offerSha256,
  };
}

async function verifiedHumanOffer(room, offer) {
  if (!plain(offer)
    || offer.schema!==HUMAN_OFFER_SCHEMA
    || !/^[a-f0-9]{64}$/.test(offer.offerSha256 ?? '')
    || offer.offerId!=='human-offer:'+offer.offerSha256
    || offer.authority!=='human-local-offer')
    return null;

  const core={
    schema:offer.schema,
    target:offer.target,
    intent:offer.intent,
    offered:offer.offered,
    capabilities:offer.capabilities,
    memoryPolicy:offer.memoryPolicy,
    protected:offer.protected,
    authority:offer.authority,
    boundary:offer.boundary,
  };
  if (await hashCanonicalLocal(core)!==offer.offerSha256) return null;
  if (offer.target?.sourceSubject!==room.sourceSubject
    || offer.target?.encounterId!==room.encounterId)
    return null;
  if (offer.target?.roomScoreSha256!==await roomScoreSha256(room))
    return null;
  return core;
}

export async function createAiOfferEcho(room, memories, offer, spec) {
  if (!room?.ok || room.status!=='local-encounter' || !room.roomScore)
    return fail('score-not-compiled','A Room Score must exist before an AI participant can echo a human offer.');
  if (!Array.isArray(memories))
    return fail('invalid-memory-ledger','AI echo requires a memory ledger array.');
  if (!plain(spec) || !validAiParticipant(spec.participant))
    return fail('invalid-ai-participant','AI echo requires an explicit participant identity.');
  if (!strictText(spec.understanding,1200))
    return fail('invalid-ai-understanding','AI echo requires a bounded statement of understanding.');

  const uncertainties=uniqueStrings(spec.uncertainties ?? [],12);
  if (!uncertainties)
    return fail('invalid-ai-uncertainty','AI echo uncertainties must be bounded unique strings.');

  const offerCore=await verifiedHumanOffer(room,offer);
  if (!offerCore)
    return fail('invalid-human-offer','Human offer failed integrity, target, or score-precondition verification.');

  let observedProjection=await projectPerformanceMemory([],{sourceSubject:room.sourceSubject});
  if (offer.memoryPolicy.enabled && offer.capabilities.allowedActions.includes('READ_PLAY_MEMORY')) {
    const allProjection=await projectPerformanceMemory(memories,{sourceSubject:room.sourceSubject});
    if (allProjection.ok===false) return allProjection;
    const validIds=new Set(allProjection.memoryRefs);
    const permitted=memories.filter(memory=>
      validIds.has(memory?.memoryId)
      && offer.memoryPolicy.allowedVerdicts.includes(memory?.humanVerdict?.verdict)
    );
    observedProjection=await projectPerformanceMemory(permitted,{sourceSubject:room.sourceSubject});
    if (observedProjection.ok===false) return observedProjection;
  }

  const core={
    schema:AI_ECHO_SCHEMA,
    participant:{
      type:'ai-participant',
      id:spec.participant.id,
      ...(spec.participant.label!==undefined ? {label:spec.participant.label} : {}),
      ...(spec.participant.provider!==undefined ? {provider:spec.participant.provider} : {}),
      ...(spec.participant.model!==undefined ? {model:spec.participant.model} : {}),
    },
    offer:{
      offerId:offer.offerId,
      offerSha256:offer.offerSha256,
      intent:offer.intent,
    },
    understanding:spec.understanding,
    uncertainties,
    capabilitiesHeard:{
      allowedActions:[...offer.capabilities.allowedActions],
      maxOffsetDeltaMs:offer.capabilities.maxOffsetDeltaMs,
    },
    offeredHeard:offer.offered.map(block=>({
      localInstrumentId:block.localInstrumentId,
      kind:block.kind,
      sourceRef:block.sourceRef,
      resolvedSha256:block.resolvedSha256,
    })),
    protectedHeard:[...offer.protected],
    memoryObserved:{
      enabled:offer.memoryPolicy.enabled,
      allowedVerdicts:[...offer.memoryPolicy.allowedVerdicts],
      memoryRefs:[...observedProjection.memoryRefs],
      invitations:observedProjection.prophecy.invitations.map(item=>({
        kind:item.kind,
        evidenceRefs:[...item.evidenceRefs],
        authority:item.authority,
      })),
      authority:observedProjection.authority,
      prophecyAuthority:observedProjection.prophecy.authority,
    },
    authority:'echo-only',
    boundary:[
      'ECHO != INTENT',
      'INTERPRETATION != AUTHORITY',
      'HEARD CAPABILITY != NEW CAPABILITY',
      'MEMORY OBSERVED != MEMORY AUTHORITY',
      'ECHO != PROPOSAL',
    ],
  };
  const echoSha256=await hashCanonicalLocal(core);
  return {
    ...core,
    echoSha256,
    echoId:'ai-echo:'+echoSha256,
  };
}

async function verifiedAiEcho(room, offer, echo) {
  if (!plain(echo)
    || echo.schema!==AI_ECHO_SCHEMA
    || !/^[a-f0-9]{64}$/.test(echo.echoSha256 ?? '')
    || echo.echoId!=='ai-echo:'+echo.echoSha256
    || echo.authority!=='echo-only'
    || echo.offer?.offerId!==offer.offerId
    || echo.offer?.offerSha256!==offer.offerSha256)
    return null;

  const core={
    schema:echo.schema,
    participant:echo.participant,
    offer:echo.offer,
    understanding:echo.understanding,
    uncertainties:echo.uncertainties,
    capabilitiesHeard:echo.capabilitiesHeard,
    offeredHeard:echo.offeredHeard,
    protectedHeard:echo.protectedHeard,
    memoryObserved:echo.memoryObserved,
    authority:echo.authority,
    boundary:echo.boundary,
  };
  if (await hashCanonicalLocal(core)!==echo.echoSha256) return null;
  if (!await verifiedHumanOffer(room,offer)) return null;
  return core;
}

async function verifiedProposalCore(proposal) {
  if (!plain(proposal)
    || ![AI_PROPOSAL_SCHEMA,GUEST_PROPOSAL_SCHEMA].includes(proposal.schema)
    || !/^[a-f0-9]{64}$/.test(proposal.proposalSha256 ?? '')
    || proposal.proposalId!=='proposal:'+proposal.proposalSha256
    || proposal.authority!=='proposal-only')
    return null;

  const core={
    schema:proposal.schema,
    participant:proposal.participant,
    target:proposal.target,
    basis:proposal.basis,
    crossingContext:proposal.crossingContext ?? null,
    rationale:proposal.rationale,
    patch:proposal.patch,
    changes:proposal.changes,
    invariants:proposal.invariants,
    authority:proposal.authority,
    boundary:proposal.boundary,
  };
  return await hashCanonicalLocal(core)===proposal.proposalSha256 ? core : null;
}

export async function createAiRoomScoreProposal(room, memories, spec) {
  if (!room?.ok || room.status!=='local-encounter' || !room.roomScore)
    return fail('score-not-compiled','Compile a Room Score before an AI participant may propose a change.');
  if (!Array.isArray(memories))
    return fail('invalid-memory-ledger','AI proposal basis requires a memory ledger array.');
  if (!plain(spec) || !validAiParticipant(spec.participant))
    return fail('invalid-ai-participant','AI proposal requires an explicit bounded participant identity.');
  if (!strictText(spec.rationale,1000))
    return fail('invalid-ai-rationale','AI proposal requires a bounded rationale.');
  if (!validOffsetPatch(room,spec.patch))
    return fail('invalid-ai-patch','First crossing slice allows one bounded media-offset patch only.');

  const scoreSha256=await roomScoreSha256(room);
  const current=room.roomScore.mediaTracks.find(track=>track.instrument===spec.patch.instrument);
  if (!current) return fail('invalid-ai-patch','Target media track is absent.');

  let memoryProjection=null;
  let basisSourceRefs=[...new Set(scoredBlocks(room).map(block=>block.sourceRef))].sort();
  let crossingContext=null;
  if (spec.crossing!==undefined) {
    if (!plain(spec.crossing))
      return fail('invalid-offer-echo-crossing','Crossed AI proposal requires a human offer and AI echo.');
    const offer=spec.crossing.offer;
    const echo=spec.crossing.echo;
    const offerCore=await verifiedHumanOffer(room,offer);
    if (!offerCore)
      return fail('invalid-human-offer','Human offer failed integrity, target, or score-precondition verification.');
    const echoCore=await verifiedAiEcho(room,offer,echo);
    if (!echoCore)
      return fail('invalid-ai-echo','AI echo failed integrity or offer-binding verification.');
    if (echo.participant?.id!==spec.participant.id)
      return fail('ai-participant-mismatch','Proposal participant must match the AI participant that echoed the offer.');
    if (!offer.capabilities.allowedActions.includes('PROPOSE_MEDIA_OFFSET_MS'))
      return fail('proposal-not-authorized','Human offer did not permit media-offset proposals.');
    if (!offer.offered.some(block=>block.localInstrumentId===spec.patch.instrument))
      return fail('instrument-not-offered','AI proposal targets material the human did not offer.');

    const delta=Math.abs(spec.patch.value-current.offsetMs);
    if (delta>offer.capabilities.maxOffsetDeltaMs)
      return fail('proposal-exceeds-offer-limit','AI proposal exceeds the human offer timing limit.');

    basisSourceRefs=[...new Set(offer.offered.map(block=>block.sourceRef))].sort();
    memoryProjection={
      schema:PERFORMANCE_MEMORY_PROJECTION_SCHEMA,
      selector:{sourceSubject:room.sourceSubject},
      playCount:echo.memoryObserved.memoryRefs.length,
      verdictCounts:{keep:0,weird:0,compost:0},
      reopenRequests:0,
      memoryRefs:[...echo.memoryObserved.memoryRefs],
      learningRefs:[],
      prophecy:{
        schema:'roroomom.performance-prophecy/v0',
        status:'echo-bounded-memory-view',
        invitations:echo.memoryObserved.invitations.map(item=>clone(item)),
        authority:echo.memoryObserved.prophecyAuthority,
      },
      boundary:['ECHO-BOUNDED MEMORY VIEW'],
      authority:echo.memoryObserved.authority,
    };

    crossingContext={
      humanOfferId:offer.offerId,
      humanOfferSha256:offer.offerSha256,
      aiEchoId:echo.echoId,
      aiEchoSha256:echo.echoSha256,
    };
  } else {
    memoryProjection=await projectPerformanceMemory(memories,{
      sourceSubject:room.sourceSubject,
    });
    if (memoryProjection.ok===false) return memoryProjection;
  }

  const core={
    schema:AI_PROPOSAL_SCHEMA,
    participant:{
      type:'ai-participant',
      id:spec.participant.id,
      ...(spec.participant.label!==undefined ? {label:spec.participant.label} : {}),
      ...(spec.participant.provider!==undefined ? {provider:spec.participant.provider} : {}),
      ...(spec.participant.model!==undefined ? {model:spec.participant.model} : {}),
    },
    target:{
      sourceSubject:room.sourceSubject,
      encounterId:room.encounterId,
      roomScoreSha256:scoreSha256,
      roomScoreTitle:room.roomScore.title,
    },
    basis:{
      sourceRefs:basisSourceRefs,
      memoryRefs:[...memoryProjection.memoryRefs],
      memoryInvitations:memoryProjection.prophecy.invitations.map(item=>({
        kind:item.kind,
        evidenceRefs:[...item.evidenceRefs],
        authority:item.authority,
      })),
      memoryAuthority:memoryProjection.authority,
      prophecyAuthority:memoryProjection.prophecy.authority,
    },
    crossingContext,
    rationale:spec.rationale,
    patch:{
      op:'SET_MEDIA_OFFSET_MS',
      instrument:spec.patch.instrument,
      fromValue:current.offsetMs,
      value:spec.patch.value,
    },
    changes:[
      {
        field:`roomScore.mediaTracks[${spec.patch.instrument}].offsetMs`,
        from:current.offsetMs,
        to:spec.patch.value,
      },
    ],
    invariants:[
      'sourceSubject',
      'instrument sourceRef',
      'resolved media sha256',
      'lyric sourceRef',
      'lyric cue ranges',
      'reLATTE history',
      'source media bytes',
    ],
    authority:'proposal-only',
    boundary:[
      'AI PARTICIPANT != SYSTEM',
      'PROMPT != AUTHORITY',
      'INTERPRETATION != INTENT',
      'PROPOSAL != CONSENT',
      'MEMORY INFLUENCE != PERMISSION',
      'OFFER != COMMAND',
      'ECHO != INTENT',
      'ACCEPTANCE REQUIRES HUMAN CROSSING',
    ],
  };

  const proposalSha256=await hashCanonicalLocal(core);
  return {
    ...core,
    proposalSha256,
    proposalId:'proposal:'+proposalSha256,
  };
}


function validGuestParticipant(value) {
  return plain(value)
    && value.type==='ai-participant'
    && strictText(value.id,200)
    && (value.label===undefined || strictText(value.label,200))
    && (value.provider===undefined || strictText(value.provider,200))
    && (value.model===undefined || strictText(value.model,200));
}

async function permittedMemoryForOffer(room, memories, offer) {
  if (!offer.memoryPolicy.enabled) {
    return projectPerformanceMemory([],{sourceSubject:room.sourceSubject});
  }
  const allProjection=await projectPerformanceMemory(memories,{sourceSubject:room.sourceSubject});
  if (allProjection.ok===false) return allProjection;
  const validIds=new Set(allProjection.memoryRefs);
  const permitted=memories.filter(memory=>
    validIds.has(memory?.memoryId)
    && offer.memoryPolicy.allowedVerdicts.includes(memory?.humanVerdict?.verdict)
  );
  return projectPerformanceMemory(permitted,{sourceSubject:room.sourceSubject});
}

export async function createGuestPortPacket(room, memories, offer) {
  if (!room?.ok || room.status!=='local-encounter' || !room.roomScore)
    return fail('score-not-compiled','Compile a Room Score before opening Guest Port.');
  if (!Array.isArray(memories))
    return fail('invalid-memory-ledger','Guest Port requires a memory ledger array.');

  const offerCore=await verifiedHumanOffer(room,offer);
  if (!offerCore)
    return fail('invalid-human-offer','Guest Port requires a current verified Human Offer.');

  const memoryProjection=await permittedMemoryForOffer(room,memories,offer);
  if (memoryProjection.ok===false) return memoryProjection;

  const tracks=new Map(room.roomScore.mediaTracks.map(track=>[track.instrument,track]));
  const offered=offer.offered.map(block=>{
    const track=tracks.get(block.localInstrumentId) ?? null;
    return {
      localInstrumentId:block.localInstrumentId,
      kind:block.kind,
      sourceRef:block.sourceRef,
      resolvedSha256:block.resolvedSha256,
      organ:block.organ,
      ...(track ? {currentOffsetMs:track.offsetMs} : {}),
    };
  });

  const core={
    schema:GUEST_PORT_SCHEMA,
    port:{
      sourceSubject:room.sourceSubject,
      encounterId:room.encounterId,
      roomScoreSha256:await roomScoreSha256(room),
      roomScoreTitle:room.roomScore.title,
      humanOfferId:offer.offerId,
      humanOfferSha256:offer.offerSha256,
    },
    humanOffer:{
      intent:offer.intent,
      offered,
      capabilities:clone(offer.capabilities),
      memoryPolicy:clone(offer.memoryPolicy),
      protected:[...offer.protected],
      authority:offer.authority,
    },
    memoryView:{
      memoryRefs:[...memoryProjection.memoryRefs],
      invitations:memoryProjection.prophecy.invitations.map(item=>({
        kind:item.kind,
        evidenceRefs:[...item.evidenceRefs],
        authority:item.authority,
      })),
      authority:memoryProjection.authority,
      prophecyAuthority:memoryProjection.prophecy.authority,
    },
    responseContract:{
      echoRequired:true,
      proposalOptional:true,
      proposalOps:['SET_MEDIA_OFFSET_MS'],
      humanDecisionRequired:true,
      schemas:{
        draft:GUEST_DRAFT_SCHEMA,
        response:GUEST_RESPONSE_SCHEMA,
        proposal:GUEST_PROPOSAL_SCHEMA,
      },
      draftContract:{
        participantType:'ai-participant',
        required:['schema','participant','understanding','uncertainties'],
        optional:['proposal'],
        proposalOp:'SET_MEDIA_OFFSET_MS',
      },
    },
    authority:'transport-neutral-invitation',
    boundary:[
      'TRANSPORT != PARTICIPANT',
      'MODEL PROVIDER != AUTHORITY',
      'DECLARED PARTICIPANT != VERIFIED PROVIDER IDENTITY',
      'GUEST PACKET != ROOM ACCESS',
      'SAME OFFER != SAME INTERPRETATION',
      'MULTIPLE ECHOES != CONSENSUS',
      'PROPOSAL SET != DECISION',
    ],
  };
  const guestPortSha256=await hashCanonicalLocal(core);
  return {
    ...core,
    guestPortSha256,
    guestPortId:'guest-port:'+guestPortSha256,
  };
}

async function verifiedGuestPortPacket(room, memories, offer, packet) {
  if (!plain(packet)
    || packet.schema!==GUEST_PORT_SCHEMA
    || !/^[a-f0-9]{64}$/.test(packet.guestPortSha256 ?? '')
    || packet.guestPortId!=='guest-port:'+packet.guestPortSha256
    || packet.authority!=='transport-neutral-invitation')
    return null;
  const core={
    schema:packet.schema,
    port:packet.port,
    humanOffer:packet.humanOffer,
    memoryView:packet.memoryView,
    responseContract:packet.responseContract,
    authority:packet.authority,
    boundary:packet.boundary,
  };
  if (await hashCanonicalLocal(core)!==packet.guestPortSha256) return null;
  const offerCore=await verifiedHumanOffer(room,offer);
  if (!offerCore || !Array.isArray(memories)) return null;

  const expected=await createGuestPortPacket(room,memories,offer);
  if (expected.ok===false
    || expected.guestPortSha256!==packet.guestPortSha256
    || expected.guestPortId!==packet.guestPortId)
    return null;

  return core;
}

function offeredGuestTrack(packet,instrument) {
  return packet.humanOffer?.offered?.find(item=>item.localInstrumentId===instrument) ?? null;
}

export async function createGuestPortResponse(packet, spec) {
  if (!plain(packet)
    || packet.schema!==GUEST_PORT_SCHEMA
    || !/^[a-f0-9]{64}$/.test(packet.guestPortSha256 ?? '')
    || packet.guestPortId!=='guest-port:'+packet.guestPortSha256)
    return fail('invalid-guest-port','Guest response requires a structurally valid Guest Port packet.');
  const packetCore={
    schema:packet.schema,
    port:packet.port,
    humanOffer:packet.humanOffer,
    memoryView:packet.memoryView,
    responseContract:packet.responseContract,
    authority:packet.authority,
    boundary:packet.boundary,
  };
  if (await hashCanonicalLocal(packetCore)!==packet.guestPortSha256)
    return fail('invalid-guest-port','Guest Port packet failed deterministic integrity verification.');

  if (!plain(spec) || spec.schema!==GUEST_DRAFT_SCHEMA)
    return fail('invalid-guest-draft','Guest response requires roroomom.guest-response-draft/v0.');
  if (!validGuestParticipant(spec.participant))
    return fail('invalid-guest-participant','Guest response requires a declared AI participant.');
  if (!strictText(spec.understanding,1200))
    return fail('invalid-guest-echo','Guest response requires a bounded Echo.');
  const uncertainties=uniqueStrings(spec.uncertainties ?? [],12);
  if (!uncertainties)
    return fail('invalid-guest-echo','Guest uncertainties must be bounded unique strings.');

  let proposal=null;
  if (spec.proposal!==undefined && spec.proposal!==null) {
    if (!plain(spec.proposal)
      || spec.proposal.op!=='SET_MEDIA_OFFSET_MS'
      || !strictText(spec.proposal.instrument,500)
      || !boundedInteger(spec.proposal.value,0,600000)
      || !strictText(spec.proposal.rationale,1000))
      return fail('invalid-guest-proposal','Guest proposal is outside the portable response grammar.');

    const offered=offeredGuestTrack(packet,spec.proposal.instrument);
    if (!offered || !Number.isInteger(offered.currentOffsetMs))
      return fail('instrument-not-offered','Guest proposal targets material not offered as a timed media track.');
    if (!packet.humanOffer.capabilities.allowedActions.includes('PROPOSE_MEDIA_OFFSET_MS'))
      return fail('proposal-not-authorized','Guest Port packet did not permit media-offset proposals.');

    const delta=Math.abs(spec.proposal.value-offered.currentOffsetMs);
    if (delta>packet.humanOffer.capabilities.maxOffsetDeltaMs)
      return fail('proposal-exceeds-offer-limit','Guest proposal exceeds the Human Offer timing limit.');

    proposal={
      op:'SET_MEDIA_OFFSET_MS',
      instrument:spec.proposal.instrument,
      fromValue:offered.currentOffsetMs,
      value:spec.proposal.value,
      rationale:spec.proposal.rationale,
    };
  }

  const echoCore={
    participant:clone(spec.participant),
    understanding:spec.understanding,
    uncertainties,
    capabilitiesHeard:clone(packet.humanOffer.capabilities),
    offeredHeard:clone(packet.humanOffer.offered),
    protectedHeard:[...packet.humanOffer.protected],
    memoryObserved:clone(packet.memoryView),
  };
  const echoSha256=await hashCanonicalLocal(echoCore);
  const echo={
    ...echoCore,
    echoSha256,
    echoId:'guest-echo:'+echoSha256,
    authority:'echo-only',
  };

  const core={
    schema:GUEST_RESPONSE_SCHEMA,
    guestPortId:packet.guestPortId,
    guestPortSha256:packet.guestPortSha256,
    participant:clone(spec.participant),
    echo,
    proposal,
    authority:'guest-response-only',
    boundary:[
      'GUEST RESPONSE != ROOM CONSEQUENCE',
      'DECLARED PARTICIPANT != VERIFIED PROVIDER IDENTITY',
      'ECHO != CONSENSUS',
      'AGREEMENT != TRUTH',
      'DISAGREEMENT != FAILURE',
      'PROPOSAL SET != DECISION',
    ],
  };
  const responseSha256=await hashCanonicalLocal(core);
  return {
    ...core,
    responseSha256,
    responseId:'guest-response:'+responseSha256,
  };
}

async function verifiedGuestResponse(packet,response) {
  if (!plain(response)
    || response.schema!==GUEST_RESPONSE_SCHEMA
    || !/^[a-f0-9]{64}$/.test(response.responseSha256 ?? '')
    || response.responseId!=='guest-response:'+response.responseSha256
    || response.guestPortId!==packet.guestPortId
    || response.guestPortSha256!==packet.guestPortSha256
    || response.authority!=='guest-response-only'
    || !validGuestParticipant(response.participant))
    return false;
  const core={
    schema:response.schema,
    guestPortId:response.guestPortId,
    guestPortSha256:response.guestPortSha256,
    participant:response.participant,
    echo:response.echo,
    proposal:response.proposal,
    authority:response.authority,
    boundary:response.boundary,
  };
  return await hashCanonicalLocal(core)===response.responseSha256;
}

export async function importGuestPortResponse(room, memories, offer, packet, response) {
  const packetCore=await verifiedGuestPortPacket(room,memories,offer,packet);
  if (!packetCore)
    return fail('invalid-guest-port','Guest Port packet is stale, altered, or bound to another Room.');
  if (!await verifiedGuestResponse(packet,response))
    return fail('invalid-guest-response','Guest response failed integrity or Guest Port binding.');

  if (response.echo?.participant?.id!==response.participant.id
    || response.echo?.authority!=='echo-only')
    return fail('invalid-guest-echo','Guest Echo participant or authority is inconsistent.');

  let proposal=null;
  if (response.proposal) {
    const offered=offeredGuestTrack(packet,response.proposal.instrument);
    if (!offered || !Number.isInteger(offered.currentOffsetMs))
      return fail('instrument-not-offered','Guest response proposal targets an unoffered timed instrument.');
    if (response.proposal.fromValue!==offered.currentOffsetMs)
      return fail('stale-guest-proposal','Guest proposal does not begin from the packet timing value.');
    const delta=Math.abs(response.proposal.value-response.proposal.fromValue);
    if (delta>packet.humanOffer.capabilities.maxOffsetDeltaMs)
      return fail('proposal-exceeds-offer-limit','Guest response exceeds the Human Offer timing limit.');

    const proposalCore={
      schema:GUEST_PROPOSAL_SCHEMA,
      participant:clone(response.participant),
      target:{
        sourceSubject:room.sourceSubject,
        encounterId:room.encounterId,
        roomScoreSha256:packet.port.roomScoreSha256,
        roomScoreTitle:packet.port.roomScoreTitle,
      },
      basis:{
        sourceRefs:[...new Set(packet.humanOffer.offered.map(item=>item.sourceRef))].sort(),
        memoryRefs:[...packet.memoryView.memoryRefs],
        memoryInvitations:packet.memoryView.invitations.map(item=>clone(item)),
        memoryAuthority:packet.memoryView.authority,
        prophecyAuthority:packet.memoryView.prophecyAuthority,
      },
      crossingContext:{
        humanOfferId:offer.offerId,
        humanOfferSha256:offer.offerSha256,
        guestPortId:packet.guestPortId,
        guestPortSha256:packet.guestPortSha256,
        guestResponseId:response.responseId,
        guestResponseSha256:response.responseSha256,
        guestEchoId:response.echo.echoId,
        guestEchoSha256:response.echo.echoSha256,
      },
      rationale:response.proposal.rationale,
      patch:{
        op:'SET_MEDIA_OFFSET_MS',
        instrument:response.proposal.instrument,
        fromValue:response.proposal.fromValue,
        value:response.proposal.value,
      },
      changes:[{
        field:`roomScore.mediaTracks[${response.proposal.instrument}].offsetMs`,
        from:response.proposal.fromValue,
        to:response.proposal.value,
      }],
      invariants:[
        'sourceSubject',
        'instrument sourceRef',
        'resolved media sha256',
        'lyric sourceRef',
        'lyric cue ranges',
        'reLATTE history',
        'source media bytes',
      ],
      authority:'proposal-only',
      boundary:[
        'GUEST != SYSTEM',
        'GUEST RESPONSE != CONSENT',
        'MULTIPLE ECHOES != CONSENSUS',
        'PROPOSAL SET != DECISION',
        'ACCEPTANCE REQUIRES HUMAN CROSSING',
      ],
    };
    const proposalSha256=await hashCanonicalLocal(proposalCore);
    proposal={
      ...proposalCore,
      proposalSha256,
      proposalId:'proposal:'+proposalSha256,
    };
  }

  return {
    ok:true,
    status:'guest-response-imported',
    participant:clone(response.participant),
    echo:clone(response.echo),
    proposal,
    responseId:response.responseId,
    authority:'none',
  };
}

export async function projectGuestPortResponses(packet,responses) {
  if (!plain(packet) || packet.schema!==GUEST_PORT_SCHEMA || !Array.isArray(responses))
    return fail('invalid-guest-response-set','Guest response projection requires one packet and an array of responses.');

  const valid=[];
  let invalidCount=0;
  for (const response of responses) {
    if (await verifiedGuestResponse(packet,response)) valid.push(response);
    else invalidCount+=1;
  }

  return {
    schema:'roroomom.guest-response-projection/v0',
    guestPortId:packet.guestPortId,
    responses:valid.map(response=>({
      responseId:response.responseId,
      participant:clone(response.participant),
      echo:{
        understanding:response.echo.understanding,
        uncertainties:[...response.echo.uncertainties],
      },
      proposal:response.proposal ? clone(response.proposal) : null,
    })),
    invalidCount,
    boundary:[
      'MULTIPLE ECHOES != CONSENSUS',
      'AGREEMENT != TRUTH',
      'DISAGREEMENT != FAILURE',
      'PROPOSAL SET != DECISION',
    ],
    authority:'none',
  };
}

export async function resolveHumanAiCrossing(room, proposal, decision) {
  if (!room?.ok || room.status!=='local-encounter' || !room.roomScore)
    return fail('score-not-compiled','A Room Score must exist before resolving an AI crossing.');
  if (!HUMAN_AI_DECISIONS.has(decision))
    return fail('invalid-human-decision','Human crossing decision must be ACCEPT, HOLD, or REFUSE.');

  const core=await verifiedProposalCore(proposal);
  if (!core)
    return fail('invalid-ai-proposal','AI proposal failed deterministic integrity verification.');
  if (proposal.target.sourceSubject!==room.sourceSubject
    || proposal.target.encounterId!==room.encounterId)
    return fail('proposal-target-mismatch','AI proposal targets a different Room encounter.');

  const preScoreSha256=await roomScoreSha256(room);
  if (proposal.target.roomScoreSha256!==preScoreSha256)
    return fail('stale-ai-proposal','Room Score changed after the AI proposal was created.');

  let nextRoom=room;
  let postScoreSha256=preScoreSha256;

  if (decision==='ACCEPT') {
    if (!validOffsetPatch(room,{
      op:proposal.patch.op,
      instrument:proposal.patch.instrument,
      value:proposal.patch.value,
    }))
      return fail('invalid-ai-patch','AI proposal patch is no longer valid for this Room Score.');

    const spec={
      schema:ROOM_SCORE_SCHEMA,
      title:room.roomScore.title,
      clock:room.roomScore.clock,
      mediaTracks:room.roomScore.mediaTracks.map(track=>({
        instrument:track.instrument,
        offsetMs:track.instrument===proposal.patch.instrument
          ? proposal.patch.value
          : track.offsetMs,
      })),
      lyricTrack:{
        instrument:room.roomScore.lyricTrack.instrument,
        cues:room.roomScore.lyricTrack.cues.map(cue=>({
          atMs:cue.atMs,
          fromLine:cue.fromLine,
          toLine:cue.toLine,
        })),
      },
    };

    nextRoom=compileRoomScore(room,spec);
    if (nextRoom.ok===false) return nextRoom;
    postScoreSha256=await roomScoreSha256(nextRoom);
  }

  const receiptCore={
    schema:HUMAN_AI_RECEIPT_SCHEMA,
    proposalId:proposal.proposalId,
    proposalSha256:proposal.proposalSha256,
    participant:proposal.participant,
    crossingContext:proposal.crossingContext ?? null,
    sourceSubject:room.sourceSubject,
    encounterId:room.encounterId,
    decision,
    preScoreSha256,
    postScoreSha256,
    changed:decision==='ACCEPT' && preScoreSha256!==postScoreSha256,
    appliedPatch:decision==='ACCEPT' ? clone(proposal.patch) : null,
    authority:'human-local-decision',
    boundary:[
      'AI PROPOSAL != HUMAN DECISION',
      'HOLD != ACCEPT',
      'REFUSE != ERASURE',
      'ACCEPT != SOURCE AUTHORITY',
      'LOCAL SCORE CHANGE != SOURCE MUTATION',
    ],
  };
  const receiptSha256=await hashCanonicalLocal(receiptCore);
  const crossingReceipt={
    ...receiptCore,
    receiptSha256,
    receiptId:'human-ai-crossing:'+receiptSha256,
  };

  nextRoom={
    ...nextRoom,
    localHistory:[
      ...nextRoom.localHistory,
      {
        type:`HUMAN_AI_${decision}`,
        proposalId:proposal.proposalId,
        crossingReceiptId:crossingReceipt.receiptId,
        changed:crossingReceipt.changed,
      },
    ],
    sourceMutated:false,
    sharedWorldChanged:false,
  };

  return {
    ok:true,
    room:nextRoom,
    crossingReceipt,
  };
}
