"""Jinja globals matching what the Flask app's templates reference."""
from __future__ import annotations
from dataclasses import dataclass, field
from build.url_map import url_for


@dataclass(frozen=True)
class DemoUser:
    is_authenticated: bool = False
    role: str = ""
    username: str = ""

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_lobbyist(self) -> bool:
        return self.role == "lobbyist"

    @property
    def is_legislator(self) -> bool:
        return self.role == "legislator"

    @classmethod
    def anonymous(cls) -> "DemoUser":
        return cls()

    @classmethod
    def lobbyist(cls) -> "DemoUser":
        return cls(is_authenticated=True, role="lobbyist", username="Alex Chen")

    @classmethod
    def legislator(cls) -> "DemoUser":
        return cls(is_authenticated=True, role="legislator", username="Rep. Jordan Smith")


@dataclass(frozen=True)
class _Request:
    endpoint: str


@dataclass
class _SessionTimeout:
    # ~10 years, so the in-template auto-logout script is effectively a no-op.
    seconds: int = 10 * 365 * 24 * 3600

    def total_seconds(self) -> float:
        return float(self.seconds)


@dataclass
class _Config:
    PERMANENT_SESSION_LIFETIME: _SessionTimeout = field(default_factory=_SessionTimeout)

    def get(self, key, default=None):
        return getattr(self, key, default)


def make_globals(*, endpoint: str, user: DemoUser | None) -> dict:
    return {
        "url_for": url_for,
        "current_user": user or DemoUser.anonymous(),
        "request": _Request(endpoint=endpoint),
        "get_flashed_messages": lambda **kw: [],
        "config": _Config(),
    }
