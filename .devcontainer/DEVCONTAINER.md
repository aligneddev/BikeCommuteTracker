# DevContainer Configuration Guide

## Overview

This project uses a DevContainer for consistent local development across all team members and CI/CD environments.

- **Image Build**: `.devcontainer/Dockerfile` (based on `mcr.microsoft.com/devcontainers/dotnet:1-10.0-noble`)
- **Features**: Node.js 24+ and GitHub CLI
- **Post-create bootstrap**: Configures SSH permissions, trusts dev HTTPS certs, and installs frontend dependencies

## Git Credentials Setup

I did this to avoid getting commits from the wrong user. This is optional for you. If you have the straight forward setup, you don't need to mount ~/.ssh as the Forwarding should work fine. This is just for the edge case of having multiple GitHub accounts and needing to use different SSH keys for each.

The DevContainer is configured for SSH-based Git access using two GitHub accounts (personal and company). The host `~/.ssh` directory is mounted read-only at `/root/.ssh-host` and copied to `/root/.ssh` with correct permissions during container creation.

### Why the copy step?

SSH refuses to use a config file that is world-writable, which is common when `~/.ssh` is mounted from a Windows host filesystem. Mounting to a staging path and copying to `/root/.ssh` with `chmod 600`/`700` fixes this without modifying the host files.

### Multi-account SSH config

The host `~/.ssh/config` defines two named GitHub hosts:

```
Host github.com-personal
  HostName github.com
  IdentityFile ~/.ssh/youruser_github

Host github.com
  HostName github.com
  IdentityFile ~/.ssh/yourcompany_github
```

Use the host alias matching the account when cloning:

```bash
# Personal repos
git clone git@github.com-personal:your-username/your-repo.git

# Company repos
git clone git@github.com:omnitech-org/your-repo.git
```

Verify both accounts inside the container:

```bash
ssh -T git@github.com-personal
ssh -T git@github.com
```

### Prerequisites (one-time host setup)

