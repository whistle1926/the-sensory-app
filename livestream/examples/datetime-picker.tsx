"use client";
// Minimal DateTimePicker. The admin create form imports this from
// @/components/ui/datetime-picker. Replace with your own if you have a fancier one.
import { Input } from "@/components/ui/input";

export function DateTimePicker({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  // value is an ISO string; <input type="datetime-local"> wants YYYY-MM-DDTHH:mm
  const local = value ? new Date(value).toISOString().slice(0, 16) : "";
  return (
    <Input
      type="datetime-local"
      value={local}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v ? new Date(v).toISOString() : "");
      }}
      placeholder={placeholder}
    />
  );
}
