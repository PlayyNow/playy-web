import type { PublicEventResponse } from './types';

export const API_BASE = 'https://playy-api.onrender.com/api/v1';
export const APP_STORE_URL = 'https://apps.apple.com/app/playy-find-your-game/id6759396368';

export class PublicEventError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchPublicEvent(eventId: string): Promise<PublicEventResponse> {
  const res = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/public`);
  if (res.status === 404) {
    throw new PublicEventError(404, 'Event not found');
  }
  if (!res.ok) {
    throw new PublicEventError(res.status, 'Failed to load event');
  }
  return res.json() as Promise<PublicEventResponse>;
}
