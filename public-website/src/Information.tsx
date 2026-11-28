import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Photograph } from "./Home";
import { joinUrl, loginUrl } from "./MemberLinks";
import "./information.css";

const steps = [
  [
    "Browse the collection",
    "Search the catalog by title or author, or follow a category. Open a book to see whether a copy is available. Everyone can browse.",
  ],
  [
    "Open your reader account",
    "Register with your full name, email address and password. Successful registration creates your borrower profile and signs you in. Already a member? Use your existing sign-in.",
  ],
  [
    "Borrow a physical copy",
    "In the member catalog, choose an available title and confirm the loan. An available copy is assigned to you for 14 days. Its barcode and due date appear in My Bookshelf.",
  ],
  [
    "Reserve a title",
    "If all copies are out, place a hold in the member catalog. Readers are served in queue order. Check your notifications for a ready hold and collect the copy before the pickup deadline on your bookshelf.",
  ],
  [
    "Renew before the due date",
    "Open My Bookshelf and select Renew on an eligible loan. Each renewal adds 14 days to the due date, up to twice. An active hold, overdue loan, inactive account or fine block can prevent renewal.",
  ],
  [
    "Bring your book back",
    "Return the physical copy to library staff so they can record the return. Overdue charges accrue by day. Check your bookshelf for your balance and ask at the circulation desk about settling a fine after return.",
  ],
];

const questions = [
  [
    "Do I need a membership to browse?",
    "Anyone can explore the catalog and see availability. Sign in to borrow a copy, place a hold or manage your loans.",
  ],
  [
    "Do I need an activation email?",
    "The member application signs you in after successful registration. Use the same email and password when you return. If your account has been disabled, ask library staff for help.",
  ],
  [
    "Can I borrow the same title twice?",
    "Each reader can have one active loan per title. Your bookshelf shows your current loans and borrowing limit.",
  ],
  [
    "What happens when my hold is ready?",
    "The library sets a copy aside and sends a notification in the member application. Check the pickup deadline on your bookshelf. An expired hold passes the opportunity to the next reader in line.",
  ],
  [
    "Why is renewal unavailable?",
    "A loan must still be current and have renewals remaining. A waiting reader, account restriction or unpaid fines at the library’s threshold can also prevent renewal. My Bookshelf shows your standing.",
  ],
  [
    "Where can I see books I have returned?",
    "Open My Bookshelf after signing in. Your return history appears there alongside current loans and holds.",
  ],
];

function About() {
  return (
    <article className="info-page story">
      <div className="info-intro info-about">
        <div>
          <h1>
            A shared <em>reading room.</em>
          </h1>
          <p className="info-lede">
            There’s room here for the book you came to find and the one you
            discover on the way.
          </p>
        </div>
        <Photograph primary />
      </div>
      <section className="info-split">
        <h2>For the curious.</h2>
        <div>
          <p>
            Students tracing an idea, readers returning to a familiar author,
            and first-time borrowers all begin with the same open catalog.
            Browse at your own pace and see what is on the shelf.
          </p>
          <p>
            Sharing a collection means leaving room for the next reader.
            Availability, due dates and reservation queues help everyone plan
            their reading.
          </p>
          <Link className="under" to="/discover">
            Explore the collection <ArrowRight />
          </Link>
        </div>
      </section>
      <section className="info-split">
        <h2>A bookshelf of your own.</h2>
        <div>
          <p>
            Membership gives you a place to keep track of the books in your
            hands, the titles you are waiting for and the ones you have
            returned.
          </p>
          <a className="under" href={joinUrl}>
            Become a member <ArrowUpRight />
          </a>
        </div>
      </section>
    </article>
  );
}

function Services() {
  return (
    <article className="info-page services-index">
      <div className="info-intro">
        <h1>
          Library <em>services.</em>
        </h1>
      </div>
      <section className="info-split">
        <h2>Find a book.</h2>
        <div>
          <p>
            Search by title or author, browse categories and check copy
            availability. Open a book’s details to continue to the member
            catalog.
          </p>
          <Link className="under" to="/discover">
            Discover books <ArrowRight />
          </Link>
        </div>
      </section>
      <section className="info-split">
        <h2>Borrow &amp; reserve.</h2>
        <div>
          <p>
            Sign in to check out an available physical copy. When a title is
            already out, place a hold and follow your place in line. Your member
            notifications tell you when a copy is ready.
          </p>
          <Link className="under" to="/how-it-works">
            Read the borrowing guide <ArrowRight />
          </Link>
        </div>
      </section>
      <section className="info-split">
        <h2>Manage your reading.</h2>
        <div>
          <p>
            My Bookshelf brings together active loans, due dates, reservations,
            account standing and return history. Request a renewal there before
            your book is due. Open the notification bell for due-date reminders
            and hold updates.
          </p>
          <a className="under" href={loginUrl}>
            Open my bookshelf <ArrowUpRight />
          </a>
        </div>
      </section>
    </article>
  );
}

function Guide() {
  return (
    <article className="info-page loan-guide">
      <div className="info-intro">
        <h1>
          Your first <em>loan.</em>
        </h1>
        <p className="info-lede">
          A reader’s guide to borrowing, reserving and returning physical books.
        </p>
      </div>
      <ol className="info-steps">
        {steps.map(([title, description], index) => (
          <li key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            {index === 0 && (
              <Link className="under" to="/discover">
                Browse books <ArrowRight />
              </Link>
            )}
            {index === 1 && (
              <a className="under" href={joinUrl}>
                Create a reader account <ArrowUpRight />
              </a>
            )}
          </li>
        ))}
      </ol>
    </article>
  );
}

function FAQ() {
  return (
    <article className="info-page questions info-narrow">
      <div className="info-intro">
        <h1>
          Reader <em>questions.</em>
        </h1>
      </div>
      <div className="info-faq">
        {questions.map(([title, answer]) => (
          <details key={title}>
            <summary>{title}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
      <Link className="under" to="/contact">
        Contact the library <ArrowRight />
      </Link>
    </article>
  );
}

function Contact() {
  return (
    <article className="info-page contact info-narrow">
      <div className="info-intro">
        <h1>
          Library <em>help.</em>
        </h1>
        <p className="info-lede">
          For a question about a return, a fine or your account standing, speak
          with staff at the circulation desk. Bring your member details so they
          can look up your account.
        </p>
      </div>
      <div className="info-help">
        <a className="under" href={loginUrl}>
          Check my account <ArrowUpRight />
        </a>
        <Link className="under" to="/faq">
          Read common questions <ArrowRight />
        </Link>
      </div>
    </article>
  );
}

function NotFound() {
  return (
    <article className="info-page missing info-narrow">
      <div className="info-intro">
        <p className="kicker">404</p>
        <h1>
          Page not <em>found.</em>
        </h1>
        <p className="info-lede">
          Return to the reading room or look up a title in the catalog.
        </p>
      </div>
      <div className="info-help">
        <Link className="button" to="/">
          Back to home <ArrowRight />
        </Link>
        <Link className="under" to="/discover">
          Discover books <ArrowRight />
        </Link>
      </div>
    </article>
  );
}

export default function Information() {
  const path = useLocation().pathname.replace(/\/$/, "");
  switch (path) {
    case "/about":
      return <About />;
    case "/services":
      return <Services />;
    case "/how-it-works":
      return <Guide />;
    case "/faq":
      return <FAQ />;
    case "/contact":
      return <Contact />;
    default:
      return <NotFound />;
  }
}
