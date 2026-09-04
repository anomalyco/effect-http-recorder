# Contributing

Install the pinned dependencies and run the complete quality gate:

```sh
bun install --frozen-lockfile
bun run check
```

Use `bun run format` and `bun run lint:fix` for local fixes. Tests live under `test/`, examples under `examples/`, and the public API is limited to the root `HttpRecorder` export.

Add a Changeset with `bun run changeset` for user-facing changes. Review every cassette diff for credentials before committing it. Refresh a cassette by deleting only that cassette and rerunning its focused test.

Effect release candidate upgrades must update runtime, peer, development, documentation, and clean-consumer versions together. Use static imports only; dynamic `import()` and inline import-type expressions are not accepted.
