import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import type { JobStatus } from "@storyforge/shared";

type Variant = "primary" | "ghost" | "danger" | "subtle";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-ink-950 hover:bg-accent-soft font-medium disabled:opacity-40",
  ghost:
    "bg-ink-800 text-slate-200 hover:bg-ink-700 border border-ink-700 disabled:opacity-40",
  subtle: "bg-transparent text-slate-400 hover:text-slate-100 hover:bg-ink-800",
  danger:
    "bg-transparent text-red-400 hover:bg-red-500/10 border border-red-500/30",
};

export function Button({
  variant = "ghost",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
}) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        className={`w-full rounded-lg bg-ink-850 border border-ink-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none ${className}`}
      />
    );
  },
);

export function TextArea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`w-full rounded-lg bg-ink-850 border border-ink-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none resize-y ${className}`}
    />
  );
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={`rounded-lg bg-ink-850 border border-ink-700 px-2.5 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none ${className}`}
    >
      {children}
    </select>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
      {children}
    </label>
  );
}

const statusStyles: Record<JobStatus, { label: string; cls: string }> = {
  idle: { label: "idle", cls: "bg-ink-700 text-slate-400" },
  queued: { label: "queued", cls: "bg-blue-500/15 text-blue-300" },
  running: { label: "running", cls: "bg-accent/15 text-accent animate-pulse" },
  done: { label: "done", cls: "bg-green-500/15 text-green-300" },
  error: { label: "error", cls: "bg-red-500/15 text-red-300" },
};

export function StatusBadge({
  status,
  label,
}: {
  status: JobStatus;
  label?: string;
}) {
  const s = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
    >
      {label ? `${label}: ` : ""}
      {s.label}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
