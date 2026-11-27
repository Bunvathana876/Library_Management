import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { FeaturedShelf } from "./Shelf";
import { joinUrl } from "./MemberLinks";
export function Photograph({ reading = false }: { reading?: boolean }) {
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
      sizes="(max-width: 760px) 100vw, 48vw"
      loading={reading ? "lazy" : "eager"}
      fetchPriority={reading ? "auto" : "high"}
    />
  );
}
export function Home() {
  return (
    <>
      <section className="hero spread">
        <div className="hero-copy">
          <p className="kicker">
            <span /> Library &amp; reading room
          </p>
          <h1>
            Beyond
            <br />
            the <em>books.</em>
          </h1>
          <p className="lede">
            Find a book worth lingering over. Explore the Athenaeum collection
            and take your next read home.
          </p>
          <div className="actions">
            <Link className="button" to="/discover">
              Explore library <ArrowRight />
            </Link>
            <Link className="under" to="/about">
              About our library
            </Link>
          </div>
        </div>
        <div className="hero-photo">
          <Photograph />
        </div>
      </section>
      <div className="shelf-wrap">
        <FeaturedShelf />
      </div>
      <section className="reading spread">
        <Photograph reading />
        <div>
          <p className="kicker">The reading room</p>
          <h2>
            A place for
            <br />
            <em>curiosity.</em>
          </h2>
          <p>
            Athenaeum brings readers, students and first-time borrowers to the
            same shelves. Come with a question, follow an unfamiliar author, or
            spend an afternoon with a single chapter.
          </p>
          <Link className="under" to="/about">
            Meet the library <ArrowRight />
          </Link>
        </div>
      </section>
      <section className="spread service-strip">
        <div>
          <p className="kicker">Member services</p>
          <h2>
            More than
            <br />
            <em>books.</em>
          </h2>
        </div>
        <div>
          {[
            [
              "Find and borrow",
              "Explore the catalog and check out an available physical copy.",
            ],
            [
              "Reserve and renew",
              "Join a hold queue or request more reading time on an eligible loan.",
            ],
            [
              "Keep your bookshelf",
              "See due dates, notifications and the books you have returned.",
            ],
          ].map(([h, p]) => (
            <div className="service-line" key={h}>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
          <Link className="under" to="/services">
            Library services <ArrowRight />
          </Link>
        </div>
      </section>
      <section className="invitation">
        <div>
          <p className="kicker">Your library membership</p>
          <h2>
            Make room for
            <br />
            <em>your next read.</em>
          </h2>
          <p>
            Browse the catalog, create your reader account, then borrow an
            available book or reserve one. Your bookshelf keeps track of what
            comes next.
          </p>
        </div>
        <div className="actions">
          <a className="button" href={joinUrl}>
            Become a member <ArrowUpRight />
          </a>
          <Link className="under" to="/how-it-works">
            How it works
          </Link>
        </div>
      </section>
    </>
  );
}
