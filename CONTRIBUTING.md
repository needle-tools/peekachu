# Contributing to peekachu

Thanks for your interest in contributing! Here's how to get started.

## Setup

```bash
git clone https://github.com/needle-tools/peekachu.git
cd peekachu
npm install
```

## Development

```bash
npm run build      # Build with tsup
npm run dev        # Build in watch mode
npm test           # Run all tests
npm run test:watch # Run tests in watch mode
npm run typecheck  # Type-check without emitting
```

## Project Structure

```
src/
├── cli.ts              # Commander entry point
├── constants.ts        # Service name, redacted format
├── platform.ts         # OS detection
├── input.ts            # Native OS dialog / TTY fallback
├── scrubber.ts         # Transform stream (sliding window)
├── runner.ts           # Process spawn + env inject + scrub wiring
├── commands/           # CLI command handlers
│   ├── set.ts
│   ├── list.ts
│   ├── delete.ts
│   ├── run.ts
│   └── status.ts
└── providers/          # Pluggable secret backends
    ├── types.ts        # SecretProvider interface
    ├── keychain.ts     # macOS / Linux keychain
    ├── ci.ts           # CI environment variables
    └── index.ts        # Provider factory
```

## Adding a New Provider

Implement the `SecretProvider` interface in `src/providers/types.ts`:

```typescript
export interface SecretProvider {
  readonly name: string;
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<boolean>;
  list(): Promise<string[]>;
  has(name: string): Promise<boolean>;
}
```

Then register it in `src/providers/index.ts`.

## Guidelines

- **One runtime dependency** — we only depend on `commander`. Everything else uses Node built-ins. Think hard before adding a new dependency.
- **No native addons** — peekachu must work with `npx` zero-install.
- **Tests** — add tests for new functionality. Run `npm test` before submitting.
- **Security** — never log, print, or expose secret values. Pass secrets via stdin to CLI tools, not as process arguments (visible in `ps`).

## Submitting Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm test` and `npm run typecheck`
4. Open a pull request

## Reporting Issues

Open an issue at https://github.com/needle-tools/peekachu/issues with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Platform and Node version (`peekachu status`)