1. SSH keys for both accounts must exist in `~/.ssh` on the host machine
2. Both public keys must be registered in the respective GitHub accounts ([GitHub SSH settings](https://github.com/settings/keys))
3. The `~/.ssh/config` file on the host must define the `github.com-personal` host alias as shown above

## Environment Variables

The container exports these environment variables:

- `NODE_ENV=development` — Frontend runs in development mode (hot reload, source maps)
- `PATH` — Includes `/usr/local/share/dotnet-tools` and `/root/.dotnet/tools` for CLI tools (CSharpier, Aspire, etc.)

## Post-Create Setup

The `postCreateCommand` runs automatically after container creation:

1. Copies mounted host SSH files from `/root/.ssh-host` to `/root/.ssh` and applies secure file permissions
2. `dotnet dev-certs https --trust`
3. `npm ci --prefix src/BikeTracking.Frontend`

SDK/tool installation and .NET dependency restore are baked into the image build in `.devcontainer/devcontainer.Dockerfile`, not installed at container start.

**Output**: Terminal shows progress; container is ready when build succeeds.

## Debugging & Troubleshooting

### Git commands fail inside container

**Symptom**: `git clone` returns "Permission denied" or authentication errors

**Solution**:
- Verify SSH key exists on host: `ls ~/.ssh/id_ed25519` (or `id_rsa`)
- Verify key is added to GitHub: https://github.com/settings/keys
- Inside container, test connectivity: `ssh -T git@github.com`
- If still failing, use Git credential helper instead: `git config --global credential.helper store`

### SSH mount not working (Windows)

**Symptom**: `ssh -T git@github.com` returns "ssh: connect to host... refused"

**Solution**:
- Ensure OpenSSH server is running on Windows (Control Panel → Optional Features → OpenSSH Server)
- Or use Git credential helper (`credential.helper store`) instead
- SSH mounting is most reliable on macOS/Linux; Windows users should consider credential helper

### Container build fails

**Symptom**: "failed to solve with frontend dockerfile.v0"

**Solution**:
- Rebuild container: `Ctrl+Shift+P` → "Dev Containers: Rebuild Container"
- Check Docker Desktop is running (Windows/macOS)
- Check disk space (DevContainer images are ~2-3 GB)

### Node modules or NuGet packages missing

**Symptom**: `npm: command not found` or `dotnet: command not found`

**Solution**:
- Ensure `postCreateCommand` completed successfully (check terminal output)
- Manually run: `npm ci --prefix src/BikeTracking.Frontend`
- Manually run: `dotnet restore` from repo root

## Security

### SSH Keys

- SSH keys are mounted **read-only** — cannot be modified inside container
- Private keys never leave host machine
- Pre-commit hooks prevent accidental credential commits

### Git Credentials

- Use SSH keys or GitHub CLI authentication (recommended)
- Never commit credentials to repository
- `.gitignore` prevents `git config --global --show-origin credential.helper` output
- For CI/CD, use GitHub deploy keys or `GITHUB_TOKEN` environment variable

Note the devcontainer.json setup with

"remoteEnv": {
    "PATH": "${containerEnv:PATH}:/usr/local/share/dotnet-tools:/root/.dotnet/tools",
    "SSH_AUTH_SOCK": "/ssh-agent"
  },
  "mounts": [
    "source=${env:SSH_AUTH_SOCK},target=/ssh-agent,type=bind",
    "source=${localEnv:HOME}/.ssh,target=/root/.ssh-host,type=bind,readonly",
    "source=${localEnv:HOME}/.microsoft/usersecrets,target=/root/.microsoft/usersecrets,type=bind"
  ]

### Secrets Management

- Local development: Use .NET User Secrets or environment variables
- CI/CD: Use GitHub repository secrets or Azure Key Vault
- DevContainer environment variables in `devcontainer.json` are for non-sensitive values only
- Persist User Secrets in Dev Containers by bind-mounting your host user-secrets directory to `/root/.microsoft/usersecrets`

Example mount paths by host OS:
- Linux/macOS host: `source=${localEnv:HOME}/.microsoft/usersecrets,target=/root/.microsoft/usersecrets,type=bind`
- Windows host: `source=${localEnv:APPDATA}/Microsoft/UserSecrets,target=/root/.microsoft/usersecrets,type=bind`

If you use Docker Compose directly, the same mapping applies:

```yaml
services:
  api:
    volumes:
      - ${HOME}/.microsoft/usersecrets:/root/.microsoft/usersecrets
```

## Advanced Customization

### Adding VS Code Extensions

Edit `devcontainer.json`, add extension ID to `customizations.vscode.extensions`:

```json
"extensions": [
  "GitHub.Copilot",
  "eamodio.gitlens"
]
```

Rebuild container: `Ctrl+Shift+P` → "Dev Containers: Rebuild Container"

### Changing Node.js or .NET Version

- Change **Node.js** in `devcontainer.json` features:

```json
"features": {
  "ghcr.io/devcontainers/features/node:1": {
    "version": "22"  // Change to different Node version
  }
}
```

- Change **.NET SDK** in `.devcontainer/Dockerfile` by updating `REQUIRED_DOTNET_SDK_VERSION`, then rebuild the container.

### Mounting Additional Volumes

Edit `mounts` array to add more host directories (e.g., for shared data):

```json
"mounts": [
  "source=${localEnv:HOME}/.ssh,target=/root/.ssh-host,type=bind,readonly",
  "source=${localEnv:HOME}/.microsoft/usersecrets,target=/root/.microsoft/usersecrets,type=bind",
  "source=/path/on/host,target=/path/in/container"
]
```

## Resources

- [Dev Containers Documentation](https://containers.dev/)
- [GitHub SSH Keys Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [GitHub CLI Documentation](https://cli.github.com/)
