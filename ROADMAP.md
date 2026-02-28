# Roadmap

## v0.1 — Foundation (current)

- [x] CLI with `set`, `list`, `delete`, `run`, `status` commands
- [x] macOS Keychain provider (`security` CLI)
- [x] Linux Secret Service provider (`secret-tool` CLI)
- [x] CI mode (read from env vars, scrub only)
- [x] Transform stream scrubber with sliding window
- [x] Native OS dialog for secret input (macOS `osascript`)
- [x] TTY fallback input
- [x] Signal forwarding and exit code preservation
- [x] Unit and integration tests

## v0.2 — Polish

- [ ] Windows support (Credential Manager via `cmdkey` / PowerShell)
- [ ] `peekachu env` — print `export` statements for shell eval
- [ ] `peekachu exec` — alias for `run` with simpler syntax
- [ ] Dotenv-style `--env-file` flag to load secret names from a file
- [ ] Better error messages and diagnostics
- [ ] Shell completions (bash, zsh, fish)

## v0.3 — Ecosystem

- [ ] 1Password provider (`op` CLI)
- [ ] Bitwarden provider (`bw` CLI)
- [ ] AWS Secrets Manager provider
- [ ] HashiCorp Vault provider
- [ ] Azure Key Vault provider
- [ ] GCP Secret Manager provider
- [ ] Provider auto-detection based on environment

## v0.4 — Developer Experience

- [ ] `peekachu init` — interactive setup wizard
- [ ] `peekachu check` — verify all required secrets are available
- [ ] Config file support (`.peekachurc` / `peekachu.config.ts`)
- [ ] Secret rotation helpers
- [ ] Audit logging (which secrets were accessed, when)

## Future Ideas

- [ ] MCP server — expose as a tool for AI agents
- [ ] VS Code extension
- [ ] GitHub Action
- [ ] Secret sharing between team members (encrypted)
- [ ] Temporary secret scoping (auto-expire)

## Non-Goals

- **Not a full secrets manager** — peekachu is a bridge between secrets managers and AI-assisted development. Use a proper secrets manager (1Password, Vault, AWS SM) for the source of truth.
- **Not a replacement for `.env`** — peekachu complements `.env` workflows by adding keychain storage and output scrubbing.
- **No secret syncing** — peekachu is local-first. Use your secrets manager's sync features.
