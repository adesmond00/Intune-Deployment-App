"""AI-assisted generation of Intune Win32 app detection scripts.

This module provides a helper that leverages the OpenAI Chat Completion
API to synthesise a PowerShell detection script for a given application
name.  The resulting script can be used as a *detection rule* when
creating a Win32 LOB application in Microsoft Intune.

The function intentionally restricts the LLM output to a structured JSON
object that contains a single key -- `script` -- whose value is the
PowerShell code.  This makes parsing reliable and guards against free-
text preambles or epilogues that would break automated consumption.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Optional

try:
    # openai>=1.2.0 – use the new client API naming
    from openai import OpenAI  # type: ignore
except ImportError as exc:  # pragma: no cover – optional dependency
    raise ImportError(
        "The \x1b[1mopenai\x1b[0m package is required for AI detection script "
        "generation.  Install it via 'pip install openai'."
    ) from exc

__all__ = ["generate_detection_script"]
_logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------------------

def generate_detection_script(
    app_name: str,
    *,
    model: str = "gpt-4o-mini",
    temperature: float = 0.2,
    openai_api_key: Optional[str] = None,
    max_tokens: int | None = None,
) -> str:
    """Generate a PowerShell detection script for *app_name*.

    Parameters
    ----------
    app_name : str
        Human-friendly display name of the application (e.g. "7-Zip", "Google
        Chrome").  The LLM uses this to infer the expected installation paths
        or registry keys.
    model : str, optional
        The OpenAI chat model to use.  Defaults to ``gpt-4o-mini`` which should
        be available to most tenants; adjust to ``gpt-4o``, ``gpt-4-turbo`` or
        ``gpt-3.5-turbo-0125`` if necessary.
    temperature : float, optional
        Sampling temperature.  A low temperature keeps the script concise and
        deterministic.  Defaults to ``0.2``.
    openai_api_key : str | None, optional
        If *None*, the function reads the key from the ``OPENAI_API_KEY``
        environment variable.
    max_tokens : int | None, optional
        Override the maximum number of tokens in the completion.  Leave as
        *None* to rely on the model-specific default.

    Returns
    -------
    str
        A PowerShell detection script.  The caller is responsible for storing
        the script as UTF-8 text and base64-encoding it before sending it to
        Microsoft Graph (see ``intune_win32_uploader`` module).
    """

    if not app_name:
        raise ValueError("'app_name' must be a non-empty string")

    api_key = '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'  #openai_api_key #or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "OPENAI_API_KEY is not set.  Export the key or pass it explicitly via the 'openai_api_key' argument."  # noqa: E501
        )

    client = OpenAI(api_key=api_key)

    system_prompt = _SYSTEM_PROMPT.strip()
    user_prompt = _USER_PROMPT_TEMPLATE.format(app_name=app_name.strip())

    _logger.debug("Requesting detection script for '%s' using model '%s'", app_name, model)

    completion = client.chat.completions.create(
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    content: str = completion.choices[0].message.content  # pyright: ignore[reportGeneralTypeIssues]
    _logger.debug("Raw response: %s", content)

    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("LLM returned invalid JSON.  Check prompts or model output.") from exc

    script = data.get("script")
    if not script or not isinstance(script, str):
        raise RuntimeError("LLM response does not contain a 'script' string key.")

    return script.strip()


# --------------------------------------------------------------------------------------
# Prompt templates
# --------------------------------------------------------------------------------------

_SYSTEM_PROMPT = """
You are a senior Intune deployment engineer.
Your task is to write \\x1b[1m*only*\\x1b[0m a PowerShell detection script for a Win32 LOB application.
The detection script must fulfil \\x1b[1mall\\x1b[0m of these requirements:

1. The script exits with code 0 when the application is detected; non-zero otherwise.
2. When \\x1b[1mdetected\\x1b[0m, the script writes a human-readable string to STDOUT (e.g. the installed version).
3. No additional output, comments, or explanations are allowed.

Pick the most reliable detection mechanism based on the application name provided by the user, prioritising:
  a. Checking for the main executable under common x64/x86 ProgramFiles paths, OR
  b. Querying the uninstall registry keys under `HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall` (including Wow6432Node) for the DisplayName, InstallLocation, or DisplayVersion.

Return your answer as a \\x1b[1mJSON object\\x1b[0m that conforms to this schema (no other keys):
{
  "script": string  // the complete PowerShell script, no markdown fences
}

Do NOT wrap the JSON in markdown.  Provide no additional keys or textual preamble.
"""

_USER_PROMPT_TEMPLATE = (
    "Generate a detection script for the application named: \"{app_name}\"."
)