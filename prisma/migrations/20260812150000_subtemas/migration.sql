
-- CreateTable
CREATE TABLE "subtema" (
    "id" TEXT NOT NULL,
    "capituloGrudem" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "doutrinaId" TEXT NOT NULL,

    CONSTRAINT "subtema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subtema_capituloGrudem_key" ON "subtema"("capituloGrudem");

-- CreateIndex
CREATE INDEX "subtema_doutrinaId_idx" ON "subtema"("doutrinaId");

-- AddForeignKey
ALTER TABLE "subtema" ADD CONSTRAINT "subtema_doutrinaId_fkey" FOREIGN KEY ("doutrinaId") REFERENCES "doutrina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

