# DevContainer Configuration Guide

## Overview

This project uses a DevContainer for consistent local development across all team members and CI/CD environments.

- **Image**: `mcr.microsoft.com/devcontainers/dotnet:1-10-noble`
- **Features**: .NET 10 SDK, Node.js 24+, npm, Docker
- **Post-setup**: Automatically installs CSharpier, frontend dependencies, and builds solution

## Git Credentials Setup

The DevContainer supports multiple credential approaches. Choose based on your environment:

### 1. SSH Keys (Local Development - Recommended)

**Best for**: Windows/macOS/Linux developers working locally

**How it works**:
- Your `~/.ssh` directory is automatically mounted (read-only) from host into container
- SSH keys and config are available inside the container without duplication
- Git operations (clone, push, pull) use SSH URLs seamlessly

**Setup** (one-time):
```bash
# On host machine, generate SSH key if needed:
ssh-keygen -t ed25519 -C "your-email@example.com"

# Add public key to GitHub: https://github.com/settings/keys

# Inside container, verify connectivity:
ssh -T git@github.com

# Now use SSH URLs:
git clone git@github.com:your-org/your-repo.git
git push origin my-branch
```

**Why this works**: 
- No credential prompts on every operation
- Private key never leaves host machine
- SSH key permissions respected inside container
- CI/CD can use SSH deploy keys (safer than personal access tokens)

### 2. Git Credential Helper (Remote/CI Environments)

**Best for**: GitHub Codespaces, cloud-hosted containers, CI/CD runners

**Setup**:
```bash
# Inside container, enable credential caching:
git config --global credential.helper store

# First git operation will prompt for GitHub token (cached afterwards)
git clone https://github.com/your-org/your-repo.git
# When prompted: username=your-github-username, password=<GitHub Personal Access Token>
```

**Or use GitHub CLI**:
```bash
# Pre-installed in container
gh auth login
# Follow interactive prompts; automatically configures Git credential helper
```

### 3. SSH Agent Forwarding (Passphrase-Protected Keys on Remote Machine)

**Best for**: Advanced scenarios where SSH key is on a remote server

**Setup** (uncomment in `devcontainer.json`):
```json
"forwardPorts": [22],
"remoteEnv": {
  "SSH_AUTH_SOCK": "/run/host-services/ssh-auth.sock"
}
```

Then inside container:
```bash
ssh-add -l  # List forwarded keys
git clone git@github.com:your-org/your-repo.git
```

## Environment Variables

The container exports these environment variables:

- `NODE_ENV=development` — Frontend runs in development mode (hot reload, source maps)
- `PATH` — Includes `/root/.dotnet/tools` for global .NET tools (CSharpier, etc.)

## Post-Create Setup

The `.devcontainer/postCreate.sh` script runs automatically after container starts:

1. Installs global .NET tools (CSharpier for code formatting)
2. Installs frontend npm dependencies
3. Restores NuGet packages
4. Builds solution to verify environment

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
- Ensure post-create script completed successfully (check terminal output)
- Manually run: `npm install` in `src/BikeTracking.Frontend`
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

### Secrets Management

- Local development: Use .NET User Secrets or environment variables
- CI/CD: Use GitHub repository secrets or Azure Key Vault
- DevContainer environment variables in `devcontainer.json` are for non-sensitive values only

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

Edit feature versions in `devcontainer.json`:

```json
"features": {
  "ghcr.io/devcontainers/features/node:1": {
    "version": "22"  // Change to different Node version
  }
}
```

### Mounting Additional Volumes

Edit `mounts` array to add more host directories (e.g., for shared data):

```json
"mounts": [
  "source=${localEnv:HOME}${localEnv:USERPROFILE}/.ssh,target=/root/.ssh,readonly",
  "source=/path/on/host,target=/path/in/container"
]
```

## Resources

- [Dev Containers Documentation](https://containers.dev/)
- [GitHub SSH Keys Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [GitHub CLI Documentation](https://cli.github.com/)
