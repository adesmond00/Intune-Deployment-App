import json
import os
import pytest

from api.functions import ai_detection


class _DummyCompletion:
    """Mimic the OpenAI completion response shape expected by the helper."""

    def __init__(self, content: str):
        # `choices[0].message.content` must return *content*
        message = type("_Msg", (), {"content": content})()
        choice = type("_Choice", (), {"message": message})()
        self.choices = [choice]


class _DummyClient:
    """Lightweight stand-in for the `openai.OpenAI` client."""

    def __init__(self, *args, **kwargs):
        class _Chat:
            def completions(self):  # pragma: no cover – only to satisfy hasattr checks
                raise NotImplementedError

        # Replace the nested object with one having the expected `.create()` method
        self.chat = type(
            "_Chat", (), {
                "completions": type(
                    "_Completions", (), {
                        "create": self._create  # noqa: N802 – match OpenAI naming
                    },
                )(),
            }
        )()

    # Will be patched per-test to yield customised content
    def _create(self, *args, **kwargs):  # noqa: D401
        raise NotImplementedError


@pytest.fixture
def mock_openai(monkeypatch):
    """Monkey-patch `ai_detection.OpenAI` with dummy client for unit tests."""
    monkeypatch.setattr(ai_detection, "OpenAI", _DummyClient)
    yield  # test runs


@pytest.mark.parametrize("app_name", ["SuperApp", "Example Client", "TestSoft"])
def test_generate_detection_script_returns_script(mock_openai, monkeypatch, app_name):
    """Function should return the script string from the structured LLM JSON."""

    script_body = f"Write-Output '{app_name} detected'; exit 0"
    dummy_json = json.dumps({"script": script_body})

    # Patch the dummy client's `.create()` to return the desired JSON blob
    def _fake_create(self, *args, **kwargs):  # noqa: D401,N802 – match OpenAI signature style
        return _DummyCompletion(dummy_json)

    monkeypatch.setattr(_DummyClient, "_create", _fake_create, raising=True)

    result = ai_detection.generate_detection_script(app_name, openai_api_key="dummy-key", model="dummy")
    assert result == script_body


def test_generate_detection_script_invalid_json(mock_openai, monkeypatch):
    """Non-JSON responses should raise a RuntimeError."""

    def _fake_create(self, *args, **kwargs):  # noqa: D401,N802
        return _DummyCompletion("this is not json")

    monkeypatch.setattr(_DummyClient, "_create", _fake_create, raising=True)

    with pytest.raises(RuntimeError):
        ai_detection.generate_detection_script("SampleApp", openai_api_key="dummy")


# Mark these tests separately so they only run with the live flag
@pytest.mark.live
@pytest.mark.parametrize(
    "app_name",
    [
        "7-Zip",
        "Notepad++",
        "SampleApp",
    ],
)
def test_generate_detection_script_live(app_name: str):
    """Ensure the helper returns a plausible PowerShell script via real network call."""

    script = ai_detection.generate_detection_script(app_name)

    # Basic sanity checks – we cannot assert exact content but can validate key behaviours
    assert isinstance(script, str) and script.strip(), "Script should be a non-empty string"

    # The script should signal success via exit 0 (requirement #1)
    assert "exit 0" in script.lower(), "Detection script must exit 0 on success"

    # The script should write something to STDOUT (requirement #2)
    assert ("Write-Output" in script) or ("Write-Host" in script), "Script should write to STDOUT"
