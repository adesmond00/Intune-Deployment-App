"""
API package initialization
"""
from .database_handler import add_intune_app, search_apps, deploy_app  # re-export
# Re-export functions subpackage to ensure "api.functions" is importable when
# project root is on sys.path.
from importlib import import_module, util as _util  # type: ignore

# Allow "import functions.<name>" at runtime when running from project root.
if _util.find_spec("functions") is None:
    import sys as _sys, pathlib as _pathlib
    _this_dir = _pathlib.Path(__file__).resolve().parent
    _sys.modules.setdefault("functions", import_module("api.functions", package="api"))