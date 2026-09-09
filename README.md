# opencode-to-openai

OpenAI-compatible API gateway for OpenCode CLI. Stable v1.1.0 port of opencode-to-api.

- Concurrent-safe, no global lock
- 30s first-token timeout, 60s idle, 1s polling
- Always cleans up sessions
- Single-flight backend startup with proper port parsing
- `/v1/models` returns 502 when backend down instead of fake model

```bash
npm install
cp config.json.example config.json
node index.js
```
Gateway at `http://127.0.0.1:8083`
