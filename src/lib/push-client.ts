import { api } from '@/lib/php/client';

// Client web push: registra il service worker, sottoscrive con la chiave VAPID
// del server e sincronizza la subscription col backend.

function b64urlToUint8(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function keyToB64url(sub: PushSubscription, name: 'p256dh' | 'auth'): string {
  const buf = sub.getKey(name);
  if (!buf) return '';
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function swRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Chiede il permesso, sottoscrive e registra sul server. Torna true se attivo. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;

  const reg = await swRegistration();
  const { publicKey } = await api<{ publicKey: string }>('/api/push.php?action=vapid_key');
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlToUint8(publicKey).buffer as ArrayBuffer,
    }));

  await api('/api/push.php?action=subscribe', 'POST', {
    endpoint: sub.endpoint,
    p256dh: keyToB64url(sub, 'p256dh'),
    auth: keyToB64url(sub, 'auth'),
  });
  return true;
}

export async function disablePush(): Promise<void> {
  const sub = await getPushSubscription();
  if (!sub) return;
  try {
    await api('/api/push.php?action=unsubscribe', 'POST', { endpoint: sub.endpoint });
  } catch {
    /* best effort */
  }
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<number> {
  const res = await api<{ sent: number }>('/api/push.php?action=test', 'POST', {});
  return res.sent;
}

// --- Reminder server-side (specchio di quelli locali) ---

export function syncReminderToServer(r: {
  id: string;
  tmdbId: number;
  title: string;
  label: string;
  airDate: string;
  href: string;
}): void {
  void api('/api/push.php?action=reminder_add', 'POST', {
    item_id: r.id,
    tmdb_id: r.tmdbId,
    title: r.title,
    label: r.label,
    air_date: r.airDate,
    href: r.href,
  }).catch(() => undefined);
}

export function removeReminderFromServer(itemId: string): void {
  void api('/api/push.php?action=reminder_remove', 'POST', { item_id: itemId }).catch(() => undefined);
}
