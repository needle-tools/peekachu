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

## License

MIT
