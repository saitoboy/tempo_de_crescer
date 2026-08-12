
-- AlterTable
ALTER TABLE "devocional" DROP COLUMN "corpo",
DROP COLUMN "textoBiblico",
ADD COLUMN     "pontosAplicacao" TEXT[],
ADD COLUMN     "referencia" TEXT,
ADD COLUMN     "reflexao" TEXT NOT NULL,
ADD COLUMN     "versiculo" TEXT;

