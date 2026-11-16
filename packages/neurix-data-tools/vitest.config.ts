import { defineConfig } from 'vitest/config';

// Testes do pacote isolados da aplicação Neurix.
// `css.postcss: {}` impede que o Vite procure o postcss.config.js da raiz
// (que exige tailwindcss, ausente quando só o pacote é instalado, como no CI).
export default defineConfig({
  css: { postcss: {} },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
