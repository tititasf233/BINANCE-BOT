module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['react', 'react-hooks', '@typescript-eslint'],
  extends: [
    'eslint:recommended',
  ],
  root: true,
  env: {
    browser: true,
    es6: true,
    jest: true,
    node: true,
  },
  globals: {
    global: 'writable',
    process: 'readonly',
  },
  ignorePatterns: ['.eslintrc.js', 'build/**/*'],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-unused-vars': 'off', // Turn off base rule as it can report incorrect errors
    'no-unreachable': 'off', // Disable unreachable code detection (false positives in async thunks)
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};