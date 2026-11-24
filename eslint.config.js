import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Which features each feature may import from. Keep this a one-way graph:
// generic helpers belong in src/lib, not in another feature.
const featureDependencies = {
  auth: [],
  ingredients: [],
  'meal-plans': [],
  recipes: ['ingredients', 'meal-plans'],
  grocery: ['ingredients', 'meal-plans'],
  preferences: [],
}

const features = Object.keys(featureDependencies)

// TanStack Query is only used behind our own modules: src/lib/query (the
// client), each feature's queries.ts (keys, hooks, cache updates), and the
// app shell's provider/session wiring. Everything else uses those hooks.
const QUERY_LIBRARY = {
  name: '@tanstack/react-query',
  message:
    'Use the hooks in the feature\x27s queries.ts instead of TanStack Query directly (see "Data loading" in CLAUDE.md).',
}
const QUERY_ALLOWED_FILES = [
  'src/lib/query/**',
  'src/features/*/queries.ts',
  'src/app/App.tsx',
  'src/app/useSessionCache.ts',
]

// Each block below sets the whole no-restricted-imports rule for its files
// (later blocks replace earlier ones), so every block passes both its import
// patterns and whether the query library is allowed there.
const restrictImports = (patterns, { allowQueryLibrary = false } = {}) => ({
  'no-restricted-imports': [
    'error',
    { patterns, paths: allowQueryLibrary ? [] : [QUERY_LIBRARY] },
  ],
})

const importsFrom = (dirs, message) => ({
  regex: `^(\\.\\./)+(${dirs.join('|')})(/|$)`,
  message,
})

const featureBoundaries = features.map((feature) => {
  const forbidden = features.filter(
    (other) => other !== feature && !featureDependencies[feature].includes(other),
  )
  const patterns = [
    importsFrom(['app'], 'Features must not import from src/app.'),
  ]
  if (forbidden.length > 0) {
    const allowed = featureDependencies[feature]
    const rule = allowed.length > 0
      ? `"${feature}" may only import from these features: ${allowed.join(', ')}.`
      : `"${feature}" must not import from other features.`
    patterns.push(
      importsFrom(
        forbidden,
        `${rule} Move shared helpers to src/lib, or update featureDependencies in eslint.config.js.`,
      ),
    )
  }
  return [
    {
      files: [`src/features/${feature}/**/*.{ts,tsx}`],
      rules: restrictImports(patterns),
    },
    {
      files: [`src/features/${feature}/queries.ts`],
      rules: restrictImports(patterns, { allowQueryLibrary: true }),
    },
  ]
}).flat()

const sharedCodePatterns = [
  importsFrom(['features', 'app'], 'Shared code in src/lib and src/components must not depend on features or the app shell.'),
]

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
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/__tests__/**', ...QUERY_ALLOWED_FILES],
    rules: restrictImports([]),
  },
  {
    files: ['src/lib/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: restrictImports(sharedCodePatterns),
  },
  {
    files: ['src/lib/query/**/*.{ts,tsx}'],
    rules: restrictImports(sharedCodePatterns, { allowQueryLibrary: true }),
  },
  ...featureBoundaries,
])
