"""Logging helpers: ANSI colours, formatter, and convenience functions."""

from __future__ import annotations

import logging

# ---------------------------------------------------------------------------
# ANSI colour constants
# ---------------------------------------------------------------------------

BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"
BLUE = "\033[34m"


# ---------------------------------------------------------------------------
# Colour-aware log formatter
# ---------------------------------------------------------------------------

_LEVEL_COLOURS = {
  logging.DEBUG: DIM,
  logging.INFO: "",
  logging.WARNING: YELLOW,
  logging.ERROR: RED,
  logging.CRITICAL: RED + BOLD,
}


class ColorFormatter(logging.Formatter):
  """Log formatter that prepends an ANSI colour based on level."""

  def format(self, record: logging.LogRecord) -> str:
    colour = _LEVEL_COLOURS.get(record.levelno, "")
    msg = super().format(record)
    if colour:
      return f"{colour}{msg}{RESET}"
    return msg


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def setup_logging(level: int = logging.INFO, name: str = "benchmark") -> logging.Logger:
  """Configure the root *name* logger with a :class:`ColorFormatter`."""
  logger = logging.getLogger(name)
  logger.setLevel(level)

  if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setLevel(level)
    handler.setFormatter(ColorFormatter("%(asctime)s %(name)s %(message)s", datefmt="%H:%M:%S"))
    logger.addHandler(handler)

  return logger


def method_tag(name: str) -> str:
  """Return a coloured ``[name]`` tag for log messages."""
  return f"{CYAN}[{name}]{RESET}"
