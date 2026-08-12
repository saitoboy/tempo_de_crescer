
-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('DIA', 'NOITE');

-- CreateEnum
CREATE TYPE "NaturezaEvento" AS ENUM ('CULTO', 'CELEBRACAO', 'EBD', 'ESTUDO', 'VIGILIA', 'CONFERENCIA');

-- CreateEnum
CREATE TYPE "OrigemData" AS ENUM ('TEXTO', 'YOUTUBE', 'MANUAL');

-- DropIndex
DROP INDEX "culto_data_tipo_key";

-- AlterTable
ALTER TABLE "culto" DROP COLUMN "tipo",
ADD COLUMN     "natureza" "NaturezaEvento" NOT NULL DEFAULT 'CULTO',
ADD COLUMN     "turno" "Turno";

-- AlterTable
ALTER TABLE "resenha" ADD COLUMN     "origemData" "OrigemData",
ADD COLUMN     "publicadoEm" DATE NOT NULL,
ALTER COLUMN "dataPregacao" DROP NOT NULL;

-- DropEnum
DROP TYPE "TipoCulto";

-- CreateIndex
CREATE UNIQUE INDEX "culto_data_turno_natureza_key" ON "culto"("data", "turno", "natureza");

