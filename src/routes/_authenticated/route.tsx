import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getToken } from "@/lib/php/client";
import { useAuth } from "@/lib/auth";
import { LocalMigrationDialog } from "@/components/nerdubbio/LocalMigrationDialog";

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

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-sm text-muted-foreground animate-pulse">Caricamento…</div>
      </div>
    );
  }

  if (!user) {
    window.location.assign("/auth");
    return null;
  }

  return (
    <>
      <LocalMigrationDialog />
      <Outlet />
    </>
  );
}
