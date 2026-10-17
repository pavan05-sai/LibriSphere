# LibriSphere

Library catalog and circulation application with a Spring Boot API and static browser frontend.

## Features

- Responsive catalog dashboard with inventory statistics.
- Search and filter books, and add, edit, or remove titles.
- Issue books, track due dates, and record returns.
- Light theme only.
- An empty database is initialized with ten sample book titles, shuffled with randomized copy counts. No sample loan history is created.

## Local Development

Requirements: Java 17.

From the repository root on Windows:

```cmd
cd library-management-system
mvnw.cmd spring-boot:run
```

The local profile uses a file-backed H2 database under `library-management-system/data`. The server honors `PORT` and defaults to `8081`. Existing database files are not reset or rewritten by the initializer.

## Deployment

The repository includes a Render Blueprint for the Spring Boot API and PostgreSQL database, plus a Vercel build for the static frontend.

### Render API

1. Create a new Blueprint in Render from this repository and apply `render.yaml`.
2. Render builds the API image from `library-management-system/Dockerfile` and provisions PostgreSQL.
3. Wait for the API health check at `/actuator/health` to pass. Note the service origin, for example `https://your-api-service.onrender.com`.

The blueprint allows Vercel preview/production origins using `https://*.vercel.app`. Once the frontend URL is known, restrict `APP_CORS_ALLOWED_ORIGIN_PATTERNS` in Render to that exact origin (and any required preview origin).

### Vercel frontend

1. Import this repository into Vercel with the repository root as the project root.
2. Set the `BACKEND_URL` environment variable to the Render API origin only, with no `/api` suffix.
3. Deploy. The build creates the static frontend in `dist` and generates its API configuration from `BACKEND_URL`.

The Vercel build fails when `BACKEND_URL` is missing or is not HTTPS, to prevent a deployed frontend from silently targeting the wrong host.

The included Render plan uses free resources for evaluation. Select an appropriate paid plan for production workloads and database retention requirements.

## API

- `GET /api/books?search=...&category=...` — Search and list books
- `GET /api/books/{id}` — Fetch book details
- `POST /api/books` — Add a book
- `PUT /api/books/{id}` — Update a book
- `DELETE /api/books/{id}` — Delete a book
- `GET /api/categories` — List categories
- `GET /api/loans` — List circulation history
- `POST /api/loans` — Issue a book
- `PUT /api/loans/{id}/return` — Record a return
- `GET /api/stats` — Catalog statistics
