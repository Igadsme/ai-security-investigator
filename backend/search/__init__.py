from .nl_search import NaturalLanguageSearch

__all__ = ["NaturalLanguageSearch", "get_vector_search", "VectorSearchEngine"]


def get_vector_search():
    """Lazy import so Spaces builds without chromadb still start."""
    from .vector_search import get_vector_search as _get

    return _get()


def __getattr__(name: str):
    if name == "VectorSearchEngine":
        from .vector_search import VectorSearchEngine

        return VectorSearchEngine
    raise AttributeError(name)
