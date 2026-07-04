"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Owner/super-admin only: lets a record be entered for a past day, so old
 * paper records can be backfilled with their real dates. Collapsed by
 * default so managers' simple "always today" flow is untouched — this
 * component only renders at all when the caller decides to show it.
 */
export function BackdateField({
  name,
  onChange,
}: {
  name: string;
  onChange?: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 self-start text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <CalendarClock className="h-3.5 w-3.5" /> This happened on a different day?
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5" /> Date this happened
      </Label>
      <Input
        id={name}
        name={name}
        type="date"
        max={today()}
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          onChange?.(e.target.value);
        }}
      />
    </div>
  );
}
