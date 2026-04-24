import base64
import logging
import os

import httpx

_GITHUB_API = "https://api.github.com"
_REPO = "fe-malveira-87/calculadora-preco"
_BRANCH = "main"


class GitHubClient:
    def __init__(self):
        self.token = os.environ.get("GITHUB_TOKEN", "")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _get_file_sha(self, path: str) -> str | None:
        r = httpx.get(
            f"{_GITHUB_API}/repos/{_REPO}/contents/{path}",
            headers=self.headers,
            params={"ref": _BRANCH},
        )
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()["sha"]

    def upsert_file(self, path: str, content: str, message: str) -> None:
        sha = self._get_file_sha(path)
        body: dict = {
            "message": message,
            "content": base64.b64encode(content.encode()).decode(),
            "branch": _BRANCH,
        }
        if sha:
            body["sha"] = sha
        r = httpx.put(
            f"{_GITHUB_API}/repos/{_REPO}/contents/{path}",
            headers=self.headers,
            json=body,
        )
        r.raise_for_status()

    def delete_file(self, path: str, message: str) -> None:
        sha = self._get_file_sha(path)
        if not sha:
            return
        r = httpx.delete(
            f"{_GITHUB_API}/repos/{_REPO}/contents/{path}",
            headers=self.headers,
            json={"message": message, "sha": sha, "branch": _BRANCH},
        )
        r.raise_for_status()
