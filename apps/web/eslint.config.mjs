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
    ignores: ['.next/**', 'next-env.d.ts'],
  },
];

export default config;
