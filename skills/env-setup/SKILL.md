---
name: env-setup
description: "Set up environment variables — .env.example, .gitignore entry, type-safe access module, startup validation. Use when configuring env vars, setting up secrets, or /env-setup."
user-invocable: true
argument-hint: "[project-type]"
---

# Env Setup

Set up environment variables properly and safely.

## Steps
1. **Create `.env.example`** with all required vars (placeholder values, no secrets)
2. **Add `.env` to `.gitignore`** if not already there
3. **Generate type-safe env module** (`src/lib/env.ts`):
   ```typescript
   import { z } from 'zod';
   const envSchema = z.object({
     DATABASE_URL: z.string().url(),
     API_KEY: z.string().min(1),
   });
   export const env = envSchema.parse(process.env);
   ```
4. **Add startup validation** — import env module early so app fails fast on missing vars
5. **Document** which vars are required vs optional
