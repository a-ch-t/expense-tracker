import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import baseConfig from '../../eslint.config.mjs';

// Нативные flat-config пресеты eslint-config-next, а не устаревший
// FlatCompat().extends('next/core-web-vitals', ...): у него легаси-валидатор
// падает на циклической структуре конфига eslint-plugin-react при попытке
// сериализовать её в JSON для сообщения об ошибке.
const config = [
  ...baseConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/views/**', '@/features/**', '@/entities/**'],
              message: 'shared — нижний слой FSD и о вышестоящих слоях не знает.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/views/**', '@/features/**'],
              message: 'entities импортирует только shared.',
            },
            {
              group: ['@/entities/**'],
              message: 'Внутри слайса — относительные пути, соседний слайс трогать нельзя.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**', '@/views/**'],
              message: 'features импортирует только entities и shared.',
            },
            {
              group: ['@/features/**'],
              message: 'Внутри слайса — относительные пути, соседний слайс трогать нельзя.',
            },
            {
              group: ['@/entities/*/**'],
              message: 'Импорт только через публичный index.ts слайса: @/entities/session.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/views/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/app/**'], message: 'views не знает о слое app.' },
            {
              group: ['@/views/**'],
              message: 'Внутри слайса — относительные пути, соседний слайс трогать нельзя.',
            },
            {
              group: ['@/features/*/**', '@/entities/*/**'],
              message: 'Импорт только через публичный index.ts слайса.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/proxy.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/views/*/**', '@/features/*/**', '@/entities/*/**'],
              message: 'Импорт только через публичный index.ts слайса.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];

export default config;
