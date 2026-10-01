# Room 005 — Room Score

Room 005 turns the Magic Lego deck into a **local conductor**.

The score is not another source object and does not rewrite any upstream media:

```text
verified song bytes
+
filmmaker-accepted private video
+
exact locally matched lyric bytes
        ↓
explicit local Room Score
        ↓
one playback clock
+
media offsets
+
lyric cue ranges
        ↓
synchronized local encounter
```

## Text Sheet boundary

The Text Sheet does not require a new central lyric service.

A user chooses local UTF-8 `.txt` or `.md` bytes. ROroomOM computes SHA-256 in the local runtime and admits them only if:

```text
sha256(local bytes)
==
Text Sheet sourceRef
```

The local encounter may display the text. Its exported receipt records only the address, digest, byte count and line count — **not the lyric plaintext**.

```text
LOCAL FILE != SOURCE AUTHORITY
TEXT BYTES MUST MATCH ADDRESS
DISPLAY != SOURCE MUTATION
```

## Room Score v0

A score names:

- one resolved audio/video Lego as the clock;
- 1–8 already-resolved media tracks;
- a receiver-local seek offset for each media track;
- one exact resolved Text Sheet;
- ordered lyric cues expressed as line ranges and millisecond positions.

Example:

```json
{
  "schema": "roroomom.room-score/v0",
  "title": "Local Room Score",
  "clock": "lego:2:audio-player",
  "mediaTracks": [
    {"instrument": "lego:2:audio-player", "offsetMs": 0},
    {"instrument": "lego:4:video-player", "offsetMs": 250}
  ],
  "lyricTrack": {
    "instrument": "lego:3:text-sheet",
    "cues": [
      {"atMs": 0, "fromLine": 1, "toLine": 4},
      {"atMs": 8000, "fromLine": 5, "toLine": 8}
    ]
  }
}
```

Compilation freezes the source refs and resolved SHA-256 values into the local arrangement. If a resolved media identity or lyric digest changes afterward, score-frame evaluation refuses.

## Browser conductor

The Room workstation now exposes:

1. exact local Text Sheet loading;
2. a visible/editable score JSON surface;
3. **Draft local score** as a receiver-local starting suggestion;
4. **Compile score** as the explicit local arrangement step;
5. **Conduct** to use the selected media Lego as one playback clock;
6. drift correction for the other media renderer;
7. a lyric window driven by explicit cue ranges;
8. **Stop** plus local conduct/stop trace events.

Draft cue timing is only a local editable suggestion. Nothing becomes authoritative until the user compiles the score, and even the compiled score has `authority: none`.

## Laws

```text
ROOM SCORE != SOURCE
SYNC != MERGER
CUE != CLAIM
LOCAL ARRANGEMENT != SOURCE MUTATION
COMPOSITION != OWNERSHIP

ONE CLOCK
!=
ONE IDENTITY
```

## Receipt

The ordinary ROroomOM local encounter receipt now contains the compiled Room Score plus addressed resolution descriptors. It does not masquerade as a reLATTE receipt and does not embed lyric plaintext.

The result is a reproducible statement of:

> **these exact addressed particulars were locally arranged this way**

—not:

> these particulars became one source.
