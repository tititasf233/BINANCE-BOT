module.exports = {
  overrides: [
    {
      files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn',
        'no-console': 'warn',
        'no-case-declarations': 'warn'
      }
    },
    {
      files: ['src/scripts/**/*.ts'],
      rules: {
        'no-console': 'off'
      }
    },
    {
      files: ['src/monitoring/**/*.ts'],
      rules: {
        'no-console': 'warn'
      }
    }
  ]
};