-- Renomeia VISITANTE para CONVIDADO: é como a igreja chama os missionários e
-- pregadores de fora. RENAME VALUE preserva as linhas existentes.
ALTER TYPE "TipoPregador" RENAME VALUE 'VISITANTE' TO 'CONVIDADO';

-- O default da coluna referenciava o valor antigo.
ALTER TABLE "pregador" ALTER COLUMN "tipo" SET DEFAULT 'CONVIDADO';
