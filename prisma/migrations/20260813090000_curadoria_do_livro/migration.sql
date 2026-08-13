
-- CreateTable
CREATE TABLE "tema_mes" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "tema" TEXT NOT NULL,
    "versiculo" TEXT,
    "referencia" TEXT,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tema_mes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagina_livro" (
    "id" TEXT NOT NULL,
    "temaMesId" TEXT NOT NULL,
    "devocionalId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagina_livro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tema_mes_ano_idx" ON "tema_mes"("ano");

-- CreateIndex
CREATE UNIQUE INDEX "tema_mes_ano_mes_key" ON "tema_mes"("ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "pagina_livro_temaMesId_devocionalId_key" ON "pagina_livro"("temaMesId", "devocionalId");

-- CreateIndex
CREATE UNIQUE INDEX "pagina_livro_temaMesId_ordem_key" ON "pagina_livro"("temaMesId", "ordem");

-- AddForeignKey
ALTER TABLE "pagina_livro" ADD CONSTRAINT "pagina_livro_temaMesId_fkey" FOREIGN KEY ("temaMesId") REFERENCES "tema_mes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagina_livro" ADD CONSTRAINT "pagina_livro_devocionalId_fkey" FOREIGN KEY ("devocionalId") REFERENCES "devocional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

