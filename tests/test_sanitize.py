from build.sanitize import sanitize


def test_user_table_is_dropped():
    out = sanitize({"user": [{"email": "a@b.com"}], "bill": [{"id": "1"}]})
    assert "user" not in out
    assert out["bill"] == [{"id": "1"}]


def test_token_table_is_dropped():
    out = sanitize({"password_reset_token": [{"token": "secret"}], "bill": []})
    assert "password_reset_token" not in out


def test_dropped_tables_full_list():
    """All ten user-private tables get dropped."""
    full_input = {
        t: [{"x": "y"}] for t in [
            "user", "password_reset_token", "intern", "intern_action_log",
            "active_version_email_sent", "bill_notification", "bill_flag",
            "bill_tracking", "user_flag_preference",
            "legislator_organization_tracking", "opinion_version_dismissal",
            "alembic_version",
        ]
    }
    full_input["bill"] = []
    out = sanitize(full_input)
    assert set(out.keys()) == {"bill"}


def test_opinion_comments_replaced():
    opinions = [
        {"id": "1", "bill_id": "100", "user_id": "5", "user_org_id": "9",
         "comments": "Real lobbyist comment", "opinion": "support"},
    ]
    out = sanitize({"opinions": opinions, "bill": []})
    assert out["opinions"][0]["comments"] != "Real lobbyist comment"
    assert out["opinions"][0]["comments"]  # not empty


def test_opinion_user_id_remapped():
    opinions = [
        {"id": "1", "bill_id": "100", "user_id": "5", "user_org_id": "9",
         "comments": "x", "opinion": "support"},
    ]
    out = sanitize({"opinions": opinions, "bill": []})
    assert out["opinions"][0]["user_org_id"].startswith("demo-")


def test_opinion_remapping_is_deterministic():
    opinions = [
        {"id": "1", "user_org_id": "9", "comments": "x", "opinion": "s"},
        {"id": "2", "user_org_id": "9", "comments": "x", "opinion": "s"},
        {"id": "3", "user_org_id": "12", "comments": "x", "opinion": "s"},
    ]
    out = sanitize({"opinions": opinions, "bill": []})
    assert out["opinions"][0]["user_org_id"] == out["opinions"][1]["user_org_id"]
    assert out["opinions"][0]["user_org_id"] != out["opinions"][2]["user_org_id"]


def test_notes_table_is_replaced_with_empty_list():
    """Real notes are dropped; fabricated demo notes are injected later from seed."""
    notes = [{"id": "1", "user_id": "5", "note": "real note", "bill_id": "100"}]
    out = sanitize({"notes": notes, "bill": []})
    assert out["notes"] == []


import pytest
from build.sanitize import SecretLeak


def test_email_in_sanitized_output_raises():
    tables = {"bill": [{"id": "1", "sponsor": "Rep. someone@example.com"}]}
    with pytest.raises(SecretLeak, match="email"):
        sanitize(tables, real_user_names=set())


def test_password_substring_raises():
    tables = {"bill": [{"id": "1", "sponsor": "SECRET_KEY value"}]}
    with pytest.raises(SecretLeak):
        sanitize(tables, real_user_names=set())


def test_real_user_name_raises():
    tables = {"bill": [{"id": "1", "title": "Bill about Alice Stevens"}]}
    with pytest.raises(SecretLeak, match="user name"):
        sanitize(tables, real_user_names={"Alice Stevens"})


def test_clean_input_passes():
    tables = {"bill": [{"id": "1", "title": "School Funding Amendments"}]}
    out = sanitize(tables, real_user_names={"Alice Stevens"})
    assert out["bill"][0]["title"] == "School Funding Amendments"
