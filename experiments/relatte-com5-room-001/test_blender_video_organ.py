from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("blender_video_organ", HERE / "blender_video_organ.py")
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

BlenderVideoOrgan = module.BlenderVideoOrgan
BlenderVideoError = module.BlenderVideoError


class BlenderVideoOrganTests(unittest.TestCase):
    def setUp(self):
        self.organ = BlenderVideoOrgan(13704)
        self.digest = "c" * 64
        self.address = "sha256:" + self.digest

    def descriptor(self):
        return {
            "schema": "haunted-blender/accepted-video-resolver/v0",
            "status": "resolved-filmmaker-accepted-private-take",
            "address": self.address,
            "sha256": self.digest,
            "byteLength": 8192,
            "mediaType": "video/mp4",
            "acceptanceSha256": "a" * 64,
            "requestSha256": "b" * 64,
            "artifactSha256": "d" * 64,
            "artifactId": "scene-artifact:test",
            "beat": 1,
            "durationSeconds": 1.0,
            "width": 320,
            "height": 180,
            "distributionAuthorized": False,
            "authority": "none",
            "boundary": [
                "CANDIDATE != FILMMAKER ACCEPTED TAKE",
                "RESOLUTION REQUIRES BYTE REVERIFICATION",
            ],
        }

    def test_status_requires_accepted_private_take_identity(self):
        with patch.object(self.organ, "_json", return_value={
            "schema": "haunted-blender-accepted-video-resolver-status/v0",
            "status": "ready",
            "authority": "none",
            "transport": "loopback-read-only",
            "selection": "filmmaker-accepted-private-take-only",
        }):
            status = self.organ.status()
        self.assertTrue(status["connected"])

    def test_exact_address_becomes_private_video_window_descriptor(self):
        with patch.object(self.organ, "_json", return_value=self.descriptor()):
            resolved = self.organ.resolve(self.address)

        self.assertEqual(resolved["address"], self.address)
        self.assertEqual(resolved["playbackUrl"], f"http://127.0.0.1:13704/v0/media/{self.digest}")
        self.assertFalse(resolved["distributionAuthorized"])
        self.assertEqual(resolved["authority"], "none")

    def test_candidate_without_filmmaker_accepted_status_is_refused(self):
        value = self.descriptor()
        value["status"] = "candidate_admitted_not_filmmaker_accepted"
        with patch.object(self.organ, "_json", return_value=value):
            with self.assertRaises(BlenderVideoError) as caught:
                self.organ.resolve(self.address)
        self.assertEqual(caught.exception.status, 502)

    def test_digest_substitution_is_refused(self):
        value = self.descriptor()
        value["address"] = "sha256:" + "e" * 64
        value["sha256"] = "e" * 64
        with patch.object(self.organ, "_json", return_value=value):
            with self.assertRaises(BlenderVideoError) as caught:
                self.organ.resolve(self.address)
        self.assertEqual(caught.exception.status, 502)


if __name__ == "__main__":
    unittest.main()
