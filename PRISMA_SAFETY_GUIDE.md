# Prisma Safety Guide

## ⚠️ IMPORTANT: Preventing Table Deletion

### Commands that CAN DELETE tables:

1. **`prisma db push`** - ⚠️ DANGEROUS
   - Can DROP tables/columns not in schema
   - Use with caution in production
   - Always backup first!

2. **`prisma migrate reset`** - ⚠️ VERY DANGEROUS
   - **DELETES ALL DATA** and recreates database
   - Never use in production!

3. **`prisma migrate dev`** - ⚠️ Can be destructive
   - May drop tables if migrations are reset
   - Only use in development

### Safe Commands for Production:

1. **`prisma migrate deploy`** - ✅ SAFE
   - Applies pending migrations only
   - Does NOT drop existing tables
   - Use this in production

2. **`prisma generate`** - ✅ SAFE
   - Only generates Prisma Client
   - Does NOT touch database

3. **`prisma studio`** - ✅ SAFE
   - Only opens GUI viewer
   - Does NOT modify database

## Current Status

✅ **All 40 tables are present in both database and schema**

## Recommended Workflow

### For Development:
```bash
# Create a new migration
npx prisma migrate dev --name your_migration_name

# This creates a migration file and applies it safely
```

### For Production:
```bash
# Only apply pending migrations (safe)
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### NEVER use in production:
- ❌ `prisma db push`
- ❌ `prisma migrate reset`
- ❌ `prisma migrate dev` (unless you're developing)

## Why Tables Might Disappear

If tables are being deleted, you're likely:
1. Running `prisma db push` which drops tables not in schema
2. Running `prisma migrate reset` which deletes everything
3. Using `prisma migrate dev` with reset flag

## Solution

**Always use migrations instead of `db push`:**

1. Make changes to `schema.prisma`
2. Run: `npx prisma migrate dev --name descriptive_name`
3. This creates a migration file that can be reviewed
4. In production: `npx prisma migrate deploy`

This way, you have full control and can review changes before applying.

