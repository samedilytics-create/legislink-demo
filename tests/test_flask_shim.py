from build.flask_shim import make_globals, DemoUser


def test_unauthenticated_user_defaults():
    g = make_globals(endpoint="index", user=None)
    user = g["current_user"]
    assert user.is_authenticated is False
    assert user.is_admin is False


def test_authenticated_lobbyist():
    g = make_globals(endpoint="lobbyist_routes.home", user=DemoUser.lobbyist())
    user = g["current_user"]
    assert user.is_authenticated is True
    assert user.role == "lobbyist"
    assert user.is_lobbyist is True
    assert user.is_legislator is False


def test_authenticated_legislator():
    g = make_globals(endpoint="legislator_routes.home", user=DemoUser.legislator())
    assert g["current_user"].role == "legislator"
    assert g["current_user"].is_legislator is True


def test_request_endpoint_is_set():
    g = make_globals(endpoint="lobbyist_routes.bill", user=None)
    assert g["request"].endpoint == "lobbyist_routes.bill"


def test_get_flashed_messages_returns_empty():
    g = make_globals(endpoint="index", user=None)
    assert g["get_flashed_messages"](with_categories=True) == []


def test_config_session_timeout_is_huge():
    """We disable the timeout-redirect script by making the timeout effectively infinite."""
    g = make_globals(endpoint="lobbyist_routes.home", user=DemoUser.lobbyist())
    seconds = g["config"].PERMANENT_SESSION_LIFETIME.total_seconds()
    assert seconds >= 365 * 24 * 3600  # at least a year
