/*
  Warnings:

  - You are about to drop the column `remarks` on the `Report` table. All the data in the column will be lost.
  - Added the required column `address` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amountReceived` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerName` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateTime` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mobileNumber` to the `Report` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceType` to the `Report` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Report" DROP COLUMN "remarks",
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "amountReceived" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "customerName" TEXT NOT NULL,
ADD COLUMN     "dateTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "mobileNumber" TEXT NOT NULL,
ADD COLUMN     "serviceType" TEXT NOT NULL;
