"""Logo loading and colorization helpers for reporting."""

from __future__ import annotations

import base64
import io
import logging
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)

LOGO_PATH = Path(__file__).parent / "static" / "reporting" / "RPS_Logo.png"


def load_logo_b64() -> str:
    """Load and tint report logo as base64 data URI."""
    if not LOGO_PATH.exists():
        return ""

    data = LOGO_PATH.read_bytes()
    try:
        image = Image.open(io.BytesIO(data)).convert("RGBA")
        alpha = image.getchannel("A")
        colored = Image.new("RGBA", image.size, (31, 92, 106, 255))
        colored.putalpha(alpha)
        output = io.BytesIO()
        colored.save(output, format="PNG")
        data = output.getvalue()
    except Exception:
        logger.exception("Failed to colorize report logo; using original asset")

    b64 = base64.b64encode(data).decode("ascii")
    return f"data:image/png;base64,{b64}"
