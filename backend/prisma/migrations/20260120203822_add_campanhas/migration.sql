-- CreateTable
CREATE TABLE "campanhas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAUSADA',
    "mensagem" TEXT NOT NULL,
    "arquivoUrl" TEXT,
    "estadosAlvo" TEXT NOT NULL,
    "dddsAlvo" TEXT NOT NULL,
    "diasSemana" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "limiteDiario" INTEGER NOT NULL DEFAULT 100,
    "totalAlvos" INTEGER NOT NULL DEFAULT 0,
    "processados" INTEGER NOT NULL DEFAULT 0,
    "ultimoEnvio" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagem_logs" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "respondida" BOOLEAN NOT NULL DEFAULT false,
    "conversaLonga" BOOLEAN NOT NULL DEFAULT false,
    "dataEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataResposta" TIMESTAMP(3),

    CONSTRAINT "mensagem_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "mensagem_logs" ADD CONSTRAINT "mensagem_logs_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
