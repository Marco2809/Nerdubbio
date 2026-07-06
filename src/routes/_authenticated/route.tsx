import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getToken } from "@/lib/php/client";
import { useAuth } from "@/lib/auth";
import { LocalMigrationDialog } from "@/components/nerdubbio/LocalMigrationDialog";
import { I18nProvider, normalizeLocale, useI18n } from "@/lib/i18n";
import { useUserStore } from "@/lib/user-store";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    if (!getToken()) {
      throw redirect({ to: "/auth", search: { redirect: window.location.pathname } });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const { state } = useUserStore();

  if (loading) {
    return (
      <I18nProvider locale={normalizeLocale(state.language)}>
        <AuthLoadingScreen />
      </I18nProvider>
    );
  }

  if (!user) {
    window.location.assign("/auth");
    return null;
  }

  return (
    <I18nProvider locale={normalizeLocale(state.language)}>
      <LocalMigrationDialog />
      <Outlet />
    </I18nProvider>
  );
}

function AuthLoadingScreen() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="text-sm text-muted-foreground animate-pulse">{t("common.loading")}</div>
    </div>
  );
}
