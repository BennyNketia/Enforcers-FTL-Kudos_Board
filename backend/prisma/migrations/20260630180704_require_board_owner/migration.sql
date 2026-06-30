/*
  Warnings:

  - Made the column `userId` on table `Board` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Board" ALTER COLUMN "userId" SET NOT NULL;
