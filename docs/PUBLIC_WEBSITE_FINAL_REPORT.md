# Athenaeum public website

## Delivery

Athenaeum now has a public reading room for visitors, students and prospective members. Readers can browse the live catalog without an account and enter the existing member application to sign in, register or borrow. All implementation and verification took place locally.

## Creative direction and structure

The homepage opens with a two-page composition pairing an oversized Newsreader headline with a photograph of library shelves. A compact collection sits below, followed by a sunlit reading table, a guide to member services and an invitation to join. The paper background, forest ink, rust italic type and thin rules carry across the site. Inter provides the interface typography. Both font families and both licensed photographs are served locally.

The visitor application has its own Vite entry point, dependencies, tests, Dockerfile and Nginx configuration. The shell owns navigation, route focus, metadata and the footer. The homepage, informational routes, shared bookshelf, catalog routes and catalog client live in separate modules. The member application owns account dialogs. Spring Boot remains responsible for all catalog and circulation data.

| Visitor route | What readers can do |
| --- | --- |
| Home | Browse the latest accessions, learn about the library and start membership |
| About | Learn who the library serves and what membership offers |
| Discover and book details | Search by title, author or ISBN, filter by subject and check title-level availability |
| Services | Find instructions for loans, reservations, renewals, history and notifications |
| How it works | Follow a physical book from catalog search through checkout, renewal and return |
| FAQ and Contact | Open common questions and find the circulation desk guidance |
| Unknown route | Return home or browse books |

The [design system](../public-website/design-system/MASTER.md) defines color, type, spacing, layout and interaction rules. Navigation underlines, book-cover hover and keyboard feedback, native FAQ disclosures and a mobile menu provide interaction. Reduced-motion preferences disable transitions. The design omits card-based service grids, animated hero text, synthetic circulation statistics, invented contacts and stock imagery presented as the actual library.

## Catalog and membership

The catalog client reads the existing book list, subject list and individual book records. It sends search and subject filters to Spring, cancels obsolete requests and retains up to 20 responses for 30 seconds. Loading, empty, retry, unknown book and missing-cover states have distinct presentations. The source API supplies neither a creation date nor server pagination. The website orders by descending accession ID and pages matching results locally. The verified database contained two titles without subjects or covers.

The member application uses root-relative assets and hash routes. Keeping its existing origin preserves established links and sessions. Sign-in and registration links select the existing dialog once session restoration completes. The backend currently signs readers in on successful registration. The public website stores no credentials. Its production proxy allows only the designated catalog reads and drops authorization and cookie headers. Membership mutations remain in the existing application.

## Review and verification

| Review | Evidence |
| --- | --- |
| Creative direction | Inspected the desktop homepage before integrating the information routes. Reviewed type scale, hero crop, cover treatment and the balance of the live collection. |
| Usability | Verified real catalog search, details and Back navigation in Chrome. Browser-only response fixtures exercised loading, failure, retry, combined filters, empty results and pagination. Tested the skip link and mobile menu with Enter, Tab and Escape. Verified member links open the existing login and registration dialogs. |
| Visual polish | Inspected mobile Home and Discover and desktop reader-guide captures. Adjusted the desktop shelf for one or two titles, placing the heading beside the books. Checked all nine route types at 320, 375, 430, 768, 1024, 1280, 1440 and 1920px. No horizontal page overflow was observed. |
| Public application | TypeScript, ESLint, production build and eight Vitest tests passed. |
| Member application and API | All 40 frontend tests, the frontend production build and all 93 backend tests passed, including authentication, JWT revocation and circulation workflow coverage. |
| Infrastructure | Local and staging Compose configuration validated. Nginx configuration, production SPA refreshes, catalog proxy responses and rejection of private API routes were verified locally. |
| Accessibility | axe reported zero violations in 18 desktop/mobile route scans using WCAG A/AA tags through 2.2. Keyboard checks covered the navigation, skip link and catalog. Screen-reader testing with readers remains a separate evaluation. |

[Desktop homepage](public-website/screenshots/home-1440.png) · [Mobile homepage](public-website/screenshots/home-375.png) · [Discover on desktop](public-website/screenshots/discover-1440.png) · [Discover on mobile](public-website/screenshots/discover-375.png) · [About, title detail and reader-guide screenshots](public-website/screenshots/)

## Performance and discoverability

Three fresh Chrome contexts per viewport loaded the production homepage through local Docker Nginx with 4× CPU slowdown, 80ms network latency and 1.6 Mbps download throughput. Median LCP was 1.332s at 375px and 1.368s at 1440px. Observed CLS was 0.018 and 0.013 respectively. These lab samples met the 2.5s LCP and 0.1 CLS targets. Field INP and other real-user measurements require traffic. The main JavaScript bundle was approximately 89 kB gzipped. Catalog and informational routes load separate chunks. The hero uses a high-priority responsive WebP, while the reading photograph loads lazily.

The shell updates document titles, descriptions and Open Graph text on navigation. Crawlers that do not execute JavaScript see the shared initial metadata. Indexing is disabled in this local configuration. The production hostname, canonical URLs and sitemap remain launch decisions.

## Run and handoff

Run `docker compose up -d --build frontend public-website` from the configured repository root, then visit `http://localhost:3200/`. The member app remains on port 3000. Set `PUBLIC_WEBSITE_PORT` to use a different local port. The verification container used 3220. See [development and deployment instructions](../public-website/README.md).

The working branch is `feature/public-library-website`. The website, evidence, documentation, Compose service and member authentication link handling are uncommitted. No push, merge or public deployment was performed. Suggested commit message is `feat: introduce the Athenaeum public library website`.

Before a public launch, supply the final HTTPS origins, confirm the indexing policy and provide verified contact details if available. As the catalog grows, server-side pagination and explicit acquisition timestamps would improve discovery. Field performance and assistive-technology feedback would complement the local checks.
