import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  booksPath,
  coverUrl,
  getCatalog,
  latestAccessions,
  type Book,
} from "./catalogApi";
import "./catalog.css";

type Result<T> = { data: T; error?: never } | { data?: never; error: unknown };
export function useCatalog<T>(path: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; value: Result<T> }>();
  const key = path + "#" + attempt;
  useEffect(() => {
    const controller = new AbortController();
    if (path)
      getCatalog<T>(path, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setResult({ key, value: { data } });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setResult({ key, value: { error } });
        });
    return () => controller.abort();
  }, [key, path]);
  return {
    result: result?.key === key ? result.value : undefined,
    retry: () => setAttempt((n) => n + 1),
  };
}

export function Feedback({
  failed,
  retry,
  noun = "books",
}: {
  failed: boolean;
  retry: () => void;
  noun?: string;
}) {
  return (
    <div className="catalog-feedback" role="status">
      {failed ? (
        <>
          We couldn’t load the {noun}.{" "}
          <button onClick={retry}>Try again</button>
        </>
      ) : (
        <>Loading {noun}…</>
      )}
    </div>
  );
}

export function Cover({
  book,
  priority = false,
}: {
  book: Book;
  priority?: boolean;
}) {
  const src = coverUrl(book);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className={"catalog-cover tone-" + (book.id % 4)} aria-hidden="true">
      {src && failedUrl !== src ? (
        <img
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(src)}
        />
      ) : (
        <div className="catalog-cloth">
          <span>{book.author}</span>
          <b>{book.title}</b>
          <i className="cover-imprint" />
        </div>
      )}
    </div>
  );
}

export function BookList({
  books,
  featured = false,
}: {
  books: Book[];
  featured?: boolean;
}) {
  const Heading = featured ? "h3" : "h2";
  return (
    <ul className="catalog-grid">
      {books.map((book) => (
        <li key={book.id}>
          <Link className="catalog-book" to={"/discover/" + book.id}>
            <Cover book={book} />
            <Heading>{book.title}</Heading>
          </Link>
          <p>{book.author}</p>
          <small>
            {book.available ? "Available to borrow" : "Currently unavailable"}
          </small>
        </li>
      ))}
    </ul>
  );
}

export function FeaturedShelf() {
  const { result, retry } = useCatalog<Book[]>(booksPath());
  return (
    <section className="catalog-section">
      <header className="catalog-mast">
        <h2>New to the shelves</h2>
        <Link to="/discover">
          Browse all books <span aria-hidden="true">↗</span>
        </Link>
      </header>
      {result?.data ? (
        result.data.length ? (
          <BookList
            featured
            books={latestAccessions(result.data).slice(0, 4)}
          />
        ) : (
          <p>The shelves are waiting for their first titles.</p>
        )
      ) : (
        <Feedback failed={!!result} retry={retry} />
      )}
    </section>
  );
}
