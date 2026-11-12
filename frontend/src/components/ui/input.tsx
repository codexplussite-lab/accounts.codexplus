import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isNumeric?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, isNumeric = false, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full rounded border border-border bg-surface px-3 py-1 text-xs text-ink-primary shadow-subtle transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-primary disabled:cursor-not-allowed disabled:opacity-50",
          isNumeric && "font-mono tabular-nums text-right",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

