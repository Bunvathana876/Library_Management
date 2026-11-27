import { useEffect, useRef } from "react";
import { catalogUrl } from "./MemberLinks";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  booksPath,
  CatalogError,
  latestAccessions,
  type Book,
} from "./catalogApi";
import { BookList, Cover, Feedback, useCatalog } from "./Shelf";
export function Discover() {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const category = params.get("category") || "";
  const searchField = useRef<HTMLInputElement>(null);
  const subjectField = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (searchField.current) searchField.current.value = search;
    if (subjectField.current) subjectField.current.value = category;
  }, [search, category]);
  const page = Math.max(1, Number.parseInt(params.get("page") || "", 10) || 1);
  const { result, retry } = useCatalog<Book[]>(booksPath(search, category));
  const categories = useCatalog<string[]>("/api/books/categories");
  const books = result?.data && latestAccessions(result.data);
  const pages = Math.max(1, Math.ceil((books?.length || 0) / 12));
  const current = Math.min(page, pages);
  function pageLink(next: number) {
    const value = new URLSearchParams(params);
    value.set("page", String(next));
    return "?" + value.toString();
  }
  return (
    <section className="catalog-page">
      <header className="catalog-intro">
        <h1>Discover books</h1>
        <p>
          Browse the newest additions, look up a favourite author, or follow a
          subject somewhere unexpected.
        </p>
      </header>
      <form
        role="search"
        className="catalog-search"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const query = new URLSearchParams();
          for (const field of ["search", "category"]) {
            const value = String(form.get(field) || "").trim();
            if (value) query.set(field, value);
          }
          setParams(query);
        }}
      >
        <label>
          Search the catalog
          <input
            ref={searchField}
            type="search"
            name="search"
            defaultValue={search}
            placeholder="Title, author or ISBN"
          />
        </label>
        <label>
          Subject
          <select ref={subjectField} name="category" defaultValue={category}>
            <option value="">All subjects</option>
            {Array.from(
              new Set([
                ...(categories.result?.data || []),
                ...(category ? [category] : []),
              ]),
            ).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button type="submit">Search books</button>
      </form>
      {categories.result && !categories.result.data && (
        <Feedback failed retry={categories.retry} noun="subjects" />
      )}
      {books ? (
        <>
          <p role="status" className="catalog-count">
            {books.length} {books.length === 1 ? "title" : "titles"} · Newest
            additions first
          </p>
          {books.length ? (
            <BookList books={books.slice((current - 1) * 12, current * 12)} />
          ) : (
            <p>
              {search || category ? (
                <>
                  No titles match this search.{" "}
                  <Link to="/discover">Clear filters</Link>
                </>
              ) : (
                "There are no titles in the catalog yet."
              )}
            </p>
          )}
          {pages > 1 && (
            <nav className="catalog-pager" aria-label="Catalog pages">
              {current > 1 && (
                <Link to={pageLink(current - 1)}>Previous page</Link>
              )}
              <span>
                Page {current} of {pages}
              </span>
              {current < pages && (
                <Link to={pageLink(current + 1)}>Next page</Link>
              )}
            </nav>
          )}
        </>
      ) : (
        <Feedback failed={!!result} retry={retry} />
      )}
    </section>
  );
}

export function BookDetails({
  memberUrl = catalogUrl,
}: {
  memberUrl?: string;
}) {
  const { id } = useParams();
  const validId = id && /^[1-9]\d*$/.test(id);
  const { result, retry } = useCatalog<Book>(validId ? "/api/books/" + id : "");
  const book = result?.data;
  const missing =
    !validId ||
    (result?.error instanceof CatalogError && result.error.status === 404);
  return (
    <section className="catalog-page">
      <Link to="/discover">← Discover books</Link>
      {missing ? (
        <h1>Book not found</h1>
      ) : book ? (
        <div className="catalog-detail">
          <Cover book={book} priority />
          <div>
            <p>{book.category}</p>
            <h1>{book.title}</h1>
            <p className="catalog-byline">By {book.author}</p>
            <dl>
              {Object.entries({
                Availability: book.available
                  ? "Available to borrow"
                  : "Currently unavailable",
                Published: book.publicationYear,
                Publisher: book.publisher,
                ISBN: book.isbn,
                Shelf: book.shelfLocation,
              })
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
            <a className="catalog-action" href={memberUrl}>
              Open the library application <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      ) : (
        <>
          <h1>Book details</h1>
          <Feedback failed={!!result} retry={retry} noun="book" />
        </>
      )}
    </section>
  );
}
