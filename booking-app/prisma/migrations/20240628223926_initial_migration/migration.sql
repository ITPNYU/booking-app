/*
  Warnings:

  - You are about to alter the column `capacity` on the `Room` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.

*/
-- AlterTable
ALTER TABLE `Room` MODIFY `capacity` INTEGER NOT NULL;
