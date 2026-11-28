# Athenaeum creative refinement

The public reading room now uses a smaller editorial type hierarchy, a photographic frontispiece and a catalog designed around physical books. The starting worktree was clean on `feature/public-library-website`. The refinement is local and uncommitted on `feature/public-website-creative-refinement`. Open the [local Docker preview](http://localhost:3220/).

## Art direction and typography

The baseline homepage repeated the same split composition, large serif heading, uppercase label and secondary link. A mobile headline starting at 80px pushed the shelf down. The header linked to Discover twice, the footer repeated most of the header, and two placeholder covers occupied a broad tinted band. On interior pages, similar oversized introductions gave a short help page and a six-step guide much the same emphasis.

Chrome proofs compared all four requested pairs using the same headline, paragraph and link. Fraunces gave “books” a heavier, rounder silhouette. Bodoni Moda used considerably more width, and the Newsreader proof kept much of the original site's typographic character. Instrument Serif fit the sample on one line with room to spare. Its italic has enough character to distinguish a single word. Manrope gives the catalog labels a clear, open shape at 14px. [Browser type proofs](public-website/refinement/font-comparison.png)

Desktop hero type tops out at 88px, tablet at 56px and phone at 46px. Most section heads use 34–46px, service heads 26–32px and catalog titles 19px. Body text stays at 15–16px, with 14px actions and 13px captions. Dark forest ink sits on a lighter warm paper ground. Rust is confined mainly to italic emphasis, cover art and navigation through a sequence. A pale sage invitation replaces the large dark closing panel. [Design system](../public-website/design-system/MASTER.md)

## Homepage and public routes

| Area | Change |
| --- | --- |
| Navigation | Shortened the masthead, removed the duplicate Explore button and kept sign-in distinct. The footer now carries the borrowing guide, contact and member application. |
| Home | The reading-table photograph spans a wide field. A paper text panel overlaps its left edge on desktop and its bottom edge on mobile. The shorter introduction gives the shelf more space near the top. A compact service index combines the former reading and services sections. Membership copy explains what a reader can do after joining. |
| Featured collection | The desktop shelf pairs each book with its title, author and availability. Mobile uses two compact columns. Missing-cover jackets derive their lettering from real catalog records and their ink color and line motif from the record ID. Cover type scales with the jacket width. |
| Discover and details | Desktop search sits to the left of the results. Small screens put it above the books. Search, subject filters, pagination and retry retain their existing behavior. A bounded cover anchors the detail page beside the title, author, available metadata and member catalog action. |
| About and Services | About opens with an architectural shelf crop and a short introduction. Services uses numbered entries with an action beside each explanation. |
| How It Works and FAQ | A compact six-step borrowing guide and native question disclosures each have a dedicated reading column. |
| Contact and 404 | Brief paper panels identify the circulation desk or provide recovery links. Both fit their limited amount of content. |

The photographs are illustrative. The existing responsive WebP renditions were reused, with the open books featured on Home and the aisle used on About. Photographer names, source pages and the Pexels license are recorded in the [image credits](../public-website/public/images/CREDITS.md).

## Three browser reviews

1. **Art direction.** Compared the old routes and the four font proofs, then reviewed the new photographic crop, headline wraps, cover silhouettes and color balance at desktop and mobile widths.
2. **Usability.** Tested the mobile menu, skip link, keyboard search, detail navigation, browser Back, FAQ disclosure and both member account links. Moved desktop search beside the live collection after reviewing the sparse two-result page.
3. **Polish.** Reviewed the homepage at all eight widths and inspected the detail page and Discover cover lettering. Changed the cover font sizing after seeing a word split across lines. A throttled mobile run exposed a shift during the shelf fetch and font swap. Preloading upright Instrument Serif and reserving shelf space addressed it.

Book jackets hinge slightly on hover, arrows move three pixels, and the mobile menu enters over 180ms. The reduced-motion check confirmed the hovered cover has no transform. Keyboard focus and native control feedback remain available.

## Screenshots

| View | Before | After |
| --- | --- | --- |
| Homepage, desktop | [Before](public-website/refinement/before/home-1440.webp) | [After](public-website/refinement/after/home-1440.webp) |
| Homepage, phone | [Before](public-website/refinement/before/home-375.webp) | [After](public-website/refinement/after/home-375.webp) |
| Discover | [Before](public-website/refinement/before/discover-1440.webp) | [After](public-website/refinement/after/discover-1440.webp) |
| Book detail | [Before](public-website/refinement/before/discover-2-1440.webp) | [After](public-website/refinement/after/discover-2-1440.webp) |
| Borrowing guide | [Before](public-website/refinement/before/how-it-works-375.webp) | [After](public-website/refinement/after/how-it-works-375.webp) |

The [before](public-website/refinement/before/) and [after](public-website/refinement/after/) folders include all nine route types at 375px and 1440px.

## Verification and performance

- TypeScript, ESLint, all eight public website unit tests and the production build passed.
- Chrome checked nine route types at 320, 375, 430, 768, 1024, 1280, 1440 and 1920px. None of the 72 combinations produced horizontal page overflow.
- axe reported zero violations across 18 desktop and mobile scans using WCAG A/AA tags through 2.2. Keyboard tests covered focus transfer, menu open/close, Escape, search and details. These checks do not establish full assistive-technology coverage.
- Live queries returned both database titles and their details. Browser-only fixtures exercised loading, outage, retry, combined filters, clearing, empty results and pagination. A ten-title fixture displayed ten Discover results and four homepage selections.
- Sign-in and membership links opened their respective existing member dialogs. The public proxy returned 404 for the private loans route. Compose configuration validated and the public Nginx image built and served SPA URLs. Source changes were confined to the public application and documentation.

Three fresh Chrome contexts per viewport loaded the Docker homepage with a 4× CPU slowdown, 80ms latency and a 1.6 Mbps download limit. The comparison uses the same procedure as the [previous implementation report](PUBLIC_WEBSITE_FINAL_REPORT.md).

| Measurement | Previous | Refined |
| --- | ---: | ---: |
| Median mobile LCP | 1.332s | 1.196s |
| Median desktop LCP | 1.368s | 1.564s |
| Mobile CLS | 0.018 | 0.0015 |
| Desktop CLS | 0.013 | 0.0018 |
| Three local font files | 171 kB | 68 kB |
| Entry JavaScript, gzip | 88.77 kB | 88.55 kB |

Desktop LCP increased by about 0.20s in these local samples. Both viewport medians stayed below 2.5s. Production traffic is needed to measure field INP and real-world loading performance.

## Handoff

The live collection currently contains two titles with no cover URLs or subjects. The API has no book synopsis field, and it still returns matching records as an array for local pagination. The website displays the available bibliographic information. The image assets, fonts and browser checks are independent of external font or photography services.

Suggested commit message is `feat: refine Athenaeum typography and editorial book discovery`.
