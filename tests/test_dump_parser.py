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
