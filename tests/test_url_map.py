import pytest
from build.url_map import url_for, UnknownEndpoint


def test_index():
    assert url_for("index") == "/"


def test_auth_login():
    assert url_for("auth.login") == "/auth/login/"


def test_lobbyist_home():
    assert url_for("lobbyist_routes.home") == "/lobbyist/"


def test_static_filename():
    assert url_for("static", filename="css/style.css") == "/static/css/style.css"


def test_static_filename_with_space():
    assert url_for("static", filename="Favicon 32.png") == "/static/Favicon%2032.png"


def test_unknown_endpoint_raises():
    with pytest.raises(UnknownEndpoint):
        url_for("does.not.exist")


def test_legislator_bill_uses_hash():
    assert url_for("lobbyist_routes.bill", bill_id="HB0142") == "/lobbyist/bill/#/HB0142"


def test_view_bill_alias():
    assert url_for("lobbyist_routes.view_bill", bill_id="HB0142") == "/lobbyist/bill/#/HB0142"
    assert url_for("legislator_routes.view_bill", bill_id="HB0142") == "/legislator/bill/#/HB0142"
