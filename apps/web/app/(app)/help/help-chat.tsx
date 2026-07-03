"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleHelp, Search } from "lucide-react";
import type { MemberRole } from "@kibali/shared";
import { HELP_TOPICS, type HelpTopic } from "@kibali/shared";
import { Input } from "@/components/ui/input";

/**
 * Chat-style helper with NO AI — preset questions, instant step-by-step
 * answers, and related follow-ups to tap next.
 */
export function HelpChat({ role }: { role: MemberRole }) {
  const router = useRouter();
  const [thread, setThread] = useState<HelpTopic[]>([]);
  const [search, setSearch] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const topics = useMemo(
    () => HELP_TOPICS.filter((t) => !t.roles || t.roles.includes(role)),
    [role]
  );
  const topicById = (id: string) => topics.find((t) => t.id === id);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.question.toLowerCase().includes(q) ||
        t.answer.some((a) => a.toLowerCase().includes(q))
    );
  }, [topics, search]);

  function ask(topic: HelpTopic) {
    setThread((t) => [...t, topic]);
    setSearch("");
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Help</h1>
          <p className="text-sm text-muted-foreground">Tap a question — get the steps.</p>
        </div>
      </div>

      {thread.map((topic, i) => (
        <div key={`${topic.id}-${i}`} className="flex flex-col gap-2">
          <div className="ml-auto max-w-[85%] rounded bg-primary px-3 py-2 text-sm text-primary-foreground">
            {topic.question}
          </div>
          <div className="mr-auto max-w-[90%] rounded border bg-background px-3 py-2 text-sm">
            {topic.answer.map((line, j) => (
              <p key={j} className={j > 0 ? "mt-1.5" : ""}>
                {line}
              </p>
            ))}
            {topic.related.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {topic.related.map((id) => {
                  const related = topicById(id);
                  if (!related) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => ask(related)}
                      className="rounded border border-primary/40 bg-accent px-2 py-1 text-xs font-medium text-accent-foreground"
                    >
                      {related.question}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />

      <div className="flex flex-col gap-2">
        {thread.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleHelp className="h-4 w-4" /> What do you want to do?
          </p>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for help…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          {suggestions.map((t) => (
            <button
              key={t.id}
              onClick={() => ask(t)}
              className="rounded border bg-background px-3 py-2.5 text-left text-sm font-medium hover:bg-muted"
            >
              {t.question}
            </button>
          ))}
          {suggestions.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              Nothing found — try a different word, or ask Godwin to add this question.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
