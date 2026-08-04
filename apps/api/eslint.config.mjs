import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Декораторы NestJS требуют пустых конструкторов и классов-обёрток
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
