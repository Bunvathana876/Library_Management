export interface Book {
  id: number;
  title: string;
  author: string;
  publicationYear: number;
  isbn?: string | null;
  publisher?: string | null;
  category?: string | null;
  shelfLocation?: string | null;
  coverUrl?: string | null;
  available: boolean;
}

export function booksPath(search = "", category = "") {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (category.trim()) query.set("category", category.trim());
  return "/api/books" + (query.size ? "?" + query.toString() : "");
}

export function coverUrl(book: Book) {
  if (!book.coverUrl) return null;
  try {
    const url = new URL(book.coverUrl);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function latestAccessions(books: Book[]) {
  return [...books].sort((a, b) => b.id - a.id);
}

export class CatalogError extends Error {
  status: number;
  constructor(status: number) {
    super("Catalog request failed");
    this.status = status;
  }
}

const cache = new Map<string, { data: unknown; expires: number }>();
export async function getCatalog<T>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const entry = cache.get(path);
  if (entry && entry.expires > Date.now()) return entry.data as T;
  const response = await fetch(path, {
    signal,
    credentials: "omit",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new CatalogError(response.status);
  const data: unknown = await response.json();
  if (cache.size >= 20) cache.delete(cache.keys().next().value!);
  cache.set(path, { data, expires: Date.now() + 30_000 });
  return data as T;
}
