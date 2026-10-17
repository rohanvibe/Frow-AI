# Supabase Database Migrations

This directory contains version-controlled database migrations for the Frow AI platform.

## Directory Structure

```
supabase/
├── migrations/
│   └── 20260101000000_initial_schema.sql  # Baseline schema and safe, repeatable RLS policies
└── README.md
```

## Migration Principles

1. **Idempotency**: All migrations must be safe to rerun.
   - Use `CREATE TABLE IF NOT EXISTS`.
   - Use `CREATE INDEX IF NOT EXISTS`.
   - For Row Level Security (RLS) policies, use `DROP POLICY IF EXISTS "<name>" ON <table>;` immediately followed by `CREATE POLICY "<name>" ON <table> ...` to prevent `policy already exists` errors while preserving strict security.
2. **Non-Destructive**: Never drop columns or tables containing user data without explicit multi-stage deprecation.
3. **Ordering**: Migrations are named following the standard Supabase timestamp convention:
   `YYYYMMDDHHMMSS_<description>.sql` (e.g., `20261017120000_add_user_settings.sql`).

## Applying Migrations

### Option 1: Supabase CLI (Recommended for Local & CI/CD)
```bash
# Apply pending migrations to your connected database
supabase db push
```

### Option 2: Supabase Dashboard SQL Editor
Copy and run the migration files in order (or run the consolidated `supabase_schema.sql` at repository root) directly in the Supabase SQL Editor.
