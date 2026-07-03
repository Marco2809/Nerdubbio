import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  clearLocalLegacy,
  loadLocalLegacy,
  localLegacyHasData,
  localLegacyMediaCount,
} from '@/lib/local-legacy';
import { useUserStore } from '@/lib/user-store';

/** Dialog una tantum: importa dati localStorage nel cloud. */
export function LocalMigrationDialog() {
  const { state, loading, importLocal, skipLocalMigration } = useUserStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [legacy] = useState(() => loadLocalLegacy());

  useEffect(() => {
    if (loading || state.localMigrated) return;
    if (!localLegacyHasData(legacy)) return;
    if (Object.keys(state.media).length > 0) return;
    setOpen(true);
  }, [loading, state.localMigrated, state.media, legacy]);

  if (!open || !legacy) return null;

  const count = localLegacyMediaCount(legacy);
  const xp = legacy.xp ?? 0;

  async function handleImport() {
    setBusy(true);
    try {
      await importLocal(legacy!);
      clearLocalLegacy();
      toast.success('Dati importati nel cloud', {
        description: `${count} titoli sincronizzati. Puoi usarli da qualsiasi dispositivo.`,
      });
      setOpen(false);
    } catch (e) {
      toast.error('Import fallito', { description: e instanceof Error ? e.message : 'Riprova.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    setBusy(true);
    try {
      await skipLocalMigration();
      clearLocalLegacy();
      setOpen(false);
    } catch (e) {
      toast.error('Errore', { description: e instanceof Error ? e.message : 'Riprova.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass max-w-sm rounded-3xl border border-border p-6 shadow-glow-pink">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-hero">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Porta i tuoi dati nel cloud</h2>
            <p className="text-xs text-muted-foreground">Solo questa volta</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Su questo dispositivo hai{' '}
          <strong className="text-foreground">{count} titoli</strong>
          {xp > 0 && (
            <>
              {' '}e <strong className="text-foreground">{xp} XP</strong>
            </>
          )}
          . Vuoi sincronizzarli con il tuo account?
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleImport}
            className="flex items-center justify-center gap-2 rounded-2xl bg-hero py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Sì, importa tutto
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleSkip}
            className="rounded-2xl py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            No, parto da zero
          </button>
        </div>
      </div>
    </div>
  );
}
