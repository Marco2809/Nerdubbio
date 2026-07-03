import { toast as sonner, type ExternalToast } from "sonner";
import { ToastBrandIcon, type ToastVariant } from "@/components/nerdubbio/ToastBrandIcon";

type ToastMessage = Parameters<typeof sonner>[0];

function withBrandIcon(data: ExternalToast | undefined, variant: ToastVariant): ExternalToast {
  if (data?.icon === null) return data ?? {};
  return { ...data, icon: data?.icon ?? <ToastBrandIcon variant={variant} /> };
}

function branded(
  fn: (message: ToastMessage, data?: ExternalToast) => string | number,
  variant: ToastVariant,
) {
  return (message: ToastMessage, data?: ExternalToast) => fn(message, withBrandIcon(data, variant));
}

/** Toast reward: messaggio + chip "+XP" evidenziato (l'eventuale description resta sotto il chip). */
function reward(message: ToastMessage, xp: number, data?: ExternalToast) {
  return sonner.success(message, {
    ...data,
    icon: <ToastBrandIcon variant="reward" />,
    description: (
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center rounded-full bg-neon/15 px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-neon">
          +{xp} XP
        </span>
        {data?.description != null ? <span>{data.description as React.ReactNode}</span> : null}
      </span>
    ),
  });
}

/** Toast con icona Nerdubbio e stile dell'app (Toaster in __root). */
export const toast = Object.assign(branded(sonner, "default"), {
  success: branded(sonner.success, "success"),
  error: branded(sonner.error, "error"),
  info: branded(sonner.info, "info"),
  warning: branded(sonner.warning, "warning"),
  message: branded(sonner.message, "default"),
  loading: branded(sonner.loading, "loading"),
  reward,
  promise: sonner.promise,
  custom: sonner.custom,
  dismiss: sonner.dismiss,
});
