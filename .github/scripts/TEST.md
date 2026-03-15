# Running workflows locally with act

Install [act](https://github.com/nektos/act), then from repo root:

**Publish Rust SDK** (workflow_dispatch or release):

```bash
.github/scripts/act-publish-rust-sdk.sh              # manual trigger
.github/scripts/act-publish-rust-sdk.sh release       # simulate release published
```

Secrets: ensure `.github/scripts/secrets.json` exists with required keys (e.g. `CARGO_REGISTRY_TOKEN` for Rust). This file is gitignored.
