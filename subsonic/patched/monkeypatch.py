from importlib.util import module_from_spec, spec_from_file_location
from sys import modules

__all__ = ["monkeypatch"]


def monkeypatch(module: str, path: str) -> None:
    fuzzy_spec = spec_from_file_location(module, path)
    fuzzy_module = module_from_spec(fuzzy_spec)
    modules[module] = fuzzy_module
    fuzzy_spec.loader.exec_module(fuzzy_module)
