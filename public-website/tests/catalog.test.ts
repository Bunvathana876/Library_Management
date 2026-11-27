import { afterEach, expect, it, vi } from "vitest";
import {
  booksPath,
  coverUrl,
  getCatalog,
  latestAccessions,
  type Book,
} from "../src/catalogApi";

const book: Book = {
  id: 10,
  title: "A book",
  author: "A writer",
  available: true,
  publicationYear: 2010,
};
afterEach(() => vi.unstubAllGlobals());

it("sends trimmed and encoded search and category to the existing list route", () => {
  expect(booksPath("  A & B ", "Art / Design")).toBe(
    "/api/books?search=A+%26+B&category=Art+%2F+Design",
  );
  expect(booksPath("  ", "")).toBe("/api/books");
});
it("orders additions by accession and preserves the server response", () => {
  const books = [book, { ...book, id: 20, publicationYear: 1980 }];
  expect(latestAccessions(books).map((b) => b.id)).toEqual([20, 10]);
  expect(books[0]).toBe(book);
});
it("rejects malformed or executable cover URLs", () => {
  for (const value of [
    null,
    "data:text/html,x",
    "broken",
    "javascript:void(0)",
  ]) {
    expect(coverUrl({ ...book, coverUrl: value })).toBeNull();
  }
  expect(coverUrl({ ...book, coverUrl: "https://example.org/cover.jpg" })).toBe(
    "https://example.org/cover.jpg",
  );
});
it("reads without credentials and reuses fresh successful responses", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json([book]));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  const path = booksPath("cache test");
  await expect(getCatalog(path, signal)).resolves.toEqual([book]);
  await expect(getCatalog(path, signal)).resolves.toEqual([book]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(
    path,
    expect.objectContaining({ signal, credentials: "omit" }),
  );
});
it("preserves status and lets a reader retry a failed request", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json(book));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  await expect(getCatalog("/api/books/42", signal)).rejects.toMatchObject({
    status: 503,
  });
  await expect(getCatalog("/api/books/42", signal)).resolves.toEqual(book);
});
