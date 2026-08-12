-- CreateEnum
CREATE TYPE "TipoCulto" AS ENUM ('QUARTA', 'DOMINGO_MANHA', 'DOMINGO_NOITE');

-- CreateEnum
CREATE TYPE "TipoPregador" AS ENUM ('PASTOR', 'SEMINARISTA', 'VISITANTE', 'IRMAO');

-- CreateEnum
CREATE TYPE "OrigemPregador" AS ENUM ('ASSINATURA', 'YOUTUBE', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusResenha" AS ENUM ('INGERIDA', 'CLASSIFICADA', 'REVISADA');

-- CreateEnum
CREATE TYPE "PapelDoutrina" AS ENUM ('PRINCIPAL', 'SECUNDARIO');

-- CreateEnum
CREATE TYPE "StatusDevocional" AS ENUM ('GERADO', 'REVISADO');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'PASTOR', 'LIDER');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'LIDER',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "culto" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoCulto" NOT NULL,
    "youtubeVideoId" TEXT,
    "youtubeUrl" TEXT,
    "tituloLive" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "culto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pregador" (
    "id" TEXT NOT NULL,
    "nomeCanonico" TEXT NOT NULL,
    "tipo" "TipoPregador" NOT NULL DEFAULT 'VISITANTE',
    "aliases" TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pregador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resenha" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "urlBlog" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "dataPregacao" DATE NOT NULL,
    "ano" INTEGER NOT NULL,
    "conteudoBruto" TEXT NOT NULL,
    "conteudoLimpo" TEXT NOT NULL,
    "cultoId" TEXT,
    "pregadorId" TEXT,
    "pregadorBruto" TEXT,
    "pregadorOrigem" "OrigemPregador",
    "textoBase" TEXT,
    "livro" TEXT,
    "capitulo" INTEGER,
    "versiculos" TEXT,
    "status" "StatusResenha" NOT NULL DEFAULT 'INGERIDA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resenha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doutrina" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "perguntaCentral" TEXT NOT NULL,

    CONSTRAINT "doutrina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classificacao" (
    "id" TEXT NOT NULL,
    "resenhaId" TEXT NOT NULL,
    "doutrinaId" TEXT NOT NULL,
    "papel" "PapelDoutrina" NOT NULL,
    "zscore" DOUBLE PRECISION NOT NULL,
    "densidade" DOUBLE PRECISION NOT NULL,
    "subtemas" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devocional" (
    "id" TEXT NOT NULL,
    "resenhaId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "textoBiblico" TEXT,
    "corpo" TEXT NOT NULL,
    "oracao" TEXT,
    "status" "StatusDevocional" NOT NULL DEFAULT 'GERADO',
    "modelo" TEXT,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devocional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "culto_youtubeVideoId_key" ON "culto"("youtubeVideoId");

-- CreateIndex
CREATE UNIQUE INDEX "culto_data_tipo_key" ON "culto"("data", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "pregador_nomeCanonico_key" ON "pregador"("nomeCanonico");

-- CreateIndex
CREATE UNIQUE INDEX "resenha_slug_key" ON "resenha"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "resenha_urlBlog_key" ON "resenha"("urlBlog");

-- CreateIndex
CREATE INDEX "resenha_ano_idx" ON "resenha"("ano");

-- CreateIndex
CREATE INDEX "resenha_pregadorId_idx" ON "resenha"("pregadorId");

-- CreateIndex
CREATE INDEX "resenha_dataPregacao_idx" ON "resenha"("dataPregacao");

-- CreateIndex
CREATE UNIQUE INDEX "doutrina_numero_key" ON "doutrina"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "doutrina_nome_key" ON "doutrina"("nome");

-- CreateIndex
CREATE INDEX "classificacao_doutrinaId_papel_idx" ON "classificacao"("doutrinaId", "papel");

-- CreateIndex
CREATE UNIQUE INDEX "classificacao_resenhaId_doutrinaId_key" ON "classificacao"("resenhaId", "doutrinaId");

-- CreateIndex
CREATE UNIQUE INDEX "devocional_resenhaId_key" ON "devocional"("resenhaId");

-- AddForeignKey
ALTER TABLE "resenha" ADD CONSTRAINT "resenha_cultoId_fkey" FOREIGN KEY ("cultoId") REFERENCES "culto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resenha" ADD CONSTRAINT "resenha_pregadorId_fkey" FOREIGN KEY ("pregadorId") REFERENCES "pregador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classificacao" ADD CONSTRAINT "classificacao_resenhaId_fkey" FOREIGN KEY ("resenhaId") REFERENCES "resenha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classificacao" ADD CONSTRAINT "classificacao_doutrinaId_fkey" FOREIGN KEY ("doutrinaId") REFERENCES "doutrina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devocional" ADD CONSTRAINT "devocional_resenhaId_fkey" FOREIGN KEY ("resenhaId") REFERENCES "resenha"("id") ON DELETE CASCADE ON UPDATE CASCADE;
