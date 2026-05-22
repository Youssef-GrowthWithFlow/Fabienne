import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // React 19 flagged setState-in-effect: warn (legit pattern in a few hooks).
      'react-hooks/set-state-in-effect': 'warn',
      // refs-in-render: warn (rich-text-editor uses a deliberate render-time ref to attach event listeners).
      'react-hooks/refs': 'warn',
      // Allow underscore-prefixed unused vars (intentional, e.g. destructuring rest patterns).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // shadcn-generated UI primitives co-export components + variants; the
    // fast-refresh rule misfires here, so turn it off only for that tree.
    files: ['src/components/ui/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
