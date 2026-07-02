# Nerdubbio — Autenticazione e cloud sync

Obiettivo: trasformare Nerdubbio da app locale a app account-based con login obbligatorio, sincronizzazione della libreria tra dispositivi e le fondamenta social (profili, amici, gruppi "cosa guardiamo stasera").

## Cosa cambia per l'utente

1. Alla prima apertura si finisce su `/auth`: Google, Apple o Email/password.
2. Se in `localStorage` esistono dati (watchlist, XP, streak, import TV Time), al primo login viene chiesto **una volta** "Vuoi portare qui i dati che avevi su questo dispositivo?" → import nel cloud, poi il locale viene svuotato.
3. Ogni utente ha un profilo pubblico (`@handle`, nome, avatar, bio, livello, streak).
4. Si possono cercare altri utenti, aggiungerli come amici e creare **gruppi** per decidere cosa guardare insieme (con il "Dubbio" di gruppo come step successivo).
5. Menù account nella top bar: avatar, link al profilo, logout.

## Provider da attivare

- Google (via broker Lovable).
- Apple (via broker Lovable).
- Email + password con reset via `/reset-password`.

Nessun social provider extra oltre a questi tre.

## Modello dati (Lovable Cloud)

Tutte le tabelle nel public schema con RLS abilitata, GRANT ad `authenticated`, ruoli gestiti in tabella separata `user_roles`.

- `profiles(id uuid pk → auth.users, handle citext unique, display_name, avatar_url, bio, created_at)` — trigger `on auth.users insert` per creare la riga.
- `user_stats(user_id pk, xp int, level int, streak_days int, last_watched_at)` — aggiornata dal client via RPC.
- `user_media(user_id, media_key text, tmdb_id int, media_type text, status text, rating int, reactions jsonb, imported_from text, added_at, updated_at, pk(user_id, media_key))`.
- `user_episodes(user_id, media_key, season int, episode int, watched_at, pk(user_id, media_key, season, episode))`.
- `friendships(user_id, friend_id, status enum('pending','accepted','blocked'), created_at, pk(user_id, friend_id))` con policy simmetriche.
- `groups(id, name, owner_id, created_at)` + `group_members(group_id, user_id, role, pk)`.
- `user_roles(user_id, role app_role)` + funzione security definer `has_role(_user_id, _role)` — pronta per feature admin future.

RLS: ogni utente vede/modifica solo le proprie righe di `user_media`, `user_episodes`, `user_stats`. `profiles` in lettura pubblica su colonne safe (handle, display_name, avatar, bio, level, streak). `friendships` visibile ai due lati. `groups` visibile ai membri.

## Architettura codice (TanStack Start + Cloud)

- `_authenticated/` copre TUTTA l'app: sposto `app.tsx`, `search.tsx`, `watchlist.tsx`, `dubbio.tsx`, `prossimi.tsx`, `media.$type.$id.tsx`, `da-tvtime.tsx`, `profile` sotto `src/routes/_authenticated/`.
- `index.tsx` diventa una **landing pubblica** con pitch + CTA "Accedi", niente `beforeLoad`. Serve anche per l'og:image condivisibile.
- Route pubbliche: `/`, `/auth`, `/reset-password`, `/u/$handle` (profilo pubblico read-only per condivisione).
- `src/routes/auth.tsx`: tabs Login / Registrati, bottoni Google e Apple via `lovable.auth.signInWithOAuth`, form email/password. Rispetta `?redirect=` per tornare alla destinazione originale.
- `src/routes/reset-password.tsx`: form set nuova password (public).
- `src/routes/_authenticated/route.tsx` è integration-managed → non lo tocchiamo.
- `__root.tsx`: un solo `onAuthStateChange` (SIGNED_IN/OUT/USER_UPDATED) che fa `router.invalidate()` + `queryClient.invalidateQueries()`. AppBar mostra avatar + menù (Profilo, Amici, Logout) al posto del vecchio header statico.

## Refactor dello store

`src/lib/user-store.ts` oggi è uno `zustand` + localStorage. Diventa un **hook cloud-first**:
- `useUserLibrary()` legge da server functions `getMyLibrary`, `getMyStats`, `getMyEpisodes` via TanStack Query (cache per userId).
- Mutazioni (`toggleEpisode`, `setStatus`, `rateSeries`, `addReaction`, `bulkImport`) diventano server functions `.middleware([requireSupabaseAuth])` con Optimistic Update via `useMutation` + `queryClient.setQueryData`.
- L'undo dei toast continua a funzionare invertendo la mutation lato server.
- Rimane un piccolo helper `local-legacy.ts` che legge `localStorage` UNA volta per la migrazione, poi chiama `bulkImportFromLocal` e cancella la chiave.

## Migrazione dati locali → cloud (una tantum)

Alla prima login riuscita:
1. Se esiste `nerdubbio-user-store` in `localStorage` E `user_media` cloud è vuoto → mostro dialog "Trovati N titoli su questo dispositivo, importali?".
2. Su conferma → `bulkImportFromLocal` (server fn) upserta media, episodi e stats.
3. Se rifiuta → segno un flag cloud `migrated=true` e svuoto il localStorage.

## Social — cosa entra in questo giro

MVP social pensato per non gonfiare troppo lo scope:
- Profilo pubblico `/u/$handle` con libreria pubblica (top rated, currently watching, streak).
- Ricerca utenti per handle in `/amici` (nuova route).
- Richieste amicizia (invia, accetta, rifiuta) + lista amici.
- Gruppi: crea, invita amici via handle, lista membri. Il "Dubbio di gruppo" (quiz condiviso) resta stub per lo sprint successivo.

## Sicurezza

- `requireSupabaseAuth` su ogni server fn utente.
- Nessun `supabaseAdmin` in route/functions client-reachable.
- Client TMDB resta server-only con la key già presente.
- HIBP password check attivo via `configure_auth` per bloccare password compromesse.
- Google/Apple attivati via `supabase--configure_social_auth` nello stesso turno del bottone.
- `/reset-password` come route pubblica separata (no auto-login post-reset).

## Rischi / cose che romperò e come le sistemo

- L'app oggi è tutta client-only: tutte le route esistenti vanno spostate sotto `_authenticated/` in un colpo solo, altrimenti hanno redirect loop.
- I link deep tipo `/media/tv/tv-123` diventano auth-gated → aggiungo un `?redirect=` handling in `/auth`.
- I dati mock/local dei tester vanno migrati la prima volta o si "perdono" — dialog esplicito.
- Le PWA installate perderanno la sessione se `localStorage` viene pulito: uso il persister Supabase di default (localStorage), documentato.

## Sequenza di implementazione

1. Attivo Lovable Cloud + provider Google/Apple, HIBP on.
2. Migrazioni SQL: `profiles`, `user_stats`, `user_media`, `user_episodes`, `friendships`, `groups`, `group_members`, `user_roles` + trigger + `has_role`.
3. `/auth`, `/reset-password`, landing pubblica `/`, cartella `_authenticated/` e spostamento route esistenti.
4. Server functions libreria (`getMyLibrary`, `toggleEpisode`, `setStatus`, `rateSeries`, `bulkImport`, `getMyStats`).
5. Refactor `user-store` → hook cloud + dialog migrazione localStorage.
6. Header con avatar/menu, `onAuthStateChange` in root, sign-out hygiene.
7. Profilo pubblico `/u/$handle`, ricerca amici, richieste, gruppi base.

Al termine di ciascun blocco verifico build e flusso login → deep-link → dati visibili.
