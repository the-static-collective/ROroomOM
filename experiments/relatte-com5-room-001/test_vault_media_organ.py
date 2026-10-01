from __future__ import annotations

import importlib.util
from io import BytesIO
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("vault_media_organ", HERE / "vault_media_organ.py")
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

VaultMediaOrgan = module.VaultMediaOrgan
VaultMediaError = module.VaultMediaError


class FakeResponse:
    def __init__(self, value):
        self.body = json.dumps(value).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self, _limit):
        return self.body


class VaultMediaOrganTests(unittest.TestCase):
    def setUp(self):
        self.organ = VaultMediaOrgan(13703)
        self.digest = "a" * 64
        self.address = "sha256:" + self.digest

    def test_status_accepts_only_expected_read_only_identity(self):
        with patch.object(self.organ, "_json", return_value={
            "schema": "autodiscography-vault-resolver-status/v0",
            "status": "ready",
            "authority": "none",
            "transport": "loopback-read-only",
        }):
            status = self.organ.status()
        self.assertTrue(status["connected"])
        self.assertEqual(status["authority"], "none")

    def test_resolve_preserves_exact_address_and_returns_playback_url(self):
        with patch.object(self.organ, "_json", return_value={
            "schema": "autodiscography-vault-resolver/v0",
            "status": "resolved-verified",
            "address": self.address,
            "sha256": self.digest,
            "byteLength": 1234,
            "mediaType": "audio/wav",
            "assetRole": "audio_wav",
            "providerTrackId": "track-alpha",
            "observedAt": "2026-10-01T19:45:00.000Z",
            "authority": "none",
            "boundary": [
                "ADDRESS != AUTHORITY",
                "RESOLUTION REQUIRES BYTE REVERIFICATION",
            ],
        }):
            resolved = self.organ.resolve(self.address)

        self.assertEqual(resolved["address"], self.address)
        self.assertEqual(resolved["sha256"], self.digest)
        self.assertEqual(resolved["playbackUrl"], f"http://127.0.0.1:13703/v0/media/{self.digest}")
        self.assertEqual(resolved["authority"], "none")

    def test_resolver_cannot_substitute_a_different_digest(self):
        with patch.object(self.organ, "_json", return_value={
            "schema": "autodiscography-vault-resolver/v0",
            "status": "resolved-verified",
            "address": "sha256:" + "b" * 64,
            "sha256": "b" * 64,
            "byteLength": 1234,
            "mediaType": "audio/wav",
            "authority": "none",
            "boundary": ["RESOLUTION REQUIRES BYTE REVERIFICATION"],
        }):
            with self.assertRaises(VaultMediaError) as caught:
                self.organ.resolve(self.address)
        self.assertEqual(caught.exception.status, 502)

    def test_non_sha_address_is_refused_without_calling_resolver(self):
        with patch.object(self.organ, "_json") as call:
            with self.assertRaises(VaultMediaError) as caught:
                self.organ.resolve("file:///music/song.wav")
        self.assertEqual(caught.exception.status, 400)
        call.assert_not_called()


if __name__ == "__main__":
    unittest.main()
