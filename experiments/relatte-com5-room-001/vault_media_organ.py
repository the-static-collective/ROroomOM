"""ROroomOM COM5 Room 003: read-only Autodiscography Vault audio organ."""
from __future__ import annotations

import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

SHA_ADDRESS = re.compile(r"^sha256:([a-f0-9]{64})$")
EXPECTED_SCHEMA = "autodiscography-vault-resolver/v0"
EXPECTED_STATUS_SCHEMA = "autodiscography-vault-resolver-status/v0"


class VaultMediaError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


class VaultMediaOrgan:
    def __init__(self, port: int = 13703):
        if not 1 <= port <= 65535:
            raise ValueError("Vault resolver port out of range")
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
                    raise VaultMediaError(413, "Vault resolver response exceeds 64 KiB.")
                value = json.loads(raw)
                if not isinstance(value, dict):
                    raise ValueError("expected JSON object")
                return value
        except VaultMediaError:
            raise
        except HTTPError as exc:
            detail = "Vault resolver refused the address."
            try:
                payload = json.loads(exc.read(8192))
                if isinstance(payload, dict) and isinstance(payload.get("detail"), str):
                    detail = payload["detail"]
            except Exception:
                pass
            raise VaultMediaError(exc.code, detail) from exc
        except (URLError, OSError, TimeoutError) as exc:
            raise VaultMediaError(503, "Autodiscography Vault resolver is unavailable.") from exc
        except (ValueError, json.JSONDecodeError) as exc:
            raise VaultMediaError(502, "Vault resolver returned incompatible JSON.") from exc

    def status(self) -> dict:
        try:
            status = self._json("/v0/status")
        except VaultMediaError as exc:
            return {
                "organ": "autodiscography-vault.audio-resolver-v0",
                "owner": "the-static-collective/autodiscography-vault",
                "connected": False,
                "authority": "none",
                "reason": exc.detail,
            }

        compatible = (
            status.get("schema") == EXPECTED_STATUS_SCHEMA
            and status.get("status") == "ready"
            and status.get("authority") == "none"
            and status.get("transport") == "loopback-read-only"
        )
        return {
            "organ": "autodiscography-vault.audio-resolver-v0",
            "owner": "the-static-collective/autodiscography-vault",
            "connected": compatible,
            "authority": "none",
            "reason": None if compatible else "Vault resolver identity is incompatible.",
        }

    def resolve(self, address: str) -> dict:
        match = SHA_ADDRESS.fullmatch(address) if isinstance(address, str) else None
        if match is None:
            raise VaultMediaError(400, "Audio instrument requires sha256:<64 lowercase hex>.")

        digest = match.group(1)
        value = self._json(f"/v0/resolve/{digest}")

        if (
            value.get("schema") != EXPECTED_SCHEMA
            or value.get("status") != "resolved-verified"
            or value.get("address") != address
            or value.get("sha256") != digest
            or value.get("authority") != "none"
            or value.get("mediaType") not in {"audio/wav", "audio/mpeg"}
            or not isinstance(value.get("byteLength"), int)
            or value["byteLength"] <= 0
        ):
            raise VaultMediaError(502, "Vault resolver descriptor failed the Room contract.")

        boundary = value.get("boundary")
        if not isinstance(boundary, list) or "RESOLUTION REQUIRES BYTE REVERIFICATION" not in boundary:
            raise VaultMediaError(502, "Vault resolver omitted its byte-verification boundary.")

        return {
            "organ": "autodiscography-vault.audio-resolver-v0",
            "status": "resolved-verified",
            "address": address,
            "mediaType": value["mediaType"],
            "byteLength": value["byteLength"],
            "sha256": digest,
            "assetRole": value.get("assetRole"),
            "providerTrackId": value.get("providerTrackId"),
            "observedAt": value.get("observedAt"),
            "playbackUrl": f"{self.base}/v0/media/{digest}",
            "authority": "none",
            "boundary": [
                "PLAYER != OWNER",
                "PLAYBACK != SOURCE MUTATION",
                "VAULT RESOLUTION != ROOM ADMISSION",
            ],
        }
