import json
import re
from typing import Optional

import httpx
from openai import OpenAI

from config import settings

OBJECT_ALIASES = {
    "people": "person",
    "person": "person",
    "human": "person",
    "humans": "person",
    "car": "car",
    "cars": "car",
    "vehicle": "car",
    "vehicles": "car",
    "truck": "truck",
    "trucks": "truck",
    "bicycle": "bicycle",
    "bicycles": "bicycle",
    "bike": "bicycle",
    "bikes": "bicycle",
    "motorcycle": "motorcycle",
    "motorcycles": "motorcycle",
    "dog": "dog",
    "dogs": "dog",
    "backpack": "backpack",
    "backpacks": "backpack",
    "bag": "backpack",
}

COLORS = ["white", "black", "gray", "red", "blue", "green", "yellow", "orange", "brown", "silver"]

ACTIVITY_KEYWORDS = {
    "loitering": "loitering",
    "loiter": "loitering",
    "running": "running",
    "run": "running",
    "abandoned": "abandoned_object",
    "left behind": "abandoned_object",
    "trespassing": "trespassing",
    "entered": "entry",
    "enter": "entry",
    "exited": "exit",
    "exit": "exit",
}


class NaturalLanguageSearch:
    def parse_query(self, query: str) -> dict:
        """Parse natural language query into structured filters."""
        llm_result = self._parse_with_llm(query)
        if llm_result:
            return llm_result
        return self._parse_with_rules(query)

    def _parse_with_llm(self, query: str) -> Optional[dict]:
        prompt = f"""Parse this surveillance video search query into JSON filters.

Query: "{query}"

Return ONLY valid JSON with these optional fields:
- object_class: person|car|truck|bicycle|motorcycle|dog|backpack
- color: white|black|gray|red|blue|green|yellow|orange|brown|silver
- start_time: HH:MM or HH:MM:SS (24h)
- end_time: HH:MM or HH:MM:SS (24h)
- activity_type: loitering|running|abandoned_object|trespassing|entry|exit
- track_id: integer
- semantic_query: rewritten search text for vector search
- count_unique: boolean (true if asking for unique count)

Example: {{"object_class": "car", "color": "white", "semantic_query": "white car appearance"}}
"""

        try:
            if settings.openai_api_key:
                client = OpenAI(api_key=settings.openai_api_key)
                resp = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0,
                    max_tokens=300,
                )
                content = resp.choices[0].message.content or ""
            elif settings.use_ollama:
                with httpx.Client(timeout=30) as http:
                    resp = http.post(
                        f"{settings.ollama_base_url}/api/generate",
                        json={"model": "llama3.2", "prompt": prompt, "stream": False},
                    )
                    content = resp.json().get("response", "")
            else:
                return None

            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                return json.loads(match.group())
        except Exception:
            return None
        return None

    def _parse_with_rules(self, query: str) -> dict:
        q = query.lower()
        result: dict = {"semantic_query": query}

        for alias, obj in OBJECT_ALIASES.items():
            if re.search(rf"\b{re.escape(alias)}\b", q):
                result["object_class"] = obj
                break

        for color in COLORS:
            if color in q:
                result["color"] = color
                break

        for keyword, activity in ACTIVITY_KEYWORDS.items():
            if keyword in q:
                result["activity_type"] = activity
                break

        time_range = _extract_time_range(q)
        if time_range:
            result.update(time_range)

        if any(w in q for w in ["unique", "how many", "count"]):
            result["count_unique"] = True

        if "entered" in q or "enter" in q:
            result["activity_type"] = result.get("activity_type", "entry")

        return result

    def generate_summary(
        self,
        video_name: str,
        stats: dict,
        events: list[dict],
        time_range: Optional[str] = None,
    ) -> str:
        context = {
            "video": video_name,
            "time_range": time_range,
            "stats": stats,
            "events": events[:20],
        }

        prompt = f"""You are a security analyst. Write a concise surveillance summary.

Data: {json.dumps(context, indent=2)}

Format:
- Bullet points for key findings
- Include counts, timestamps, and peak activity
- Note any suspicious activity
- Keep under 200 words"""

        try:
            if settings.openai_api_key:
                client = OpenAI(api_key=settings.openai_api_key)
                resp = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=400,
                )
                return resp.choices[0].message.content or _fallback_summary(stats, events)
            elif settings.use_ollama:
                with httpx.Client(timeout=60) as http:
                    resp = http.post(
                        f"{settings.ollama_base_url}/api/generate",
                        json={"model": "llama3.2", "prompt": prompt, "stream": False},
                    )
                    return resp.json().get("response", "") or _fallback_summary(stats, events)
        except Exception:
            pass

        return _fallback_summary(stats, events)


def _extract_time_range(query: str) -> Optional[dict]:
    patterns = [
        r"between\s+(\d{1,2}(?::\d{2})?(?::\d{2})?\s*(?:am|pm)?)\s+and\s+(\d{1,2}(?::\d{2})?(?::\d{2})?\s*(?:am|pm)?)",
        r"from\s+(\d{1,2}(?::\d{2})?(?::\d{2})?\s*(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?(?::\d{2})?\s*(?:am|pm)?)",
        r"at\s+(\d{1,2}(?::\d{2})?(?::\d{2})?\s*(?:am|pm)?)",
    ]

    for pattern in patterns[:2]:
        m = re.search(pattern, query, re.IGNORECASE)
        if m:
            return {
                "start_time": m.group(1).strip(),
                "end_time": m.group(2).strip(),
            }

    m = re.search(patterns[2], query, re.IGNORECASE)
    if m:
        t = m.group(1).strip()
        return {"start_time": t, "end_time": t}

    return None


def _fallback_summary(stats: dict, events: list[dict]) -> str:
    lines = ["Surveillance Activity Summary:", ""]
    for key, val in stats.items():
        lines.append(f"- {key.replace('_', ' ').title()}: {val}")

    if events:
        lines.append("")
        lines.append("Notable Events:")
        for e in events[:10]:
            ts = e.get("timestamp", e.get("start_seconds", ""))
            desc = e.get("description", e.get("text", ""))
            lines.append(f"- [{ts}] {desc}")

    return "\n".join(lines)


def time_str_to_seconds(time_str: str) -> float:
    """Convert HH:MM, HH:MM:SS, or 12h format to seconds."""
    time_str = time_str.strip().lower()
    is_pm = "pm" in time_str
    is_am = "am" in time_str
    time_str = re.sub(r"[ap]m", "", time_str).strip()

    parts = [int(p) for p in time_str.split(":")]
    hours = parts[0]
    minutes = parts[1] if len(parts) > 1 else 0
    seconds = parts[2] if len(parts) > 2 else 0

    if is_pm and hours < 12:
        hours += 12
    if is_am and hours == 12:
        hours = 0

    return hours * 3600 + minutes * 60 + seconds
