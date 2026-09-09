// Pure helpers for the OpenAI-to-OpenCode translation layer. No I/O, fully unit-tested.

export function normalizeMessageContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('');
  }
  if (content && typeof content.text === 'string') return content.text;
  if (content === null || content === undefined) return '';
  if (typeof content === 'number' || typeof content === 'boolean') return String(content);
  return '';
}

export function buildPromptParts(rawMessages) {
  const parts = [];
  const systemChunks = [];
  const userContents = [];
  (rawMessages || []).forEach((m) => {
    const role = (m?.role || 'user').toLowerCase();
    if (role === 'tool') {
      // Follow-up turn carrying a client's function result
      const content = normalizeMessageContent(m?.content);
      if (!content) return;
      parts.push({ type: 'text', text: `TOOL RESULT${m?.tool_call_id ? ` (${m.tool_call_id})` : ''}: ${content}` });
      return;
    }
    const content = normalizeMessageContent(m?.content);
    if (role === 'system') {
      if (content) systemChunks.push(content);
      return;
    }
    // Prior assistant turn that made tool calls (content may be null)
    if (Array.isArray(m?.tool_calls) && m.tool_calls.length) {
      const desc = m.tool_calls
        .map((t) => `${t?.function?.name || t?.name || 'unknown'}(${t?.function?.arguments || '{}'})`)
        .join(', ');
      parts.push({ type: 'text', text: `ASSISTANT CALLED: ${desc}` });
      if (!content) return;
    }
    if (!content) return;
    if (role === 'user') userContents.push(content);
    const roleLabel = role.toUpperCase();
    const nameSuffix = m?.name ? `(${m.name})` : '';
    parts.push({ type: 'text', text: `${roleLabel}${nameSuffix}: ${content}` });
  });
  return {
    parts,
    system: systemChunks.join('\n\n'),
    lastUserMsg: userContents[userContents.length - 1] || '',
  };
}

export const DEFAULT_MODEL = 'opencode/kimi-k2.5-free';

// ---- Client tool-calling shim ----
// The backend has no notion of client-defined functions, so we describe them
// in the system prompt and ask the model to emit <invoke> blocks, which we
// translate back into OpenAI tool_calls.

export function formatToolsPrompt(tools, toolChoice) {
  if (!Array.isArray(tools) || !tools.length) return '';
  const fns = tools
    .map((t) => (t && t.type === 'function' ? t.function : t))
    .filter((f) => f && f.name)
    .map((f) => `- ${f.name}${f.description ? ': ' + f.description : ''}\n  parameters: ${JSON.stringify(f.parameters || { type: 'object', properties: {} })}`);
  if (!fns.length) return '';
  let head = 'You have access to these functions. To call one, output a block like:\n<invoke>\n{"name": "fn_name", "arguments": {"key": "value"}}\n</invoke>\nOutput ONLY the invoke block(s), no other text, when you want a call. Otherwise answer normally.';
  if (toolChoice === 'required') head += ' You MUST call a function in this turn.';
  if (toolChoice === 'none') return '';
  return `${head}\n\nFunctions:\n${fns.join('\n')}`;
}

const INVOKE_RE = /<invoke>\s*([\s\S]*?)\s*<\/invoke>/g;

export function parseInvokes(text) {
  if (!text) return [];
  const calls = [];
  let m;
  let i = 0;
  while ((m = INVOKE_RE.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (obj && typeof obj.name === 'string') {
        calls.push({
          id: `call_${Date.now()}_${i++}`,
          name: obj.name,
          arguments: typeof obj.arguments === 'string' ? obj.arguments : JSON.stringify(obj.arguments ?? {}),
        });
      }
    } catch (e) { /* malformed block: ignore */ }
  }
  return calls;
}

export function stripInvokes(text) {
  if (!text) return text;
  return text.replace(INVOKE_RE, '').trim();
}

export function parseModel(model) {
  let [pID, mID] = (model || DEFAULT_MODEL).split('/');
  if (!mID) {
    mID = pID;
    pID = 'opencode';
  }
  return { providerID: pID, modelID: mID };
}
