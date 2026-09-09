import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessageContent, buildPromptParts, parseModel } from '../src/util.js';

describe('normalizeMessageContent', () => {
  it('passes strings through', () => assert.equal(normalizeMessageContent('hi'), 'hi'));
  it('joins array parts', () =>
    assert.equal(normalizeMessageContent([{ text: 'a' }, 'b', { nope: 1 }]), 'ab'));
  it('reads .text objects', () => assert.equal(normalizeMessageContent({ text: 'x' }), 'x'));
  it('stringifies numbers and booleans', () => {
    assert.equal(normalizeMessageContent(7), '7');
    assert.equal(normalizeMessageContent(false), 'false');
  });
  it('blanks nullish and unknown', () => {
    assert.equal(normalizeMessageContent(null), '');
    assert.equal(normalizeMessageContent(undefined), '');
    assert.equal(normalizeMessageContent({}), '');
  });
});

describe('buildPromptParts', () => {
  it('splits system out and labels roles', () => {
    const { parts, system, lastUserMsg } = buildPromptParts([
      { role: 'system', content: 'be nice' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
    assert.equal(system, 'be nice');
    assert.deepEqual(
      parts.map((p) => p.text),
      ['USER: hello', 'ASSISTANT: hi'],
    );
    assert.equal(lastUserMsg, 'hello');
  });
  it('skips empty non-system messages', () => {
    const { parts } = buildPromptParts([{ role: 'user', content: '' }]);
    assert.deepEqual(parts, []);
  });
});

describe('parseModel', () => {
  it('splits provider/model', () => assert.deepEqual(parseModel('a/b'), { providerID: 'a', modelID: 'b' }));
  it('defaults bare ids to opencode provider', () =>
    assert.deepEqual(parseModel('kimi'), { providerID: 'opencode', modelID: 'kimi' }));
  it('falls back to default model', () =>
    assert.deepEqual(parseModel(undefined), { providerID: 'opencode', modelID: 'kimi-k2.5-free' }));
});
