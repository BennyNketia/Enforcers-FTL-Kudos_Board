// ============================================================================
// One-off backfill: create (or update) the admin user and assign all
// userId-less boards to it. Run AFTER migration A (which made Board.userId
// nullable) and BEFORE migration B (which makes it NOT NULL).
//
//   node scripts/assign-admin.js
//
// Reads ADMIN_USERNAME / ADMIN_PASSWORD from backend/.env. Idempotent — running
// twice does not duplicate the admin or re-stamp boards that already have an
// owner. Uses the same bcrypt hashing as the signup endpoint so the admin can
// sign in through the normal /api/auth/login flow.
// ============================================================================

import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { hashPassword } from '../src/lib/auth.js'

async function main() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in backend/.env')
  }

  // Upsert by username so re-running keeps the same id (and existing board
  // assignments). Only set the password on create — we don't want to silently
  // overwrite a rotated password every run.
  const existing = await prisma.user.findUnique({ where: { username } })
  const admin = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { isAdmin: true },
      })
    : await prisma.user.create({
        data: {
          username,
          passwordHash: await hashPassword(password),
          isAdmin: true,
        },
      })

  console.log(`admin user ${admin.username} (${admin.id}) — isAdmin=${admin.isAdmin}`)

  // Use raw SQL: after migration B regenerates the client locally, Prisma's
  // typed updateMany no longer accepts `userId: null` as a filter — but the
  // prod column is still nullable until migration B replays, so we *need* to
  // match nulls. $executeRaw bypasses the client-side check.
  const count = await prisma.$executeRaw`
    UPDATE "Board" SET "userId" = ${admin.id} WHERE "userId" IS NULL
  `
  console.log(`assigned ${count} legacy board(s) to admin`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
