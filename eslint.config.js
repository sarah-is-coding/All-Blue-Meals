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
}

const features = Object.keys(featureDependencies)

const restrictImports = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
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
  return {
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: restrictImports(patterns),
  }
})

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
    files: ['src/lib/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: restrictImports([
      importsFrom(['features', 'app'], 'Shared code in src/lib and src/components must not depend on features or the app shell.'),
    ]),
  },
  ...featureBoundaries,
])
