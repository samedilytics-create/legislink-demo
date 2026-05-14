import json
from pathlib import Path
from build.writers import write_bills, write_legislators


def test_write_bills_emits_array(tmp_path: Path):
    bills = [
        {"id": "1", "bill_number": "HB0001", "title": "Test",
         "sponsor": "Rep. X", "detailed_description": "desc",
         "ongoing_cost": "$0", "one_time_cost": "$0", "total_cost": "$0",
         "version": "1", "location": "House"},
    ]
    versions = [
        {"id": "1", "bill_id": "1", "version": "1", "active": "t",
         "subjects": "Education", "fiscal_note_url": ""},
    ]
    out = tmp_path / "bills.json"
    write_bills(out, bills, versions)
    payload = json.loads(out.read_text())
    assert payload[0]["bill_number"] == "HB0001"
    assert payload[0]["versions"][0]["version"] == "1"


def test_write_legislators(tmp_path: Path):
    legs = [
        {"id": "100", "legislator_id": "TL01", "district": "1",
         "house": "H", "party": "R", "username": "test_legi",
         "counties": "Salt Lake", "legislator_url": "https://...",
         "photo_url": "https://..."},
    ]
    out = tmp_path / "legislators.json"
    write_legislators(out, legs)
    payload = json.loads(out.read_text())
    assert payload[0]["legislator_id"] == "TL01"
