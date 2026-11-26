/** Architecture rules. Layers: errors < money < pricing < invoice < index. */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No import cycles.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'money-is-a-leaf',
      severity: 'error',
      comment: 'src/money.ts and src/errors.ts depend on nothing else in src.',
      from: { path: '^src/(money|errors)\\.ts$' },
      to: { path: '^src/', pathNot: '^src/(money|errors)\\.ts$' },
    },
    {
      name: 'pricing-does-not-reach-up',
      severity: 'error',
      comment: 'src/pricing may use money and errors, never invoice or the public index.',
      from: { path: '^src/pricing/' },
      to: { path: '^src/(invoice|index)\\.ts$' },
    },
    {
      name: 'invoice-does-not-import-index',
      severity: 'error',
      comment: 'The public index re-exports. Nothing imports it from inside src.',
      from: { path: '^src/' },
      to: { path: '^src/index\\.ts$' },
    },
    {
      name: 'src-does-not-import-tests-or-scripts',
      severity: 'error',
      comment: 'Shipped code never depends on tests or gate scripts.',
      from: { path: '^src/' },
      to: { path: '^(tests|scripts)/' },
    },
    {
      name: 'src-uses-no-dev-dependencies',
      severity: 'error',
      comment: 'Shipped code uses no devDependency.',
      from: { path: '^src/' },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.json'],
    },
  },
};
