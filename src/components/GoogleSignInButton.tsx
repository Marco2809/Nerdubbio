import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GIS_SRC = 'https://accounts.google.com/gsi/client';

type GoogleIdApi = {
  initialize: (cfg: {
    client_id: string;
    callback: (r: { credential: string }) => void;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Impossibile caricare Google Sign-In'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  width?: number;
}

export function GoogleSignInButton({ onSuccess, width = 360 }: GoogleSignInButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { signInWithGoogle } = useAuth();

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled || !window.google || !ref.current) return;
        const gid = window.google.accounts.id;
        gid.initialize({
          client_id: CLIENT_ID,
          callback: async (resp) => {
            const { error } = await signInWithGoogle(resp.credential);
            if (error) {
              toast.error(error);
              return;
            }
            onSuccess?.();
          },
          cancel_on_tap_outside: true,
        });
        gid.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          width,
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      })
      .catch(() => {
        /* script non caricato */
      });

    return () => {
      cancelled = true;
      window.google?.accounts.id.cancel();
    };
  }, [signInWithGoogle, onSuccess, width]);

  if (!CLIENT_ID) return null;
  return <div ref={ref} className="flex justify-center w-full" />;
}
