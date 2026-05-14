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
