-- CreateEnum
CREATE TYPE "Provedor" AS ENUM ('GROQ', 'NVIDIA');

-- CreateTable
CREATE TABLE "chave_de_api" (
    "id" TEXT NOT NULL,
    "provedor" "Provedor" NOT NULL,
    "rotulo" TEXT NOT NULL,
    "segredo" TEXT NOT NULL,
    "final" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "ultimoErro" TEXT,
    "ultimoErroEm" TIMESTAMP(3),
    "usadaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chave_de_api_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chave_de_api_provedor_final_rotulo_key" ON "chave_de_api"("provedor", "final", "rotulo");

