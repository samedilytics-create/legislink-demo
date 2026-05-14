"""Parse a `pg_dump --inserts=false` plain-text dump into row dicts.

Only handles the COPY ... FROM stdin form. No DB driver needed.
"""

from __future__ import annotations
import re
from pathlib import Path
from typing import Iterator

_COPY_RE = re.compile(
    r'^COPY public\.(?P<table>"?\w+"?) \((?P<cols>[^)]+)\) FROM stdin;\s*$'
)


def _unquote_table(name: str) -> str:
    return name.strip('"')


def parse_dump(path: Path) -> Iterator[tuple[str, list[dict]]]:
    """Yield (table_name, [row_dict, ...]) for every COPY block in the dump."""
    text = Path(path).read_text(encoding="utf-8")
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        m = _COPY_RE.match(lines[i])
        if not m:
            i += 1
            continue
        table = _unquote_table(m.group("table"))
        cols = [c.strip() for c in m.group("cols").split(",")]
        rows: list[dict] = []
        i += 1
        while i < len(lines) and lines[i] != r"\.":
            rows.append(_parse_row(lines[i], cols))
            i += 1
        yield table, rows
        i += 1  # skip the \. terminator


def _parse_row(line: str, cols: list[str]) -> dict:
    values = _split_tsv(line)
    return {col: val for col, val in zip(cols, values)}


def _split_tsv(line: str) -> list[str]:
    """Split a Postgres TSV row on unescaped tabs, applying escape rules."""
    values: list[str] = []
    buf: list[str] = []
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == "\\" and i + 1 < len(line):
            nxt = line[i + 1]
            if nxt == "N":
                # \N → None marker; consume both and finalize this field
                # but only if it's the entire field. Defer to caller via "\N"
                buf.append("\\N")
                i += 2
                continue
            mapping = {"t": "\t", "n": "\n", "r": "\r", "\\": "\\"}
            if nxt in mapping:
                buf.append(mapping[nxt])
                i += 2
                continue
            buf.append(ch)
            i += 1
        elif ch == "\t":
            values.append("".join(buf))
            buf = []
            i += 1
        else:
            buf.append(ch)
            i += 1
    values.append("".join(buf))
    return [None if v == "\\N" else v for v in values]
