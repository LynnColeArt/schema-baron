import { useEffect, useRef, useState } from "react";
import type { LiteralValue, ScalarType } from "@schema-baron/model";
/** Incomplete numeric text remains a draft string and is rejected only at preview/save. */
export function scalarText(text: string, type: ScalarType): LiteralValue {
  if (type.kind === "integer" && /^-?\d+$/.test(text)) {
    const n = Number(text);
    if (Number.isSafeInteger(n)) return n;
  }
  if (
    type.kind === "real" &&
    /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)
  ) {
    const n = Number(text);
    if (Number.isFinite(n)) return n;
  }
  if (type.kind === "boolean" && (text === "true" || text === "false"))
    return text === "true";
  return text;
}
export function ScalarInput({
  value,
  type,
  label,
  onChange,
}: {
  value: LiteralValue;
  type: ScalarType;
  label: string;
  onChange: (v: LiteralValue) => void;
}) {
  const [buffer, setBuffer] = useState(value === null ? "" : String(value));
  const sent = useRef(value);
  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setBuffer(value === null ? "" : String(value));
    }
  }, [value]);
  return (
    <input
      aria-label={label}
      value={buffer}
      onChange={(e) => {
        const text = e.target.value;
        setBuffer(text);
        const parsed = scalarText(text, type);
        sent.current = parsed;
        onChange(parsed);
      }}
    />
  );
}
