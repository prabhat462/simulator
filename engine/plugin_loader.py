"""
Dynamic algorithm class loader from plugins.yaml.
"""

import importlib
import os
import yaml
from algorithms.base import BaseAlgorithm


def load_algorithms(plugins_path: str = None) -> dict[str, type[BaseAlgorithm]]:
    """
    Dynamically load all enabled algorithm classes from plugins.yaml.
    Returns dict of {algorithm_id: AlgorithmClass}
    """
    if plugins_path is None:
        plugins_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "plugins.yaml")

    with open(plugins_path) as f:
        config = yaml.safe_load(f)

    registry = {}
    for entry in config["algorithms"]:
        if not entry.get("enabled", True):
            continue
        module_path, class_name = entry["class"].rsplit(".", 1)
        module = importlib.import_module(module_path)
        cls = getattr(module, class_name)

        assert issubclass(cls, BaseAlgorithm), (
            f"{entry['class']} must extend BaseAlgorithm"
        )

        registry[entry["id"]] = cls

    return registry
