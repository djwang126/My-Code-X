import test from 'node:test';
import assert from 'node:assert/strict';

import { createAutoThreadName } from './thread-name.js';

test('createAutoThreadName truncates Chinese text to fifteen CJK characters with an ellipsis', () => {
  assert.equal(
    createAutoThreadName('这是一个很长很长很长很长的标题测试，用来验证自动截断能力'),
    '这是一个很长很长很长很长的标题…',
  );
});

test('createAutoThreadName keeps text that exactly matches the width limit without an ellipsis', () => {
  assert.equal(createAutoThreadName('这是刚好十五个中文字的标题呀'), '这是刚好十五个中文字的标题呀');
});

test('createAutoThreadName collapses whitespace before trimming', () => {
  assert.equal(createAutoThreadName('   first line\n\nsecond line   '), 'first line second line');
});

test('createAutoThreadName returns an empty string for blank input', () => {
  assert.equal(createAutoThreadName('   \n\t  '), '');
});

test('createAutoThreadName treats emoji as full-width when enforcing the limit', () => {
  assert.equal(createAutoThreadName('1234567890123456789012345678😀ab'), '1234567890123456789012345678😀…');
  assert.equal(createAutoThreadName('12345678901234567890123456789😀'), '12345678901234567890123456789…');
});
