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
    const content = normalizeMessageContent(m?.content);
    if (role === 'system') {
      if (content) systemChunks.push(content);
      return;
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

export function parseModel(model) {
  let [pID, mID] = (model || DEFAULT_MODEL).split('/');
  if (!mID) {
    mID = pID;
    pID = 'opencode';
  }
  return { providerID: pID, modelID: mID };
}
