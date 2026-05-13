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
    let msg =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    const detail =
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof (data as { detail: unknown }).detail === "string"
        ? (data as { detail: string }).detail.trim()
        : "";
    if (detail && detail !== msg) {
      msg = `${msg} — ${detail}`;
    }
    throw new Error(msg);
  }
  return data as T;
}
