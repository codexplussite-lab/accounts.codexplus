import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "paid" | "partially_paid" | "overdue" | "draft" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider font-medium border transition-colors",
        {
          "bg-zinc-100 text-zinc-700 border-zinc-200": variant === "default" || variant === "draft",
          "bg-emerald-50 text-emerald-800 border-emerald-200": variant === "paid",
          "bg-amber-50 text-amber-800 border-amber-200": variant === "partially_paid",
          "bg-rose-50 text-rose-800 border-rose-200": variant === "overdue",
          "bg-transparent text-ink-secondary border-border": variant === "outline"
        },
        className
      )}
      {...props}
    />
  );
}
