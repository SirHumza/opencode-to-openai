import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessageContent, buildPromptParts, parseModel, formatToolsPrompt, parseInvokes, stripInvokes } from '../src/util.js';

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

describe('tool shim', () => {
  const tools = [{ type: 'function', function: { name: 'get_weather', description: 'Get weather', parameters: { type: 'object', properties: { city: { type: 'string' } } } } }];
  it('formats a tools prompt', () => {
    const p = formatToolsPrompt(tools);
    assert.match(p, /get_weather/);
    assert.match(p, /<invoke>/);
  });
  it('returns empty for none choice or no tools', () => {
    assert.equal(formatToolsPrompt(tools, 'none'), '');
    assert.equal(formatToolsPrompt([]), '');
  });
  it('parses invoke blocks', () => {
    const calls = parseInvokes('thinking\n<invoke>\n{"name": "get_weather", "arguments": {"city": "Oslo"}}\n</invoke>');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'get_weather');
    assert.deepEqual(JSON.parse(calls[0].arguments), { city: 'Oslo' });
    assert.match(calls[0].id, /^call_/);
  });
  it('ignores malformed blocks', () => assert.deepEqual(parseInvokes('<invoke>nope</invoke>'), []));
  it('strips invoke blocks', () => assert.equal(stripInvokes('a<invoke>\n{}\n</invoke> b').trim(), 'a b'));
});

describe('parseModel', () => {
  it('splits provider/model', () => assert.deepEqual(parseModel('a/b'), { providerID: 'a', modelID: 'b' }));
  it('defaults bare ids to opencode provider', () =>
    assert.deepEqual(parseModel('kimi'), { providerID: 'opencode', modelID: 'kimi' }));
  it('falls back to default model', () =>
    assert.deepEqual(parseModel(undefined), { providerID: 'opencode', modelID: 'kimi-k2.5-free' }));
});
