import tseslint from 'typescript-eslint';
import baseline from './gate/baseline.json' with { type: 'json' };

const { maxCyclomatic, maxFileLines, maxFunctionLines } = baseline.limits.complexity;

export default tseslint.config({
  files: ['**/*.ts'],
  languageOptions: { parser: tseslint.parser },
  rules: {
    complexity: ['error', { max: maxCyclomatic }],
    'max-lines': ['error', { max: maxFileLines, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': [
      'error',
      { max: maxFunctionLines, skipBlankLines: true, skipComments: true },
    ],
  },
});
