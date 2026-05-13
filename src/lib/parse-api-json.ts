/**
 * Parse API JSON and throw a clear Error when status is not ok or body is not JSON.
 * Avoids uncaught promise rejections from Response.json() on HTML error pages.
 */
export async function parseApiJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`Server returned non-JSON (${res.status})`);
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
