/*
  Warnings:

  - You are about to drop the column `arquivoUrl` on the `campanhas` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `instances` table. All the data in the column will be lost.
  - You are about to drop the column `pacote` on the `instances` table. All the data in the column will be lost.
  - You are about to drop the column `nome` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `pessoas_fisicas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `socios_empresas` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `clientId` to the `instances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "instances" DROP CONSTRAINT "instances_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "socios_empresas" DROP CONSTRAINT "socios_empresas_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "socios_empresas" DROP CONSTRAINT "socios_empresas_pessoaId_fkey";

-- AlterTable
ALTER TABLE "campanhas" DROP COLUMN "arquivoUrl";

-- AlterTable
ALTER TABLE "instances" DROP COLUMN "ownerId",
DROP COLUMN "pacote",
ADD COLUMN     "clientId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "nome",
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'AGENT';

-- DropTable
DROP TABLE "pessoas_fisicas";

-- DropTable
DROP TABLE "socios_empresas";

-- CreateTable
CREATE TABLE "saas_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documento" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "maxInstances" INTEGER NOT NULL DEFAULT 1,
    "planName" TEXT NOT NULL DEFAULT 'Starter',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_clients_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "saas_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instances" ADD CONSTRAINT "instances_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "saas_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
