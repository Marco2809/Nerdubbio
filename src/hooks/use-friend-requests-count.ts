import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/php/client";
import { SOCIAL_FRIENDS_KEY, socialApi } from "@/lib/php/social-client";

/** Richieste di amicizia in arrivo — condivide cache con /amici. */
export function useFriendRequestCount(): number {
  const enabled = typeof window !== "undefined" && !!getToken();
  const { data } = useQuery({
    queryKey: SOCIAL_FRIENDS_KEY,
    queryFn: () => socialApi.friends(),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  return data?.incoming?.length ?? 0;
}
