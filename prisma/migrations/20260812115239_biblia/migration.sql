-- CreateEnum
CREATE TYPE "Testamento" AS ENUM ('ANTIGO', 'NOVO');

-- CreateTable
CREATE TABLE "livro_biblico" (
    "id" INTEGER NOT NULL,
    "abbrev" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "testamento" "Testamento" NOT NULL,

    CONSTRAINT "livro_biblico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versiculo" (
    "id" TEXT NOT NULL,
    "livroId" INTEGER NOT NULL,
    "capitulo" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,

    CONSTRAINT "versiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "livro_biblico_abbrev_key" ON "livro_biblico"("abbrev");

-- CreateIndex
CREATE UNIQUE INDEX "livro_biblico_nome_key" ON "livro_biblico"("nome");

-- CreateIndex
CREATE INDEX "versiculo_livroId_capitulo_idx" ON "versiculo"("livroId", "capitulo");

-- CreateIndex
CREATE UNIQUE INDEX "versiculo_livroId_capitulo_numero_key" ON "versiculo"("livroId", "capitulo", "numero");

-- AddForeignKey
ALTER TABLE "versiculo" ADD CONSTRAINT "versiculo_livroId_fkey" FOREIGN KEY ("livroId") REFERENCES "livro_biblico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
