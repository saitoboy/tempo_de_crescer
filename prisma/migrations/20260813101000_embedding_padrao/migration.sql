-- A coluna nasceu sem padrão, então as 1.409 linhas existentes ficaram com
-- NULL em vez de array vazio, e o filtro isEmpty não casa com NULL.
ALTER TABLE "resenha" ALTER COLUMN "embedding" SET DEFAULT ARRAY[]::double precision[];
UPDATE "resenha" SET "embedding" = ARRAY[]::double precision[] WHERE "embedding" IS NULL;
ALTER TABLE "resenha" ALTER COLUMN "embedding" SET NOT NULL;
