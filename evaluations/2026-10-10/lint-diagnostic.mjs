// Operator diagnostic only; no model calls, source edits or grading changes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
const workspace = resolve(process.argv[2] ?? '.');
const require = createRequire(join(workspace, 'package.json'));
const { ESLint } = require('eslint');
const plugin = require('marionette/eslint');
const { diagnostics } = JSON.parse(await readFile(new URL('./observations/lint.json', import.meta.url)));
const eslint = new ESLint({ cwd: workspace, overrideConfigFile: true, overrideConfig: [{
  files: ['**/*.mjs'], plugins: { marionette: plugin },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: { 'marionette/no-private-framework-members': 'error' },
}] });
assert.equal(plugin.rules['no-private-framework-members'].meta.diagnosticCode, 'MN0040');
for (const {id,source,expected} of diagnostics) {
  const [result] = await eslint.lintText(source, { filePath: `diagnostic-${id}.mjs` });
  console.log(JSON.stringify({ id, expected, actual: result.errorCount }));
  assert.equal(result.errorCount, expected);
}
