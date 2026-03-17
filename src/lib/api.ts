/**
 * API helpers for authenticated requests
 */

/**
 * Extract userId from request (header or query).
 * Prefer X-User-Id header; fallback to userId query param.
 * Returns null if not provided - caller should return 401.
 */
export function getUserIdFromRequest(request: Request): string | null {
  const headerUserId = request.headers.get("X-User-Id");
  if (headerUserId) return headerUserId;
  const url = new URL(request.url);
  const queryUserId = url.searchParams.get("userId");
  if (queryUserId) return queryUserId;
  return null;
}
