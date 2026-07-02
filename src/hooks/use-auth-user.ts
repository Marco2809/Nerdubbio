import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export interface AuthProfile {
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** Hook client-only per leggere l'utente corrente + profilo. */
export function useAuthUser() {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<AuthProfile | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    setProfile({
      handle: user.handle,
      display_name: user.display_name,
      avatar_url: user.avatar_url ?? null,
    });
  }, [user]);

  return {
    user: user ? { id: user.id, email: user.email ?? undefined } : null,
    profile,
    loading,
  };
}
