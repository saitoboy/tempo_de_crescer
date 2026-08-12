import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Só o código-fonte. Sem isto o vitest também acha os testes compilados em
    // build/ e roda cada um duas vezes — a cópia em JavaScript falha, porque
    // importa o client do Prisma pelo caminho de build.
    include: ['src/**/*.test.ts'],
  },
});
