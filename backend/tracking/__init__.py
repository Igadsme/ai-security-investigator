from .simple_tracker import SimpleTracker

__all__ = ["DeepSortTracker", "SimpleTracker"]


def __getattr__(name: str):
    if name == "DeepSortTracker":
        from .deepsort_tracker import DeepSortTracker

        return DeepSortTracker
    raise AttributeError(name)
