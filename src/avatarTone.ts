/** avatar_2 is the purple character. It disappears on the violet circle. */
const PURPLE_AVATAR_ID = 'avatar_2';

export function avatarCircleColor(avatarId?: string | null): string {
  return avatarId === PURPLE_AVATAR_ID ? '#3A3A40' : '#5E2B85';
}
