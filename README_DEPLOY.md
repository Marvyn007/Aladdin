# Job Hunt Vibe

This is a Next.js application for tracking jobs and managing applications.

## Deployment to Vercel

1.  **Environment Variables:**
    Ensure you have all the required environment variables in your Vercel project settings. Refer to `.env.production.example` for the list of required keys.
    *   `DATABASE_URL` (Postgres)
    *   `AWS_...` (S3 Storage)
    *   `CLERK_...` (Authentication)
    *   `GEMINI_...`, `OPENROUTER_...` (AI features)

2.  **Build Command:**
    The project uses the default Next.js build command:
    ```bash
    npm run build
    ```
    (or `next build`)

3.  **Install Command:**
    ```bash
    npm install
    ```

## Development

To run locally:

```bash
npm run dev
```

## Database

This project uses Prisma with PostgreSQL.
To generate the Prisma client:
```bash
npx prisma generate
```
