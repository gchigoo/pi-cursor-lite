# @gchigoo/connect-node

Security-maintained compatibility fork of
[`@connectrpc/connect-node@1.7.0`](https://www.npmjs.com/package/@connectrpc/connect-node/v/1.7.0)
for `pi-cursor-lite`.

## Patch

The upstream JavaScript and declaration files are unchanged. This package changes
the runtime dependency from `undici@^5.28.4` to the security-fixed
`undici@6.27.0`. Connect Node 1.7.0 uses Undici only for the standard `Headers`
implementation, which remains available in Undici 6.

The downstream package version starts at `1.7.1`, so it satisfies Cursor SDK's
`@connectrpc/connect-node@^1.6.1` dependency when installed through an npm alias.

## Intended installation

`pi-cursor-lite` installs this package under the upstream dependency name:

```json
{
  "dependencies": {
    "@connectrpc/connect-node": "npm:@gchigoo/connect-node@1.7.1"
  }
}
```

It is not intended as a general replacement for newer ConnectRPC releases.

## Provenance and license

- Upstream source: `connectrpc/connect-es`, tag `v1.7.0`, package `packages/connect-node`
- Upstream license: Apache License 2.0
- Modified files: `package.json` and this README
- Unmodified files: compiled JavaScript and TypeScript declarations under `dist/`

See `LICENSE` and `NOTICE`.
