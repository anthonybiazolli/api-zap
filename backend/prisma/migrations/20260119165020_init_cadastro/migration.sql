-- CreateTable
CREATE TABLE "pessoas_fisicas" (
    "id" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cpf" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "endereco" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoas_fisicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "cnae" TEXT,
    "dataAbertura" TIMESTAMP(3),
    "statusRF" TEXT,
    "dataAtualizacaoAPI" TIMESTAMP(3),
    "endereco" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socios_empresas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "cargo" TEXT,

    CONSTRAINT "socios_empresas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_fisicas_cpf_key" ON "pessoas_fisicas"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "socios_empresas_empresaId_pessoaId_key" ON "socios_empresas"("empresaId", "pessoaId");

-- AddForeignKey
ALTER TABLE "socios_empresas" ADD CONSTRAINT "socios_empresas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socios_empresas" ADD CONSTRAINT "socios_empresas_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas_fisicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
