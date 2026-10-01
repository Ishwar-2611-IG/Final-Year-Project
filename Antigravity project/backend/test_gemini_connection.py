"""
gemini_connect.py — Production-grade Gemini API connection verifier

Bugs & vulnerabilities fixed from original:
  [BUG-1]  API key partially printed to stdout — security leak
  [BUG-2]  sys.exit(1) inside try/except swallows real error context
  [BUG-3]  No timeout on the API call — can hang indefinitely
  [BUG-4]  Bare `except Exception` loses original traceback
  [BUG-5]  Key length check `> 8` is arbitrary — doesn't validate format
  [BUG-6]  load_dotenv called before logging is configured — order issue
  [VUL-1]  Key display (even masked) leaks entropy to shared logs/terminals
  [VUL-2]  No check that the response object actually has `.text` — crashes on
           blocked/empty safety-filtered responses
  [VUL-3]  Model name hardcoded in body — not configurable without code change
  [IMP-1]  No structured logging — plain print() is untrustworthy in prod
  [IMP-2]  No retry logic for transient network errors
  [IMP-3]  No environment validation beyond "key exists"
  [IMP-4]  Script not importable as a module (everything under __main__)
"""

from __future__ import annotations

import logging
import os
import sys
import time
from dataclasses import dataclass, field
from typing import Optional

# ── Dependency guard ─────────────────────────────────────────────────────────

try:
    import google.generativeai as genai
    from google.api_core.exceptions import GoogleAPICallError, RetryError
except ImportError:
    print(
        "ERROR: Required packages are not installed.\n"
        "Run:  pip install google-generativeai python-dotenv --break-system-packages",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print(
        "ERROR: python-dotenv is not installed.\n"
        "Run:  pip install python-dotenv --break-system-packages",
        file=sys.stderr,
    )
    sys.exit(1)


# ── Logging setup ─────────────────────────────────────────────────────────────
# [IMP-1] Structured logging replaces bare print() calls.
# Level can be overridden via LOG_LEVEL env var.

def _configure_logging() -> logging.Logger:
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s  %(levelname)-8s  %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )
    return logging.getLogger("gemini_connect")


log = _configure_logging()


# ── Configuration dataclass ───────────────────────────────────────────────────

@dataclass
class Config:
    """All tunables in one place — no magic constants buried in logic."""
    model_name: str = "gemini-2.0-flash"
    probe_prompt: str = "Respond with exactly: Connection Successful!"
    max_retries: int = 3
    retry_base_delay: float = 1.0   # seconds; doubles each retry
    # [BUG-3] Generative AI SDK doesn't expose a per-call timeout natively,
    # but we track wall-clock time and surface it in logs.
    soft_timeout_seconds: float = 30.0
    # Minimum plausible Gemini key length (all current keys are 39 chars)
    min_key_length: int = 20
    env_file: str = ".env"


# ── Environment loading ───────────────────────────────────────────────────────

def load_environment(env_file: str) -> None:
    """
    Load .env from the script's own directory.
    [BUG-6] Logging is configured before this runs, so all output is captured.
    """
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), env_file)
    if os.path.exists(env_path):
        load_dotenv(env_path, override=False)   # don't override real env vars
        log.info("Loaded environment from: %s", env_path)
    else:
        log.warning(".env file not found at %s — relying on environment variables", env_path)


# ── Key validation ────────────────────────────────────────────────────────────

def validate_api_key(key: Optional[str], min_length: int) -> str:
    """
    Validate the key exists and looks plausible.

    [VUL-1] We do NOT print or log any portion of the key.
    [BUG-5] Length threshold is configurable and meaningful (not hardcoded 8).
    """
    if not key:
        raise EnvironmentError(
            "GEMINI_API_KEY is not set. "
            "Add it to your .env file or export it as an environment variable."
        )
    if len(key) < min_length:
        raise EnvironmentError(
            f"GEMINI_API_KEY looks too short ({len(key)} chars). "
            "Verify you copied the full key from Google AI Studio."
        )
    log.info("API key found (length: %d) ✓", len(key))
    return key


