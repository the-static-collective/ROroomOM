"""ROroomOM COM5 Room 004: read-only Haunted Blender accepted-video organ."""
from __future__ import annotations

import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SHA_ADDRESS = re.compile(r"^sha256:([a-f0-9]{64})$")
EXPECTED_SCHEMA = "haunted-blender/accepted-video-resolver/v0"
EXPECTED_STATUS_SCHEMA = "haunted-blender-accepted-video-resolver-status/v0"


class BlenderVideoError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


class BlenderVideoOrgan:
    def __init__(self, port: int = 13704):
        if not 1 <= port <= 65535:
            raise ValueError("Haunted Blender resolver port out of range")
        self.base = f"http://127.0.0.1:{port}"

    def _json(self, path: str) -> dict:
        try:
            request = Request(
                self.base + path,
                method="GET",
                headers={"Accept": "application/json"},
            )
            with urlopen(request, timeout=4) as response:
                raw = response.read(64_000 + 1)
                if len(raw) > 64_000:
                    raise BlenderVideoError(413, "Blender resolver response exceeds 64 KiB.")
                value = json.loads(raw)
                if not isinstance(value, dict):
                    raise ValueError("expected JSON object")
                return value
        except BlenderVideoError:
            raise
        except HTTPError as exc:
            detail = "Haunted Blender refused the video address."
            try:
                payload = json.loads(exc.read(8192))
                if isinstance(payload, dict) and isinstance(payload.get("detail"), str):
                    detail = payload["detail"]
            except Exception:
                pass
            raise BlenderVideoError(exc.code, detail) from exc
        except (URLError, OSError, TimeoutError) as exc:
            raise BlenderVideoError(503, "Haunted Blender video resolver is unavailable.") from exc
        except (ValueError, json.JSONDecodeError) as exc:
            raise BlenderVideoError(502, "Blender resolver returned incompatible JSON.") from exc

    def status(self) -> dict:
        try:
            status = self._json("/v0/status")
        except BlenderVideoError as exc:
            return {
                "organ": "haunted-blender.accepted-video-resolver-v0",
                "owner": "the-static-collective/the-haunted-blender",
                "connected": False,
                "authority": "none",
                "reason": exc.detail,
            }

        compatible = (
            status.get("schema") == EXPECTED_STATUS_SCHEMA
            and status.get("status") == "ready"
            and status.get("authority") == "none"
            and status.get("transport") == "loopback-read-only"
            and status.get("selection") == "filmmaker-accepted-private-take-only"
        )
        return {
            "organ": "haunted-blender.accepted-video-resolver-v0",
            "owner": "the-static-collective/the-haunted-blender",
            "connected": compatible,
            "authority": "none",
            "reason": None if compatible else "Haunted Blender resolver identity is incompatible.",
        }

    def resolve(self, address: str) -> dict:
        match = SHA_ADDRESS.fullmatch(address) if isinstance(address, str) else None
        if match is None:
            raise BlenderVideoError(400, "Video instrument requires sha256:<64 lowercase hex>.")

        digest = match.group(1)
        value = self._json(f"/v0/resolve/{digest}")
        boundary = value.get("boundary")

        if (
            value.get("schema") != EXPECTED_SCHEMA
            or value.get("status") != "resolved-filmmaker-accepted-private-take"
            or value.get("address") != address
            or value.get("sha256") != digest
            or value.get("authority") != "none"
            or value.get("mediaType") != "video/mp4"
            or value.get("distributionAuthorized") is not False
            or not isinstance(value.get("byteLength"), int)
            or value["byteLength"] <= 0
            or not isinstance(boundary, list)
            or "CANDIDATE != FILMMAKER ACCEPTED TAKE" not in boundary
            or "RESOLUTION REQUIRES BYTE REVERIFICATION" not in boundary
        ):
            raise BlenderVideoError(502, "Haunted Blender descriptor failed the Room contract.")

        return {
            "organ": "haunted-blender.accepted-video-resolver-v0",
            "status": "resolved-filmmaker-accepted-private-take",
            "address": address,
            "mediaType": "video/mp4",
            "byteLength": value["byteLength"],
            "sha256": digest,
            "durationSeconds": value.get("durationSeconds"),
            "width": value.get("width"),
            "height": value.get("height"),
            "artifactId": value.get("artifactId"),
            "beat": value.get("beat"),
            "acceptanceSha256": value.get("acceptanceSha256"),
            "distributionAuthorized": False,
            "playbackUrl": f"{self.base}/v0/media/{digest}",
            "authority": "none",
            "boundary": [
                "VIDEO WINDOW != RELEASE",
                "PLAYBACK != BLENDER EDIT",
                "BLENDER ACCEPTANCE != ROOM AUTHORITY",
            ],
        }
