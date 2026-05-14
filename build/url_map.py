"""Flask endpoint → static-site path map.

The shim's url_for() is just a dict lookup with a few dynamic special cases.
Unknown endpoints raise UnknownEndpoint so the build fails loudly.
"""
from __future__ import annotations
from urllib.parse import quote


class UnknownEndpoint(KeyError):
    pass


_STATIC_PATHS: dict[str, str] = {
    "index": "/",
    "auth.login": "/auth/login/",
    "auth.logout": "/auth/logout/",
    "auth.register": "/auth/register/",
    "auth.choose_account_type": "/auth/choose-account-type/",
    "auth.forgot_password": "/auth/forgot-password/",
    "auth.legislator_sign_in": "/auth/legislator-sign-in/",
    "auth.reset_password": "/auth/reset-password/",
    "lobbyist_routes.home": "/lobbyist/",
    "lobbyist_routes.table": "/lobbyist/table/",
    "lobbyist_routes.search": "/lobbyist/search/",
    "lobbyist_routes.settings": "/lobbyist/settings/",
    "legislator_routes.home": "/legislator/",
    "legislator_routes.table": "/legislator/table/",
    "legislator_routes.search": "/legislator/search/",
    "legislator_routes.settings": "/legislator/settings/",
    "legislator_routes.change_password": "/legislator/change-password/",
}

# Endpoints that take a bill_id and route to a hashed detail page.
# Both `bill` and `view_bill` aliases exist because the Flask routes
# expose them under different names depending on portal.
_BILL_DETAIL_ENDPOINTS = {
    "lobbyist_routes.bill": "/lobbyist/bill/#/{bill_id}",
    "lobbyist_routes.view_bill": "/lobbyist/bill/#/{bill_id}",
    "lobbyist_routes.opinion": "/lobbyist/bill/#/{bill_id}",
    "legislator_routes.bill": "/legislator/bill/#/{bill_id}",
    "legislator_routes.view_bill": "/legislator/bill/#/{bill_id}",
}


def url_for(endpoint: str, **kwargs) -> str:
    if endpoint == "static":
        filename = kwargs["filename"]
        return "/static/" + quote(filename)
    if endpoint in _BILL_DETAIL_ENDPOINTS:
        bill_id = kwargs.get("bill_id", "")
        return _BILL_DETAIL_ENDPOINTS[endpoint].format(bill_id=bill_id)
    try:
        return _STATIC_PATHS[endpoint]
    except KeyError as e:
        raise UnknownEndpoint(endpoint) from e
