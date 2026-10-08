import { api } from '@/lib/php/client';

/** Candidato proposto al voto del gruppo (sottoinsieme di NerdacoloCandidate). */
export interface VoteCandidate {
  mediaKey: string;
  tmdbId: number;
  mediaType: 'tv' | 'movie';
  title: string;
  releaseYear?: number | null;
  posterPath?: string | null;
}

export interface GroupVote {
  id: string;
  groupName: string;
  createdBy: string;
  isCreator: boolean;
  expired: boolean;
  memberCount: number;
  voterCount: number;
  candidates: VoteCandidate[];
  tally: Record<string, { yes: number; no: number }>;
  myVotes: Record<string, 1 | -1>;
}

export const groupVoteKey = (id: string) => ['nerdacolo-vote', id] as const;

export const nerdacoloApi = {
  createVote(groupId: string, candidates: VoteCandidate[]): Promise<{ id: string }> {
    return api('/api/nerdacolo.php?action=vote_create', 'POST', { group_id: groupId, candidates });
  },
  getVote(id: string): Promise<GroupVote> {
    return api(`/api/nerdacolo.php?action=vote_get&id=${encodeURIComponent(id)}`);
  },
  castVote(id: string, mediaKey: string, vote: 1 | -1 | 0): Promise<{ ok: true }> {
    return api('/api/nerdacolo.php?action=vote_cast', 'POST', { id, media_key: mediaKey, vote });
  },
};

/** Vincitore: più 👍 meno 👎; a parità vale l'ordine del Nerdacolo. */
export function voteLeader(v: GroupVote): VoteCandidate | null {
  let best: VoteCandidate | null = null;
  let bestScore = 0;
  for (const c of v.candidates) {
    const t = v.tally[c.mediaKey];
    const score = t ? t.yes - t.no : 0;
    if (t && t.yes > 0 && (best === null || score > bestScore)) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
