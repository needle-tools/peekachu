# peekachu

Password manager for AIs. Store secrets in your OS keychain, inject them into child processes, and scrub output so AI coding assistants never see the actual values.

AI agents like Claude Code, Cursor, and Devin can see everything in your terminal. Peekachu keeps secrets out of their context by replacing real values with `[REDACTED:NAME]` in all process output.

```
npx peekachu run --env DB_PASSWORD -- node server.js
```

```
   AI Agent                peekachu               Child Process
  (sees nothing)                                  (has secrets)
       |                       |                       |
       |--- run --env ... ---->|                       |
       |                       |-- fetch from keychain |
       |                       |-- inject env vars --->|
       |                       |                       |--- runs
       |                       |<-- stdout/stderr -----|
       |<-- scrubbed output ---|                       |
       |                       |                       |
[REDACTED:NAME]          replaces secrets         real values
```

## Quick Start

```bash
# Store a secret (opens native OS dialog)
npx peekachu set DB_PASSWORD

# Run a command with the secret injected and output scrubbed
npx peekachu run --env DB_PASSWORD -- node server.js

# The AI sees: connection string: postgres://user:[REDACTED:DB_PASSWORD]@localhost/db
# The child process sees the real value in its environment
```

## Commands

### `peekachu set <name>`

Store a secret in the OS keychain. On macOS, opens a native dialog with a hidden input field. Falls back to reading from `/dev/tty` (not stdin, which the AI may control).

```bash
peekachu set API_KEY
peekachu set DB_PASSWORD
```

### `peekachu run --env <name> -- <command>`

Run a command with secrets injected as environment variables. All stdout and stderr output is scrubbed — any occurrence of a secret value is replaced with `[REDACTED:NAME]`.

```bash
# Single secret
peekachu run --env DB_PASSWORD -- node server.js

# Multiple secrets
peekachu run --env DB_PASSWORD --env API_KEY -- node server.js
```

### `peekachu run --ci --env <name> -- <command>`

CI mode. Instead of reading from the OS keychain, reads secrets from existing environment variables (as set by your CI runner). Output is still scrubbed.

```bash
# In CI/CD pipeline where secrets are already in env
peekachu run --ci --env DB_PASSWORD --env API_KEY -- npm test
```

### `peekachu list`

List the names of stored secrets. Never shows values.

```bash
peekachu list
# DB_PASSWORD
# API_KEY
```

### `peekachu delete <name>`

Remove a secret from the keychain.

```bash
peekachu delete API_KEY
```

### `peekachu status`

Show platform, provider, and runtime info.

```bash
peekachu status
# Platform: macos
# Provider: macOS Keychain (security CLI)
# Node:     v22.0.0
```

## Project Namespaces

Secrets are scoped per project so the same secret name (e.g. `DISCORD_WEBHOOK`) can have different values in different projects.

### How it works

- Secrets are stored in the keychain as `project/SECRET_NAME` (e.g. `website/DISCORD_WEBHOOK`)
- The default project is `default` — secrets without a project go here
- Peekachu auto-detects the project by looking for a `.peekachu` file in the current directory (or parents)

### Setting up a project

```bash
# Create a .peekachu config in your project root
peekachu init myproject

# Or let it default to the directory name
peekachu init
```

This creates a `.peekachu` file:

```json
{ "project": "myproject" }
```

### Using projects

```bash
# Auto-detects project from .peekachu file (or falls back to "default")
peekachu set DISCORD_WEBHOOK
peekachu list
peekachu run --env DISCORD_WEBHOOK -- node bot.js

# Explicit project override
peekachu set --project website DISCORD_WEBHOOK
peekachu list --project website
peekachu run --project api --env DISCORD_WEBHOOK -- node bot.js
```

## GUI App

Peekachu includes a desktop GUI built with [Electrobun](https://github.com/blackboardsh/electrobun) for managing secrets visually.

### Features

- Project selector dropdown — switch between projects
- Secrets list — see all secret names for the selected project (values are never shown)
- Add secrets — name + password field
- Delete secrets — per-row delete with inline confirmation
- Status bar — platform and provider info

### Running the GUI

```bash
# From the repo root
npm run gui

# Or manually
cd gui
bun install
bun start
```

> Requires [Bun](https://bun.sh) to be installed.

Secrets set via the CLI show up in the GUI and vice versa — they share the same OS keychain storage.

## How It Works

1. **Secrets are stored in the OS keychain** — macOS Keychain (`security` CLI) or Linux Secret Service (`secret-tool` CLI). No config files, no `.env` files, no plaintext on disk.

2. **Secrets are injected as environment variables** into the child process. The child reads them normally via `process.env`.

3. **Output is scrubbed in real-time** using a Transform stream with a sliding window buffer. Secrets split across chunk boundaries are still caught.

4. **Signal forwarding** — SIGINT, SIGTERM, and SIGHUP are forwarded to the child process. Exit codes are preserved.

## Platform Support

| Platform | Keychain Provider | Secret Input |
|----------|------------------|--------------|
| macOS | Keychain Access (`security` CLI) | Native dialog (`osascript`) |
| Linux | GNOME Keyring / libsecret (`secret-tool` CLI) | `/dev/tty` |

## Requirements

- Node.js 18+
- macOS or Linux
- No native addons — works with `npx` out of the box
- GUI requires [Bun](https://bun.sh)

## Built With

This project was built with [Claude Code](https://claude.ai/claude-code).

## License

MIT
