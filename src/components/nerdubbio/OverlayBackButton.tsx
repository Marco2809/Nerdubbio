import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  className?: string;
  label?: string;
};

/** Pulsante indietro su hero/overlay — rispetta notch e home indicator iPhone. */
export function OverlayBackButton({ onClick, className, label = "Indietro" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute z-10 grid h-10 w-10 place-items-center rounded-full bg-black/50 backdrop-blur",
        "left-overlay-safe top-overlay-safe",
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
