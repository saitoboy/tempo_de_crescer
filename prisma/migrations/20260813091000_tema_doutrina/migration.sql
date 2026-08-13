
-- AlterTable
ALTER TABLE "tema_mes" ADD COLUMN     "doutrinaId" TEXT;

-- AddForeignKey
ALTER TABLE "tema_mes" ADD CONSTRAINT "tema_mes_doutrinaId_fkey" FOREIGN KEY ("doutrinaId") REFERENCES "doutrina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

