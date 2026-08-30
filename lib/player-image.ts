// Confirmed working (2026-08-29 investigation): Sleeper serves clubsoccer player thumbnails
// at this path, same CDN as team avatars. No documented API for it — just a real, verified
// URL pattern.
export function playerImageUrl(playerId: string): string {
  return `https://sleepercdn.com/content/clubsoccer/players/thumb/${playerId}.jpg`;
}
