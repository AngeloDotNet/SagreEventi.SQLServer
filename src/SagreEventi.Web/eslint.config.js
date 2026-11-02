// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const fs = require('node:fs');
const path = require('node:path');

// Feature boundaries: a feature may import from core/ and shared/, never from another feature.
// The list of features is read from the folders under src/app/features, so a new feature is covered automatically.
const featuresDir = path.join(__dirname, 'src/app/features');
const features = fs.readdirSync(featuresDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const featureBoundaries = features.map((feature) => ({
  files: [`src/app/features/${feature}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/features/**', ...features.filter((f) => f !== feature).flatMap((f) => [`**/${f}`, `**/${f}/**`])],
            message: 'A feature cannot import from another feature: move the shared code to core/ or shared/.',
          },
        ],
      },
    ],
  },
}));

module.exports = tseslint.config(
  { ignores: ['dist/**', '.angular/**', 'coverage/**', 'node_modules/**'] },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...tseslint.configs.stylistic, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  ...featureBoundaries,
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
