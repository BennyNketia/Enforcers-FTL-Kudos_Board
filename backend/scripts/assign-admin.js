// ============================================================================
// One-off backfill. Two jobs:
//   1. Create (or update) the admin user; assign any userId-less Board rows
//      to it. Used after the first board-owner migration.
//   2. Stamp every userId-less Card with its parent board's userId. Used
//      after the card-owner migration adds a nullable Card.userId.
//
// Run AFTER each nullable-add migration and BEFORE the corresponding NOT NULL
// tightening migration.
//
//   node scripts/assign-admin.js
//
// Reads ADMIN_USERNAME / ADMIN_PASSWORD from backend/.env. Idempotent — re-
// running won't duplicate the admin, won't re-stamp boards or cards that
// already have an owner, and won't overwrite a rotated password.
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

  // Use raw SQL: after the NOT NULL tightening migration regenerates the
  // client, Prisma's typed updateMany no longer accepts `userId: null` as a
  // filter — but the prod column is still nullable until that migration
  // replays, so we *need* to match nulls. $executeRaw bypasses the check.
  const boardsCount = await prisma.$executeRaw`
    UPDATE "Board" SET "userId" = ${admin.id} WHERE "userId" IS NULL
  `
  console.log(`assigned ${boardsCount} legacy board(s) to admin`)

  // Inherit the parent board's owner for each unowned card. After
  // `add_board_owner` ran, every board has a userId; this is the natural
  // continuation for cards.
  const cardsCount = await prisma.$executeRaw`
    UPDATE "Card"
       SET "userId" = "Board"."userId"
      FROM "Board"
     WHERE "Card"."boardId" = "Board"."id"
       AND "Card"."userId" IS NULL
  `
  console.log(`stamped ${cardsCount} legacy card(s) with their board's owner`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
