// Shared PrismaClient singleton.
//
// Node's --watch (dev) reloads this module on every save; a fresh PrismaClient
// per reload would leak DB connections. Stashing the instance on globalThis
// keeps a single client across reloads. Production runs once, so the global
// is harmless there.

import { PrismaClient } from '@prisma/client'

export const prisma = globalThis.__prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
