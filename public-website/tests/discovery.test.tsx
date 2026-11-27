// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BookDetails, Discover } from "../src/Catalog";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(path: string) {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/discover" element={<Discover />} />
          <Route path="/discover/:id" element={<BookDetails />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
}
it("announces loading, then offers a clear-filters link for empty search results", async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.endsWith("/categories")
        ? Promise.resolve(Response.json(["History"]))
        : new Promise<Response>((resolve) => {
            finish = resolve;
          }),
    ),
  );
  await render("/discover?search=unmatched");
  expect(container.textContent).toContain("Loading books");
  await act(async () => finish(Response.json([])));
  expect(container.textContent).toContain("No titles match");
  expect(container.querySelector("a")?.getAttribute("href")).toBe("/discover");
  expect(container.querySelector("select")?.textContent).toContain("History");
});
it("restores the catalog after a temporary outage without losing the search", async () => {
  let failed = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.endsWith("/categories"))
        return Promise.resolve(Response.json([]));
      if (!failed) {
        failed = true;
        return Promise.resolve(new Response(null, { status: 503 }));
      }
      return Promise.resolve(
        Response.json([
          {
            id: 31,
            title: "Recovered title",
            author: "Writer",
            publicationYear: 2004,
            available: false,
          },
        ]),
      );
    }),
  );
  await render("/discover?search=recover");
  expect(container.textContent).toContain("couldn’t load");
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  )!;
  await act(async () => retry.click());
  expect(container.querySelector("input")?.value).toBe("recover");
  expect(container.textContent).toContain("Currently unavailable");
  expect(container.querySelector(".catalog-book")?.getAttribute("href")).toBe(
    "/discover/31",
  );
});
it("shows a missing-title message for a deleted book", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
  );
  await render("/discover/55");
  expect(container.querySelector("h1")?.textContent).toBe("Book not found");
});
