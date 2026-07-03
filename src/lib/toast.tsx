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

/** Toast con icona Nerdubbio e stile dell'app (Toaster in __root). */
export const toast = Object.assign(branded(sonner, "default"), {
  success: branded(sonner.success, "success"),
  error: branded(sonner.error, "error"),
  info: branded(sonner.info, "info"),
  warning: branded(sonner.warning, "warning"),
  message: branded(sonner.message, "default"),
  loading: branded(sonner.loading, "loading"),
  promise: sonner.promise,
  custom: sonner.custom,
  dismiss: sonner.dismiss,
});
