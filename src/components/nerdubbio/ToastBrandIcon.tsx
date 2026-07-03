import { Loader2 } from "lucide-react";
import { BrandIcon } from "@/components/nerdubbio/BrandIcon";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "info" | "warning" | "loading";

const ring: Record<ToastVariant, string> = {
  default: "ring-primary/40",
  success: "ring-accent/50",
  error: "ring-destructive/45",
  info: "ring-secondary/45",
  warning: "ring-neon/45",
  loading: "ring-primary/35",
};

/** Icona toast Nerdubbio — sfera oracle con alone per tipo. */
export function ToastBrandIcon({ variant = "default" }: { variant?: ToastVariant }) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        "bg-surface-2/90 ring-2 backdrop-blur-sm",
        ring[variant],
        variant === "loading" && "animate-pulse",
      )}
    >
      <BrandIcon compact className="h-7 w-7" />
      {variant === "loading" && (
        <Loader2
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 animate-spin rounded-full bg-background text-primary"
          aria-hidden
        />
      )}
    </div>
  );
}
