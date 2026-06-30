/*
  Warnings:

  - Made the column `userId` on table `Card` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Card" ALTER COLUMN "userId" SET NOT NULL;
