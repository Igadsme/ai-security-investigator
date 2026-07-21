import { useState } from "react";
import { Search, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "Show me every person who entered the room",
  "When did the white car appear?",
  "Find all instances of someone carrying a backpack",
  "How many unique people were detected between 8 PM and 10 PM?",
  "Show me all white cars",
  "Detect loitering activity",
];

interface Props {
  onSearch: (query: string) => void;
  loading?: boolean;
}

export default function SearchBar({ onSearch, loading }: Props) {
  const [query, setQuery] = useState("");

  const submit = (q?: string) => {
    const text = q || query;
    if (text.trim()) onSearch(text.trim());
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          className="input-field pl-12 pr-32 py-3 text-base"
          placeholder="Ask about your surveillance footage..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button
          onClick={() => submit()}
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary flex items-center gap-2 text-sm"
        >
          <Sparkles className="w-4 h-4" />
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setQuery(s); submit(s); }}
            className="text-xs px-3 py-1.5 rounded-full bg-surface-700 text-slate-400 hover:text-slate-200 hover:bg-surface-600 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
