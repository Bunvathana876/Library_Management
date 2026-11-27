# Athenaeum public website

Readers can browse the library and its catalog before opening their member account. The public React/TypeScript application uses Vite and React Router. The existing Spring Boot service, PostgreSQL database and member application continue to own catalog data, accounts and circulation.

## Run with Docker

From the repository root, configure the local environment as described in the root README. Start the existing stack and the public site with:

```sh
docker compose up -d --build frontend public-website
docker compose ps
```

Open the [public website](http://localhost:3200/) or the [member application](http://localhost:3000/). For a different loopback port, set `PUBLIC_WEBSITE_PORT`. The public container also starts independently with `docker compose up -d --build public-website`. Static pages work while the API is offline, and the catalog offers a retry action. These commands use the existing named database volume.

## Develop locally

Start the API and member app with `docker compose up -d --build frontend`, then run the following inside `public-website/`:

```sh
npm ci
npm run dev
```

Use the URL Vite prints. `VITE_API_TARGET` changes the development proxy target from `http://127.0.0.1:8080`. `VITE_MEMBER_APP_URL` changes the destination of account and member catalog links. Set it before the Vite build, or pass it through Compose. Use the member app’s public HTTPS origin behind a TLS edge. The two frontends have separate origins because the existing application serves its assets and API from the origin root and uses hash navigation.

## Public catalog contract

The browser requests the following same-origin resources. The production Nginx server forwards reads to the internal Compose service and preserves backend status codes.

| Resource | Response |
| --- | --- |
| `GET /api/books?search=…&category=…` | Array of catalog records matching the backend filters |
| `GET /api/books/categories` | Array of category names |
| `GET /api/books/{id}` | One catalog record, or 404 |

The backend provides a title-level availability flag, author text and optional cover URL. The collection API returns an array without server pagination or an accession timestamp. Newer accession identifiers determine shelf order. Large collections will require a paginated backend API. Spring Security still controls access to the member application’s API. The public Nginx proxy permits only the listed read routes and strips credentials.

## Membership

Sign-in and join links open the existing member application with `?auth=login#bookshelf` or `?auth=register#bookshelf`. The application consumes the request after checking its existing session. Registration and sign-in use the existing dialogs and Spring Security flow. Registration currently creates a member login and issues a session immediately, subject to the backend's validation. Borrowing eligibility is checked separately by the backend.

## Build and verify

```sh
npm run typecheck
npm test
npm run lint
npm run build
```

Serve the generated `dist/` with SPA history fallback for visitor page URLs. Keep `/api/` outside the SPA fallback. The local Docker configuration sends a noindex header. A production launch needs the intended hostname, indexing policy, HTTPS origin, member destination and explicit deployment approval.

See the [design system](design-system/MASTER.md), [image credits](public/images/CREDITS.md) and [implementation report](../docs/PUBLIC_WEBSITE_FINAL_REPORT.md).
