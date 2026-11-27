import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { ArrowUpRight, BookOpen, Menu, X } from "lucide-react";
import { Home } from "./Home";
import { loginUrl, catalogUrl } from "./MemberLinks";
import "./style.css";
const Information = lazy(() => import("./Information"));
const Discover = lazy(() =>
  import("./Catalog").then((m) => ({ default: m.Discover })),
);
const Details = lazy(() =>
  import("./Catalog").then((m) => ({ default: m.BookDetails })),
);
const nav = [
  ["/", "Home"],
  ["/about", "About"],
  ["/discover", "Discover books"],
  ["/services", "Services"],
  ["/faq", "FAQ"],
];
const descriptions: Record<string, string> = {
  "/": "Explore the Athenaeum collection, find your next book and discover how membership works.",
  "/about":
    "Meet Athenaeum, a library and reading room for readers, students and first-time borrowers.",
  "/discover":
    "Search the catalog by title or author, browse subjects and see which books are available.",
  "/services":
    "Explore physical borrowing, reservations, renewals and the personal member bookshelf.",
  "/how-it-works":
    "Follow the reader guide from opening your account to returning your first book.",
  "/faq":
    "Find answers to questions about membership, loans, holds, renewals and borrowing history.",
  "/contact": "Find help with your reader account, loans and returns.",
};
function Brand() {
  return (
    <Link className="brand" to="/">
      <BookOpen size={32} strokeWidth={1.4} />
      Athenaeum
    </Link>
  );
}
function Site() {
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const last = useRef(pathname);
  useEffect(() => {
    const name =
      nav.find(([url]) => url === pathname)?.[1] ||
      (pathname.startsWith("/discover/")
        ? "Book details"
        : { "/contact": "Contact", "/how-it-works": "How it works" }[
            pathname
          ] || "Page not found");
    document.title = name + " | Athenaeum";
    const description =
      descriptions[pathname] ||
      (pathname.startsWith("/discover/")
        ? "View catalog information and availability for this book."
        : "Find your way back to the Athenaeum catalog.");
    document
      .querySelectorAll(
        'meta[name="description"],meta[property="og:description"]',
      )
      .forEach((meta) => meta.setAttribute("content", description));
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", document.title);
    if (last.current !== pathname) {
      window.scrollTo(0, 0);
      document
        .querySelector<HTMLElement>("main")
        ?.focus({ preventScroll: true });
      last.current = pathname;
    }
  }, [pathname]);
  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header
        className="mast"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setMenu(false);
            trigger.current?.focus();
          }
        }}
      >
        <Brand />
        <button
          ref={trigger}
          className="menu-toggle"
          aria-expanded={menu}
          aria-controls="navigation"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />} Menu
        </button>
        <nav
          id="navigation"
          className={menu ? "opened" : ""}
          aria-label="Primary navigation"
          onClick={() => setMenu(false)}
        >
          {nav.map(([url, label]) => (
            <NavLink key={url} end={url === "/"} to={url}>
              {label}
            </NavLink>
          ))}
          <a className="sign" href={loginUrl}>
            Sign in
          </a>
          <Link className="button" to="/discover">
            Explore library <ArrowUpRight />
          </Link>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<p role="status">Opening page…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/discover" element={<Discover />} />
            <Route
              path="/discover/:id"
              element={<Details memberUrl={catalogUrl} />}
            />
            <Route path="*" element={<Information />} />
          </Routes>
        </Suspense>
      </main>
      <footer>
        <Brand />
        <nav aria-label="Footer navigation">
          {[
            ...nav.slice(1),
            ["/how-it-works", "How it works"],
            ["/contact", "Contact"],
          ].map(([url, label]) => (
            <Link key={url} to={url}>
              {label}
            </Link>
          ))}
          <a href={catalogUrl}>Library application</a>
          <a href={loginUrl}>Member sign-in</a>
        </nav>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Site />
  </BrowserRouter>,
);
