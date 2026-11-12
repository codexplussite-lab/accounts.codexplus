import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "emerald";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink-primary disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-ink-primary text-white hover:bg-slate-800 shadow-subtle": variant === "default",
            "bg-emerald-brand text-white hover:bg-emerald-800 shadow-subtle": variant === "emerald",
            "bg-surface text-ink-primary border border-border hover:bg-canvas shadow-subtle": variant === "outline",
            "bg-canvas text-ink-primary hover:bg-surface border border-transparent": variant === "secondary",
            "hover:bg-canvas text-ink-secondary hover:text-ink-primary": variant === "ghost",
            "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100": variant === "destructive"
          },
          {
            "h-8 px-3 py-1.5": size === "default",
            "h-7 px-2.5 text-[11px]": size === "sm",
            "h-9 px-4 text-sm": size === "lg",
            "h-8 w-8": size === "icon"
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
