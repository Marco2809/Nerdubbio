import { api } from '@/lib/php/client';

export interface PublicUser {
  id?: string;
  handle: string;
  display_name: string | null;
  avatar_url?: string | null;
  bio?: string | null;
}

export interface PublicMediaItem {
  id: string;
  type?: 'tv' | 'movie' | null;
  status?: string;
  rating?: number | null;
  title?: string | null;
  posterUrl?: string | null;
  year?: number | null;
}

export interface PublicProfile extends PublicUser {
  level: number;
  streak: number;
  xp: number;
  watching: PublicMediaItem[];
  topRated: PublicMediaItem[];
}

export interface FriendRequestUser extends PublicUser {
  since?: string;
  requester_id?: string;
  target_id?: string;
}

export interface FriendsData {
  friends: FriendRequestUser[];
  incoming: FriendRequestUser[];
  outgoing: FriendRequestUser[];
}

export interface GroupMember extends PublicUser {
  role: 'owner' | 'member';
}

export interface Group {
  id: string;
  name: string;
  owner_id: string;
  is_owner: boolean;
  created_at: string;
  members: GroupMember[];
}

/** Gusti fusi dei membri per il Dubbio di gruppo. */
export interface GroupContext {
  memberCount: number;
  memberNames: string[];
  seenIds: string[];
  dismissedIds: string[];
  favoriteGenres: string[];
  platforms: string[];
}

export const SOCIAL_FRIENDS_KEY = ['social-friends'] as const;
export const SOCIAL_GROUPS_KEY = ['social-groups'] as const;

export const socialApi = {
  publicProfile(handle: string): Promise<PublicProfile> {
    return api<PublicProfile>(
      `/api/social.php?action=public_profile&handle=${encodeURIComponent(handle)}`,
    );
  },

  search(q: string): Promise<PublicUser[]> {
    return api<PublicUser[]>(`/api/social.php?action=search&q=${encodeURIComponent(q)}`);
  },

  friends(): Promise<FriendsData> {
    return api<FriendsData>('/api/social.php?action=friends');
  },

  friendRequest(handle: string): Promise<FriendsData> {
    return api<FriendsData>('/api/social.php?action=friend_request', 'POST', { handle });
  },

  friendRespond(userId: string, accept: boolean): Promise<FriendsData> {
    return api<FriendsData>('/api/social.php?action=friend_respond', 'POST', {
      user_id: userId,
      accept,
    });
  },

  friendRemove(userId: string): Promise<FriendsData> {
    return api<FriendsData>('/api/social.php?action=friend_remove', 'POST', { user_id: userId });
  },

  groups(): Promise<{ groups: Group[] }> {
    return api<{ groups: Group[] }>('/api/social.php?action=groups');
  },

  groupContext(groupId: string): Promise<GroupContext> {
    return api<GroupContext>(`/api/social.php?action=group_context&group_id=${encodeURIComponent(groupId)}`);
  },

  groupCreate(name: string): Promise<{ groups: Group[] }> {
    return api<{ groups: Group[] }>('/api/social.php?action=group_create', 'POST', { name });
  },

  groupAddMember(groupId: string, handle: string): Promise<{ groups: Group[] }> {
    return api<{ groups: Group[] }>('/api/social.php?action=group_add_member', 'POST', {
      group_id: groupId,
      handle,
    });
  },

  groupRemoveMember(groupId: string, userId: string): Promise<{ groups: Group[] }> {
    return api<{ groups: Group[] }>('/api/social.php?action=group_remove_member', 'POST', {
      group_id: groupId,
      user_id: userId,
    });
  },

  groupDelete(groupId: string): Promise<{ groups: Group[] }> {
    return api<{ groups: Group[] }>('/api/social.php?action=group_delete', 'POST', {
      group_id: groupId,
    });
  },
};
