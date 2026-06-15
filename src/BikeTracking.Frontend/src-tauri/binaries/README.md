# Sidecar Binaries

This directory holds the self-contained .NET API binary that the Tauri host process spawns as a sidecar.

## Naming Convention

Tauri requires sidecar binaries to follow the pattern:

```
{name}-{target-triple}[.exe]
```

Expected filenames for BikeTracking:

| Platform | Filename |
|---|---|
| Windows x64 | `BikeTracking.Api-x86_64-pc-windows-msvc.exe` |
| Linux x64 | `BikeTracking.Api-x86_64-unknown-linux-gnu` |

## Important

**Real binaries are populated by CI only and MUST NOT be committed to the repository.**

- Binaries are built by the `publish-api-windows` and `publish-api-linux` GitHub Actions jobs.
- Each packaging job downloads its binary artefact into this directory before running `tauri build`.
- The `.gitignore` at the repository root excludes all real binaries from version control.

## Local Development

For local `npm run tauri dev` testing:

1. Publish the API as a self-contained binary for your platform:
   ```bash
   # Linux x64
   dotnet publish src/BikeTracking.Api/BikeTracking.Api.csproj \
     --configuration Release \
     --self-contained true \
     --runtime linux-x64 \
     -p:PublishSingleFile=true \
     --output /tmp/api-publish/

   cp /tmp/api-publish/BikeTracking.Api \
      src/BikeTracking.Frontend/src-tauri/binaries/BikeTracking.Api-x86_64-unknown-linux-gnu
   chmod +x src/BikeTracking.Frontend/src-tauri/binaries/BikeTracking.Api-x86_64-unknown-linux-gnu
   ```

2. Run `npm run tauri dev` from `src/BikeTracking.Frontend/`.
3. The sidecar binary will be spawned automatically by the Tauri host process.
