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
    // auth и users не должны знать друг о друге — общаются только через contracts
    files: ['src/auth/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['**/users/**'] }] },
  },
  {
    files: ['src/users/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['**/auth/**'] }] },
  },
];
