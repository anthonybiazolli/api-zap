-- AlterTable
ALTER TABLE "instances" ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "instances" ADD CONSTRAINT "instances_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
