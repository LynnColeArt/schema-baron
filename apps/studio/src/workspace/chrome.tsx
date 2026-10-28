"use client";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
export function Dialog({
  title,
  children,
  onCancel,
  busy = false,
  className,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  busy?: boolean;
  className?: string | undefined;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
export function Tabs({
  label,
  values,
  active,
  onChange,
}: {
  label: string;
  values: string[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {values.map((value, index) => (
        <button
          key={value}
          role="tab"
          aria-selected={value === active}
          tabIndex={value === active ? 0 : -1}
          onClick={() => onChange(value)}
          onKeyDown={(event) => {
            const delta =
              event.key === "ArrowRight"
                ? 1
                : event.key === "ArrowLeft"
                  ? -1
                  : 0;
            if (!delta && !["Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? values.length - 1
                  : (index + delta + values.length) % values.length;
            onChange(values[next]!);
            (
              event.currentTarget.parentElement?.children[next] as HTMLElement
            )?.focus();
          }}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
export function Splitter({
  label,
  value,
  onChange,
  min,
  max,
  horizontal = false,
  invert = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  horizontal?: boolean;
  invert?: boolean;
}) {
  function update(n: number) {
    onChange(Math.round(Math.max(min, Math.min(max, n))));
  }
  return (
    <div
      className={`splitter ${horizontal ? "horizontal" : ""}`}
      role="separator"
      aria-label={label}
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
          ].includes(e.key)
        ) {
          e.preventDefault();
          update(
            e.key === "Home"
              ? min
              : e.key === "End"
                ? max
                : value + (["ArrowLeft", "ArrowUp"].includes(e.key) ? -16 : 16),
          );
        }
      }}
      onPointerDown={(e) => {
        const start = horizontal ? e.clientY : e.clientX;
        const element = e.currentTarget;
        element.setPointerCapture(e.pointerId);
        const move = (event: PointerEvent) =>
          update(
            value +
              ((horizontal ? event.clientY : event.clientX) - start) *
                (invert ? -1 : 1),
          );
        const stop = () => {
          element.removeEventListener("pointermove", move);
          element.removeEventListener("pointerup", stop);
          element.removeEventListener("pointercancel", stop);
        };
        element.addEventListener("pointermove", move);
        element.addEventListener("pointerup", stop);
        element.addEventListener("pointercancel", stop);
      }}
    />
  );
}
