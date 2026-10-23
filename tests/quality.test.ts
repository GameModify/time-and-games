import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CompilerOptions } from 'typescript';
import { projectDependencies } from '../skills/strict-typescript-architecture/scripts/dependencies.ts';
import {
  assertCompilerOptions,
  assertLintConfiguration,
} from '../skills/strict-typescript-architecture/scripts/configuration.ts';

const deps = projectDependencies(process.cwd());
const options: CompilerOptions = {
  strict: true,
  noUncheckedIndexedAccess: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  noImplicitReturns: true,
  noFallthroughCasesInSwitch: true,
};
const rules = {
  'max-lines-per-function': [2, { max: 20, IIFEs: true }],
  'sonarjs/cognitive-complexity': [2, 20],
  '@typescript-eslint/no-explicit-any': [2],
  '@typescript-eslint/no-unsafe-assignment': [2],
  '@typescript-eslint/no-unsafe-argument': [2],
  '@typescript-eslint/no-unsafe-return': [2],
  '@typescript-eslint/no-unsafe-call': [2],
  '@typescript-eslint/no-unsafe-member-access': [2],
  '@typescript-eslint/ban-ts-comment': [2],
  '@typescript-eslint/no-floating-promises': [2],
  '@typescript-eslint/consistent-type-imports': [2],
};
const config = { linterOptions: { noInlineConfig: true }, rules };
const invalidOptions = [
  {},
  { ...options, noImplicitAny: false },
  { ...options, strictNullChecks: false },
];
const invalidRuleOverrides = [
  { 'max-lines-per-function': [2, { max: 21, IIFEs: true }] },
  { 'max-lines-per-function': [2, { max: 20, IIFEs: false }] },
  { 'max-lines-per-function': [2, { max: 20, IIFEs: true, skipBlankLines: true }] },
  { 'max-lines-per-function': [2, { max: 20, IIFEs: true, skipComments: true }] },
  { 'sonarjs/cognitive-complexity': [2, 21] },
  { 'sonarjs/cognitive-complexity': [1, 20] },
  { '@typescript-eslint/no-unsafe-assignment': [0] },
  { '@typescript-eslint/no-explicit-any': [1] },
];

void test('quality audit rejects weakened compiler flags', () => {
  assert.doesNotThrow(() => {
    assertCompilerOptions(options);
  });
  for (const key of Object.keys(options)) {
    assert.throws(() => {
      assertCompilerOptions({ ...options, [key]: false });
    });
  }
  for (const invalid of invalidOptions) {
    assert.throws(() => {
      assertCompilerOptions(invalid);
    });
  }
});
void test('quality audit rejects disabled type safety and relaxed function limits', () => {
  assert.doesNotThrow(() => {
    assertLintConfiguration(config, deps);
  });
  for (const override of invalidRuleOverrides) {
    assert.throws(() => {
      assertLintConfiguration({ ...config, rules: { ...rules, ...override } }, deps);
    });
  }
  assert.throws(() => {
    assertLintConfiguration(undefined, deps);
  });
  assert.throws(() => {
    assertLintConfiguration({ ...config, linterOptions: { noInlineConfig: false } }, deps);
  });
});
