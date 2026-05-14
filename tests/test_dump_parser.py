from pathlib import Path
from build.dump_parser import parse_dump

FIXTURE = Path(__file__).parent / "fixtures" / "sample_dump.sql"


def test_parse_dump_returns_all_tables():
    tables = dict(parse_dump(FIXTURE))
    assert set(tables) == {"bill", "user", "legislator"}


def test_bill_rows_have_expected_columns():
    tables = dict(parse_dump(FIXTURE))
    bills = tables["bill"]
    assert len(bills) == 3
    assert bills[0]["id"] == "1"
    assert bills[0]["bill_number"] == "HB0001"
    assert bills[0]["sponsor"] == "Rep. Test"


def test_tab_escape_inside_value():
    tables = dict(parse_dump(FIXTURE))
    assert tables["bill"][0]["title"] == "Tab\tin Title"


def test_null_marker_becomes_none():
    tables = dict(parse_dump(FIXTURE))
    assert tables["bill"][1]["sponsor"] is None


def test_backslash_escape():
    tables = dict(parse_dump(FIXTURE))
    assert tables["bill"][2]["title"] == "Backslash \\ test"


def test_newline_escape_in_value():
    tables = dict(parse_dump(FIXTURE))
    assert "two\nlines" in tables["bill"][0]["detailed_description"]


def test_quoted_table_name():
    tables = dict(parse_dump(FIXTURE))
    assert "user" in tables  # was `public."user"` in dump
