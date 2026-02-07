# Database Schema Update Workflow

This workflow documents how to update the database schema using Prisma, specifically when handling local vs remote discrepancies.

## Prerequisites
- Node.js installed
- `.env` or `.env.local` file with `DATABASE_URL` and `DIRECT_URL`.

## Steps to Update Schema

1.  **Sync Local Schema with Production (Safety Step)**
    Before making changes, ensure your local `schema.prisma` matches the production database to avoid accidental data loss (e.g., dropping columns that exist in DB but not locally).
    ```bash
    npx -y dotenv-cli -e .env.local -- npx prisma db pull
    ```

2.  **Make Changes**
    Edit `prisma/schema.prisma` to add/modify models or fields.
    Example:
    ```prisma
    model Resume {
      ...
      archivedAt DateTime? @map("archived_at") @db.Timestamptz(6)
    }
    ```

3.  **Apply Changes to Database**
    Push the changes to the database. This will also generate the Prisma Client.
    ```bash
    npx -y dotenv-cli -e .env.local -- npx prisma db push
    ```

4.  **Verify**
    Check if the command completed successfully. If there are warnings about data loss, **STOP** and investigate (repeat step 1 if needed).

## Notes
- We use `dotenv-cli` to explicitly load `.env.local` because Prisma CLI does not load it automatically.
- Always check the `Output snapshot` or terminal output for warnings before confirming `y` (if prompted).
