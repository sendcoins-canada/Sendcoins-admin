## SendCoins Admin Backend

Basic backend service for the SendCoins admin panel, built with **NestJS**, **TypeScript**, **Prisma**, and **PostgreSQL**.

### Tech stack

- **Framework**: NestJS
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL (AWS RDS)

### Getting started

1. **Install dependencies**

```bash
npm install
```

2. **Environment variables**

- Copy your environment file (not committed) and make sure these values exist:
  - `DATABASE_URL` – PostgreSQL connection string for the existing SendCoins DB
  - `PORT` (optional) – API port, defaults to `4005`

3. **Prisma client**

```bash
npx prisma generate
```

4. **Run the API**

```bash
npm run start:dev
```

The API will be available on `http://localhost:4005` and Swagger docs at `http://localhost:4005/api/docs`.

### Notes

- Prisma is configured to **use the existing database schema** (via `prisma db pull`), it does **not** create or reset tables by default.
- This README is intentionally basic; see `SECURITY_CHECKLIST.md` for hardening guidelines.
