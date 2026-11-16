import { defineConfig } from 'vitest/config';

// Testes do pacote isolados da aplicação Neurix.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