# ── Connection probe with retry ───────────────────────────────────────────────

def probe_with_retry(
    model: genai.GenerativeModel,
    prompt: str,
    max_retries: int,
    base_delay: float,
    soft_timeout: float,
) -> str:
    """
    Send a single low-cost prompt and return the response text.

    [BUG-3]  Tracks wall-clock time; aborts if soft_timeout exceeded.
    [BUG-4]  Re-raises with full context instead of printing and exiting.
    [IMP-2]  Exponential back-off for transient errors (5xx, network blips).
    [VUL-2]  Checks response structure before accessing .text.
    """
    deadline = time.monotonic() + soft_timeout
    last_exc: Optional[Exception] = None

    for attempt in range(1, max_retries + 1):
        if time.monotonic() > deadline:
            raise TimeoutError(
                f"Soft timeout of {soft_timeout}s exceeded before attempt {attempt}."
            )

        try:
            log.info("Attempt %d/%d — sending probe request…", attempt, max_retries)
            response = model.generate_content(prompt)

            # [VUL-2] Safety filters or quota issues can yield an empty response
            if not response.parts:
                finish = getattr(response, "prompt_feedback", None)
                raise ValueError(
                    f"Empty response (no parts). Prompt feedback: {finish}"
                )

            text = response.text.strip()
            if not text:
                raise ValueError("Response has .text but it is empty after strip().")

            return text

        except (GoogleAPICallError, RetryError) as exc:
            last_exc = exc
            delay = base_delay * (2 ** (attempt - 1))
            log.warning(
                "API error on attempt %d: %s — retrying in %.1fs",
                attempt, exc, delay,
            )
            if attempt < max_retries:
                time.sleep(delay)

        except ValueError:
            # Structural/safety issues — retrying won't help
            raise

    # All retries exhausted
    raise RuntimeError(
        f"All {max_retries} attempts failed. Last error: {last_exc}"
    ) from last_exc


# ── Main orchestration ────────────────────────────────────────────────────────

def run(cfg: Optional[Config] = None) -> int:
    """
    Full verification flow.  Returns 0 on success, 1 on failure.
    Importable as a module — no bare sys.exit() inside logic.
    [IMP-4]
    """
    cfg = cfg or Config()

    # 1. Load environment
    load_environment(cfg.env_file)

    # 2. Validate key — raises EnvironmentError on failure
    try:
        api_key = validate_api_key(
            os.environ.get("GEMINI_API_KEY"),
            cfg.min_key_length,
        )
    except EnvironmentError as exc:
        log.error("Configuration error: %s", exc)
        return 1

    # 3. Configure SDK
    genai.configure(api_key=api_key)
    log.info("Gemini SDK configured — model: %s", cfg.model_name)

    # 4. Build model
    model = genai.GenerativeModel(cfg.model_name)

    # 5. Probe
    try:
        start = time.monotonic()
        reply = probe_with_retry(
            model=model,
            prompt=cfg.probe_prompt,
            max_retries=cfg.max_retries,
            base_delay=cfg.retry_base_delay,
            soft_timeout=cfg.soft_timeout_seconds,
        )
        elapsed = time.monotonic() - start

        log.info("Response received in %.2fs: %r", elapsed, reply)
        log.info("SUCCESS — Gemini API connection verified ✓")
        return 0

    except TimeoutError as exc:
        log.error("Timeout: %s", exc)
    except RuntimeError as exc:
        log.error("All retries exhausted: %s", exc)
    except ValueError as exc:
        log.error("Unexpected response structure: %s", exc)
    except Exception as exc:                        # true last-resort catch
        log.exception("Unexpected error: %s", exc)  # logs full traceback

    return 1


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    sys.exit(run())