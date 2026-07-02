import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { auth as phpAuth } from "@/lib/php/client";
import { z } from "zod";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — Nerdubbio" }] }),
  validateSearch: searchSchema,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("Link non valido", { description: "Richiedi un nuovo reset dalla pagina di login." });
      return;
    }
    if (password !== confirm) {
      toast.error("Le password non coincidono");
      return;
    }
    if (password.length < 6) {
      toast.error("Minimo 6 caratteri");
      return;
    }
    setLoading(true);
    try {
      await phpAuth.resetPassword(token, password);
      toast.success("Password aggiornata");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error("Errore", { description: err instanceof Error ? err.message : "Riprova." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-sm flex-col px-4 pt-10">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-hero shadow-glow-pink">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="font-bold">Nerdubbio</span>
        </Link>

        <h1 className="text-3xl font-extrabold">Nuova password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Scegline una che non dimenticherai stavolta.</p>

        {!token ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Link mancante o scaduto. Vai su{" "}
            <Link to="/auth" className="text-accent underline">login</Link> e richiedi un nuovo reset.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              type="password"
              required
              minLength={6}
              placeholder="Nuova password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Conferma password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground shadow-glow-pink disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Aggiorna password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
