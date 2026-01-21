-- AlterTable
ALTER TABLE "campanhas" ADD COLUMN     "dataAgendamento" TIMESTAMP(3),
ADD COLUMN     "tipoEnvio" TEXT NOT NULL DEFAULT 'IMEDIATO';
