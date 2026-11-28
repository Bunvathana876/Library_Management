import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { FeaturedShelf } from "./Shelf";
import { joinUrl } from "./MemberLinks";
export function Photograph({
  reading = false,
  primary = false,
}: {
  reading?: boolean;
  primary?: boolean;
}) {
  const name = reading ? "reading" : "shelf";
  const [small, large] = reading ? [640, 1280] : [720, 1440];
  return (
    <img
      className="photograph"
      alt={
        reading
          ? "Open books on a sunlit wooden table"
          : "Warm light falling across rows of library shelves"
      }
      src={"/images/" + name + "-" + large + ".webp"}
      srcSet={`/images/${name}-${small}.webp ${small}w, /images/${name}-${large}.webp ${large}w`}
      sizes="(max-width: 760px) 100vw, 68vw"
      loading={primary ? "eager" : "lazy"}
      fetchPriority={primary ? "high" : "auto"}
    />
  );
}
export function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-photo">
          <Photograph reading primary />
        </div>
        <div className="hero-copy">
          <p className="identity-line">Library &amp; reading room</p>
          <h1>
            Beyond the <em>books.</em>
          </h1>
          <p className="lede">
            Browse Athenaeum’s shelves for a familiar author, a new subject, or
            a book to take home.
          </p>
          <Link className="button" to="/discover">
            Explore the collection <ArrowRight />
          </Link>
        </div>
      </section>
      <div className="shelf-wrap">
        <FeaturedShelf />
      </div>
      <section className="reader-guide">
        <div>
          <h2>At the library</h2>
          <p>
            Athenaeum brings students, readers and first-time borrowers to the
            same shelves.
          </p>
          <Link className="under" to="/about">
            About Athenaeum <ArrowRight />
          </Link>
        </div>
        <dl>
          {[
            [
              "Borrow a copy",
              "Choose a physical book and confirm your loan in the member catalog.",
            ],
            [
              "Reserve a title",
              "Join the queue for a book that’s out. Your bookshelf shows when a copy is ready.",
            ],
            [
              "Keep reading",
              "Check due dates, renew eligible loans and revisit your borrowing history.",
            ],
          ].map(([name, body]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{body}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="invitation">
        <div>
          <h2>
            A bookshelf <em>of your own.</em>
          </h2>
          <p>Join Athenaeum to borrow books and keep track of your reading.</p>
        </div>
        <a className="button" href={joinUrl}>
          Become a member <ArrowUpRight />
        </a>
      </section>
    </>
  );
}
