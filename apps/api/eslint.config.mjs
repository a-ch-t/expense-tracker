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
  {
    // auth, users и categories не знают друг о друге — общаются только через
    // общие слои contracts/* и common/*. Импортировать разрешено только их барели.
    files: ['src/auth/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/users/**', '**/categories/**'] }],
    },
  },
  {
    files: ['src/users/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/auth/**', '**/categories/**'] }],
    },
  },
  {
    files: ['src/categories/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['**/users/**', '**/auth/**'] }] },
  },
];
