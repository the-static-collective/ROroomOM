"""ROroomOM COM5 Room 002: bounded Static Workbench source-inspector organ.

This module does not read the filesystem directly. It composes the existing
ROroomOM WorkbenchReadAdapter, which owns the loopback/version/path boundary.
"""
from __future__ import annotations

from pathlib import Path
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bridge_core import BridgeError, WorkbenchReadAdapter  # noqa: E402


ORGAN_ID = "static-workbench.source-inspector-v1"


class WorkbenchSourceOrgan:
    def __init__(self, adapter: WorkbenchReadAdapter):
        self.adapter = adapter

    def status(self) -> dict[str, Any]:
        identity = self.adapter.identity()
        return {
            "organ": ORGAN_ID,
            "owner": "the-static-collective/static-workbench",
            "authority": "none",
            "effect": "read-only local source inspection",
            "identity": identity,
            "boundary": [
                "SOURCE REF != LOCAL PATH",
                "WORKBENCH READ != SOURCE AUTHORITY",
                "INSPECTION != ADMISSION",
            ],
        }

    def catalog(self) -> dict[str, Any]:
        repos = self.adapter.repos()
        return {
            "organ": ORGAN_ID,
            "authority": "none",
            "repositories": [
                {
                    "name": repo["name"],
                    "repo_path": repo["repo_path"],
                    "head": repo["head"],
                    "dirty": repo["dirty"],
                    "detached": repo["detached"],
                }
                for repo in repos
            ],
            "note": "Repository coordinates are Workbench-local discovery, not source identity.",
        }

    def _select_repo(self, repo_name: str) -> dict[str, Any]:
        if not isinstance(repo_name, str) or not 1 <= len(repo_name.strip()) <= 240:
            raise BridgeError(400, "Choose one Workbench-discovered repository.")
        name = repo_name.strip()
        matches = [
            repo for repo in self.adapter.repos()
            if repo["name"] == name or repo["repo_path"] == name
        ]
        if len(matches) == 0:
            raise BridgeError(404, "No Workbench-discovered repository matches that local name.")
        if len(matches) > 1:
            raise BridgeError(409, "Repository name is ambiguous; choose its displayed repo_path.")
        return matches[0]

    def prepare(self, repo_name: str, source_path: str) -> dict[str, Any]:
        repo = self._select_repo(repo_name)
        prepared = self.adapter.prepare(repo["root_id"], repo["repo_path"], source_path)
        return {
            "organ": ORGAN_ID,
            "status": "prepared-not-inspected",
            "ticket": prepared["ticket"],
            "repository": {
                "name": repo["name"],
                "repo_path": repo["repo_path"],
                "head": prepared["head"],
            },
            "source_path": prepared["source_path"],
            "contentSha256": prepared["contentSha256"],
            "bytes": prepared["bytes"],
            "preview": prepared["preview"],
            "expiresSeconds": prepared["expiresSeconds"],
            "authority": "none",
            "boundary": "Exact local Workbench read prepared; no file content has been admitted into the Room.",
        }

    def inspect(self, ticket: str) -> dict[str, Any]:
        if not isinstance(ticket, str) or not 8 <= len(ticket) <= 200:
            raise BridgeError(400, "A bounded prepare ticket is required.")
        inspected = self.adapter.inspect(ticket)
        return {
            "organ": ORGAN_ID,
            "status": "inspected-once",
            "repository": {
                "repo_path": inspected["repo_path"],
                "head": inspected["head"],
            },
            "source_path": inspected["source_path"],
            "contentSha256": inspected["contentSha256"],
            "excerpt": inspected["excerpt"],
            "contentTruncated": inspected["contentTruncated"],
            "contentBytes": inspected["contentBytes"],
            "checkedAt": inspected["checkedAt"],
            "authority": "none",
            "sourceBoundary": inspected["boundary"],
            "roomBoundary": "Workbench excerpt is local inspected evidence; it is not automatically attached to the source particular or admitted as canon.",
        }
