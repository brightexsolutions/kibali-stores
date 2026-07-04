"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  ClipboardList,
  MessageCircleQuestion,
  Package,
  Search,
  ShoppingCart,
  Sunrise,
  Users,
} from "lucide-react";
import type { MemberRole } from "@kibali/shared";
import { HELP_CATEGORIES, HELP_TOPICS, type HelpCategory, type HelpTopic } from "@kibali/shared";
import { Input } from "@/components/ui/input";

const CATEGORY_STYLE: Record<HelpCategory, { icon: typeof Sunrise; tone: string }> = {
  "Getting started": { icon: Sunrise, tone: "from-amber-400 to-orange-500" },
  Selling: { icon: ShoppingCart, tone: "from-emerald-500 to-teal-600" },
  Stock: { icon: Package, tone: "from-sky-500 to-blue-600" },
  Money: { icon: Banknote, tone: "from-indigo-500 to-violet-600" },
  Records: { icon: ClipboardList, tone: "from-slate-500 to-slate-700" },
  "Investors & team": { icon: Users, tone: "from-rose-500 to-pink-600" },
};

/**
 * Chat-style helper with NO AI — preset questions grouped by category,
 * instant step-by-step answers, and related follow-ups to tap next.
 */
export function HelpChat({ role }: { role: MemberRole }) {
  const router = useRouter();
  const [thread, setThread] = useState<HelpTopic[]>([]);
  const [search, setSearch] = useState("");
  const [openCategory, setOpenCategory] = useState<HelpCategory | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const topics = useMemo(
    () => HELP_TOPICS.filter((t) => !t.roles || t.roles.includes(role)),
    [role]
  );
  const topicById = (id: string) => topics.find((t) => t.id === id);

  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const suggestions = useMemo(() => {
    if (!searching) return [];
    return topics.filter(
      (t) =>
        t.question.toLowerCase().includes(q) ||
        t.answer.some((a) => a.toLowerCase().includes(q))
    );
  }, [topics, q, searching]);

  const categories = HELP_CATEGORIES.filter((c) => topics.some((t) => t.category === c));

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
          <p className="text-sm text-muted-foreground">Tap a topic — get clear steps.</p>
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

      <div className="flex flex-col gap-3">
        {thread.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageCircleQuestion className="h-4 w-4" /> What do you want to do?
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

        {searching ? (
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
        ) : openCategory ? (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setOpenCategory(null)}
              className="mb-1 flex items-center gap-1 self-start text-xs font-semibold text-muted-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All topics
            </button>
            {topics
              .filter((t) => t.category === openCategory)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => ask(t)}
                  className="rounded border bg-background px-3 py-2.5 text-left text-sm font-medium hover:bg-muted"
                >
                  {t.question}
                </button>
              ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {categories.map((c) => {
              const { icon: Icon, tone } = CATEGORY_STYLE[c];
              const count = topics.filter((t) => t.category === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setOpenCategory(c)}
                  className={`flex h-24 flex-col items-center justify-center gap-1.5 rounded bg-gradient-to-br ${tone} text-center text-white shadow-sm active:scale-[0.98]`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-semibold leading-tight">{c}</span>
                  <span className="text-[11px] text-white/80">{count} topics</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
