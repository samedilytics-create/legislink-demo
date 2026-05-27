"""Render Jinja templates from the Flask app, with overlays for demo-specific tweaks."""
from __future__ import annotations
from pathlib import Path
from jinja2 import Environment, ChoiceLoader, FileSystemLoader, select_autoescape

from build.flask_shim import DemoUser, make_globals

# Resolved relative to the legislink-demo repo root.
REPO_ROOT = Path(__file__).resolve().parent.parent
FLASK_TEMPLATES = REPO_ROOT.parent / "Lobbi" / "app" / "templates"
OVERLAY_TEMPLATES = REPO_ROOT / "overlays" / "templates"


def make_env() -> Environment:
    return Environment(
        loader=ChoiceLoader([
            FileSystemLoader(str(OVERLAY_TEMPLATES)),  # overlays win
            FileSystemLoader(str(FLASK_TEMPLATES)),
        ]),
        autoescape=select_autoescape(["html"]),
        trim_blocks=False,
        lstrip_blocks=False,
    )


def render_page(
    env: Environment,
    template_name: str,
    output_path: Path,
    *,
    endpoint: str,
    user: DemoUser | None,
    **context,
) -> None:
    """Render `template_name` to `output_path`, injecting shim globals."""
    template = env.get_template(template_name)
    globals_ = make_globals(endpoint=endpoint, user=user)
    rendered = template.render(**globals_, **context)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(rendered, encoding="utf-8")
