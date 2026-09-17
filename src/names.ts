import type { PublicEvent, PublicStanding } from './types';

export function playerName(
  userId: string,
  event: PublicEvent,
  standings: PublicStanding[] = []
): string {
  const fromRoster = event.participants.find((p) => p.userId === userId);
  if (fromRoster?.name?.trim()) return fromRoster.name.trim();
  if (fromRoster?.username?.trim()) return fromRoster.username.trim();
  const fromStandings = standings.find((s) => s.userId === userId)?.user;
  if (fromStandings?.name?.trim()) return fromStandings.name.trim();
  if (fromStandings?.username?.trim()) return fromStandings.username.trim();
  return 'Player';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function avatarSrc(avatarId?: string | null): string | null {
  if (!avatarId) return null;
  if (!/^avatar_[1-6]$/.test(avatarId)) return null;
  return `/avatars/${avatarId}.png`;
}

export function formatNet(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function courtLabel(courtNumber: number, courtNames?: string[] | null): string {
  if (Array.isArray(courtNames) && courtNames[courtNumber - 1]?.trim()) {
    return courtNames[courtNumber - 1].trim();
  }
  return `Court ${courtNumber}`;
}

export function formatDubai(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Dubai',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
