"""PDF renderer helpers for reporting."""

from __future__ import annotations

import inspect
from pathlib import Path

import pydyf
from weasyprint import CSS, HTML


_PATCHED_PYDYF = False


def patch_pydyf_pdf_init_for_weasyprint_60() -> None:
    """Patch pydyf>=0.11 constructor shape for WeasyPrint 60.x compatibility."""
    global _PATCHED_PYDYF
    if _PATCHED_PYDYF:
        return

    init_signature = inspect.signature(pydyf.PDF.__init__)
    if len(init_signature.parameters) != 1:
        _PATCHED_PYDYF = True
        return

    original_init = pydyf.PDF.__init__

    def _compat_init(self, version=b"1.7", identifier=False):
        original_init(self)
        if isinstance(version, str):
            version = version.encode()
        self.version = version
        self.identifier = identifier

    def _compat_transform(self, a=1, b=0, c=0, d=1, e=0, f=0):
        self.set_matrix(a, b, c, d, e, f)

    def _compat_text_matrix(self, a=1, b=0, c=0, d=1, e=0, f=0):
        self.set_text_matrix(a, b, c, d, e, f)

    pydyf.PDF.__init__ = _compat_init
    if not hasattr(pydyf.Stream, "transform"):
        pydyf.Stream.transform = _compat_transform
    if not hasattr(pydyf.Stream, "text_matrix"):
        pydyf.Stream.text_matrix = _compat_text_matrix

    _PATCHED_PYDYF = True


def render_pdf_document(
    html_content: str,
    css_content: str,
    *,
    base_url: str | None = None,
) -> bytes:
    """Render HTML/CSS to PDF bytes using WeasyPrint."""
    patch_pydyf_pdf_init_for_weasyprint_60()
    if base_url is None:
        base_url = str(Path(__file__).parent)

    html = HTML(string=html_content, base_url=base_url)
    css = CSS(string=css_content)
    return html.write_pdf(stylesheets=[css])
