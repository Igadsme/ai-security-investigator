import json
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from config import settings


class VectorSearchEngine:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.collection = self.client.get_or_create_collection(
            name="surveillance_events",
            metadata={"hnsw:space": "cosine"},
        )

    def index_event(
        self,
        event_id: str,
        text: str,
        metadata: dict,
    ) -> None:
        self.collection.upsert(
            ids=[event_id],
            documents=[text],
            metadatas=[{k: _serialize(v) for k, v in metadata.items()}],
        )

    def index_batch(
        self,
        ids: list[str],
        texts: list[str],
        metadatas: list[dict],
    ) -> None:
        if not ids:
            return
        serialized = [{k: _serialize(v) for k, v in m.items()} for m in metadatas]
        self.collection.upsert(ids=ids, documents=texts, metadatas=serialized)

    def search(
        self,
        query: str,
        video_id: Optional[int] = None,
        n_results: int = 20,
    ) -> list[dict]:
        where = {"video_id": str(video_id)} if video_id else None
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where,
        )

        hits = []
        if not results["ids"] or not results["ids"][0]:
            return hits

        for i, doc_id in enumerate(results["ids"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            hits.append({
                "id": doc_id,
                "text": results["documents"][0][i] if results["documents"] else "",
                "metadata": {k: _deserialize(v) for k, v in meta.items()},
                "distance": results["distances"][0][i] if results["distances"] else None,
            })
        return hits

    def delete_video_events(self, video_id: int) -> None:
        try:
            self.collection.delete(where={"video_id": str(video_id)})
        except Exception:
            pass


def _serialize(value) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    return str(value)


def _deserialize(value: str):
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return value
