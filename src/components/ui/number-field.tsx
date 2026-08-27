"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * A number box you can actually type into.
 *
 * A plain `<Input type="number" value={someNumber}>` can never be empty: clear
 * it and the state parses back to 0, which React writes straight back into the
 * box. So a price sitting at 0 can't be deleted — you end up typing around it
 * and saving £270 instead of £27.
 *
 * This keeps what you're typing as text while the box has focus, and only
 * turns it into a number for the form. Focusing also selects what's there, so
 * clicking in and typing replaces the old figure rather than joining onto it.
 */
export function NumberField({
  value,
  onValueChange,
  allowEmpty = false,
  className,
  ...rest
}: {
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** Optional fields (a euro price) clear to null; required ones clear to 0. */
  allowEmpty?: boolean;
} & Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type"
>) {
  const [draft, setDraft] = useState<string | null>(null);

  const shown = draft ?? (value == null ? "" : String(value));

  return (
    <Input
      {...rest}
      type="number"
      inputMode="decimal"
      className={className}
      value={shown}
      onFocus={(e) => {
        setDraft(value == null ? "" : String(value));
        e.currentTarget.select();
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() === "") {
          onValueChange(allowEmpty ? null : 0);
          return;
        }
        const n = Number(raw);
        if (Number.isFinite(n)) onValueChange(n);
      }}
      onBlur={(e) => {
        setDraft(null); // back to showing the committed value
        rest.onBlur?.(e);
      }}
    />
  );
}
