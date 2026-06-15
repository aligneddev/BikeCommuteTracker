# Contract: CI Artefact Pipeline

**Scope**: `.github/workflows/release.yml`

---

## Overview

Two new parallel jobs (`publish-api-windows`, `publish-api-linux`) produce self-contained API binaries and upload them as GitHub Actions artefacts. The existing `package-windows` and `package-linux` jobs each download their respective artefact and place it in `src-tauri/binaries/` before running `tauri build`.

---

## Revised Job Dependency Graph

```
build-frontend ──────────────────────────────────────┐
                                                     │
publish-api-windows ─────────────────────────────►  package-windows ──► publish-release
publish-api-linux ───────────────────────────────►  package-linux ───► publish-release
smoke-test-api (unchanged) ────────────────────────────────────────────────────────────┘
```

---

## Job: `publish-api-windows`

| Property | Value |
|---|---|
| Runner | `windows-latest` |
| Needs | *(none — runs in parallel with `build-frontend`)* |
| Timeout | 15 minutes |

**Steps**:
1. Checkout
2. Setup .NET from `global.json`
3. Restore: `dotnet restore BikeTracking.slnx`
4. Publish:
   ```powershell
   dotnet publish src/BikeTracking.Api/BikeTracking.Api.csproj `
     --configuration Release `
     --self-contained true `
     --runtime win-x64 `
     -p:PublishSingleFile=true `
     --output api-publish-win/ `
     --no-restore
   ```
5. Rename binary to Tauri naming convention:
   ```powershell
   Rename-Item api-publish-win/BikeTracking.Api.exe `
     BikeTracking.Api-x86_64-pc-windows-msvc.exe
   ```
6. Upload artefact:
   - **name**: `api-binary-windows`
   - **path**: `api-publish-win/BikeTracking.Api-x86_64-pc-windows-msvc.exe`
   - **retention-days**: 1

---

## Job: `publish-api-linux`

| Property | Value |
|---|---|
| Runner | `ubuntu-latest` |
| Needs | *(none — runs in parallel with `build-frontend`)* |
| Timeout | 15 minutes |

**Steps**:
1. Checkout
2. Setup .NET from `global.json`
3. Restore: `dotnet restore BikeTracking.slnx`
4. Publish:
   ```bash
   dotnet publish src/BikeTracking.Api/BikeTracking.Api.csproj \
     --configuration Release \
     --self-contained true \
     --runtime linux-x64 \
     -p:PublishSingleFile=true \
     --output api-publish-linux/ \
     --no-restore
   ```
5. Rename and mark executable:
   ```bash
   mv api-publish-linux/BikeTracking.Api \
      api-publish-linux/BikeTracking.Api-x86_64-unknown-linux-gnu
   chmod +x api-publish-linux/BikeTracking.Api-x86_64-unknown-linux-gnu
   ```
6. Upload artefact:
   - **name**: `api-binary-linux`
   - **path**: `api-publish-linux/BikeTracking.Api-x86_64-unknown-linux-gnu`
   - **retention-days**: 1

---

## Changes to `package-windows`

Add to `needs`:
```yaml
needs: [build-frontend, publish-api-windows]
```

Add step **before** `Build Windows installer`:
```yaml
- name: Download API binary (Windows)
  uses: actions/download-artifact@v4
  with:
    name: api-binary-windows
    path: src/BikeTracking.Frontend/src-tauri/binaries/
```

---

## Changes to `package-linux`

Add to `needs`:
```yaml
needs: [build-frontend, publish-api-linux]
```

Add step **before** `Build Linux .deb package`:
```yaml
- name: Download API binary (Linux)
  uses: actions/download-artifact@v4
  with:
    name: api-binary-linux
    path: src/BikeTracking.Frontend/src-tauri/binaries/

- name: Mark API binary executable
  run: chmod +x src/BikeTracking.Frontend/src-tauri/binaries/BikeTracking.Api-x86_64-unknown-linux-gnu
```

---

## Failure Invariants (FR-008)

1. If `publish-api-windows` fails → `package-windows` does not run (GitHub Actions `needs` dependency)
2. If `publish-api-linux` fails → `package-linux` does not run
3. If `package-windows` or `package-linux` fails → `publish-release` does not run
4. The `smoke-test-api` job continues to use `--self-contained false` (it validates API behaviour, not binary packaging)

---

## `src-tauri/binaries/` Directory

A new `src-tauri/binaries/` directory is added to the repository with:
- `.gitkeep` — keeps the directory tracked
- `README.md` — documents naming convention and instructs developers not to commit real binaries

`.gitignore` entry (in `src/BikeTracking.Frontend/src-tauri/binaries/.gitignore` or the root `.gitignore`):
```gitignore
# Sidecar binaries — populated by CI; do not commit
src/BikeTracking.Frontend/src-tauri/binaries/*.exe
src/BikeTracking.Frontend/src-tauri/binaries/BikeTracking.Api-*
```

---

## Artefact Naming Summary

| Artefact name | File | Produced by | Consumed by |
|---|---|---|---|
| `api-binary-windows` | `BikeTracking.Api-x86_64-pc-windows-msvc.exe` | `publish-api-windows` | `package-windows` |
| `api-binary-linux` | `BikeTracking.Api-x86_64-unknown-linux-gnu` | `publish-api-linux` | `package-linux` |
