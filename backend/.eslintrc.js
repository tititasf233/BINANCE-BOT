module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  globals: {
    NodeJS: 'readonly',
  },
  ignorePatterns: ['.eslintrc.js', 'dist/**/*'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-console': 'warn',
    'no-unused-vars': 'off', // Turn off base rule as it can report incorrect errors
  },
};