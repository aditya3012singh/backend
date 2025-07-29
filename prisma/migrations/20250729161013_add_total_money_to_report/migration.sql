/*
  Warnings:

  - You are about to drop the column `bookingId` on the `Report` table. All the data in the column will be lost.
  - Added the required column `technicianId` to the `Report` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_bookingId_fkey";

-- DropIndex
DROP INDEX "Report_bookingId_key";

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "bookingId",
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "technicianId" TEXT NOT NULL,
ADD COLUMN     "totalMoney" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
