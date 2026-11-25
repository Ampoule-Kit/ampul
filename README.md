# devenv

A portable, containerized developer environment. One command creates a container for a project with your tools, dotfiles, Neovim setup, git and SSH config already in place, and the project's code cloned or copied inside it. You then `dev enter` it and work as on any Linux machine.

- No files are added to your projects. Everything devenv needs, your dotfiles included, lives in this repo and in `~/.config/devenv/`.
- Every tool version is pinned and checksummed in [`image/versions`](image/versions), so a rebuild months from now gives the same environment. Nothing changes until you bump a version.
- Plain bash, a Containerfile and Podman or Docker. No other tooling is required.

## Requirements

- macOS or Linux.
- [Podman](https://podman.io) (preferred) or Docker. On macOS, Podman runs in a Linux VM called the Podman machine: create one with `podman machine init`.
- git.

Building .NET or Node projects and running containers inside a dev container takes memory. On macOS, give the Podman machine at least 4 GB, and 6–8 GB for larger projects:

```sh
podman machine stop && podman machine set --memory 8192 && podman machine start
```

## Install

```sh
git clone git@github.com:MorneVenter/devenv.git
cd devenv
./install.sh
```

`install.sh` links `~/.local/bin/dev` to the `dev` script in this repo, so pulling this repo updates the command immediately. It never overwrites a file that isn't its own link, and it tells you when `~/.local/bin` isn't on your `PATH`, when another `dev` command hides this one, or when the container runtime needs setting up. To install the link elsewhere, run `DEVENV_BIN_DIR=/some/dir ./install.sh`.

## Uninstall

```sh
./uninstall.sh
```

It first offers to remove every devenv container, image, volume and project setting, then removes the `dev` link. It never deletes this repo or anything else on your machine.

## Create a project

```sh
dev new
```

`dev new` asks for:

1. **The code.** Either:
    - one or more git repository URLs (HTTPS or SSH), cloned side by side into `~/Project/<repo-name>`, or
    - a folder on this machine, copied into `~/Project/<folder-name>`. When the folder is a git repository, you can copy only `.git` and the files git tracks or doesn't ignore, which leaves out `node_modules`, `bin`, `obj`, `.env` and other ignored files.
2. **The project name.** It defaults to the first repository or the folder name.
3. **Dependencies:**
    - one or more .NET SDKs
    - Java (Temurin)
    - Godot (standard or .NET)
    - Python
    - a container engine inside the container
4. **Ports** your apps listen on that this machine should reach at `localhost`, for example `4200 5000`.

It then builds the image, creates the container, sets it up and fetches the code. When it finishes, run `dev enter <name>`.

The code lives only in the container. Push your work before running `dev rebuild` or `dev rm`, because both throw away `~/Project`.

## Commands

| Command | What it does |
| --- | --- |
| `dev new [name]` | Creates a project container. |
| `dev enter <name>` | Opens a bash login shell in `~/Project`. |
| `dev start <name>` | Starts a stopped project container. |
| `dev stop <name>` | Stops a project container. |
| `dev rebuild <name>` | Rebuilds the image and recreates the container with fresh code and dotfiles. |
| `dev setup <name>` | Reruns the in-container setup (dotfiles, Neovim, git and SSH) without recreating anything. |
| `dev config <name>` | Changes a project's code source, dependencies or ports. Apply the changes with `dev rebuild`. |
| `dev rm <name>` | Removes a project's container, image, volumes and settings. |
| `dev ls` | Lists projects, their status and where their code comes from. |
| `dev purge [--yes]` | Removes every devenv container, image, volume and project setting. |

`dev` never starts the container engine or a stopped container by itself. When either is down, it prints the command to run, such as `podman machine start` or `dev start <name>`.

## What's in the container

Every container is Ubuntu 24.04 with:

| Always | Optional, per project |
| --- | --- |
| Neovim, tree-sitter CLI, Node.js and npm | .NET SDKs, side by side |
| lazygit, yazi, zellij, lsd | Java (Temurin JDK) |
| Claude Code | Godot, standard or .NET build |
| git, ripgrep, fd, fzf, jq, GNU stow | Python with pip, venv and headers |
| build-essential, curl, wget, socat | Podman, docker CLI and docker compose |

You work as the user `dev`, which has passwordless `sudo` and the same user ID as you on the host.

### Dotfiles and Neovim

[`dotfiles/`](dotfiles) holds everything that goes into the container's home folder: the bash profile, and the Neovim, yazi and zellij configs. `dev new`, `dev rebuild` and `dev setup` copy it into `~/dotfiles` in the container and link it into the home folder with `stow --no-folding`. They then install the Neovim plugins pinned in `lazy-lock.json`, the Mason language servers and formatters, and the treesitter parsers. Anything that fails to install is reported as a warning, and the full output is in `/tmp/devenv/setup.log`.

To pick up a change to `dotfiles/`, run `dev setup <name>`. It copies your working copy in, so there is nothing to commit first. Links to files you deleted from `dotfiles/` are removed.

### Git and SSH

Containers use the git and SSH setup of the machine running `dev`. It works the same on macOS and Linux:

- **git:** `~/.gitconfig` and `~/.config/git/config` are included, `core.excludesfile` is mounted, and `~/.git-credentials` is shared, so the `store` credential helper works. A credential helper that doesn't exist on Linux (such as `osxkeychain`) is replaced by an in-memory cache for 8 hours.
- **SSH:** `~/.ssh` is mounted read-only and the keys are linked into the container's `~/.ssh`. The config is copied with macOS-only options ignored and host paths rewritten. `known_hosts` is a writable copy.

Each container runs its own `ssh-agent`. With `AddKeysToAgent yes` in your SSH config, a key's passphrase is asked once and then remembered until the container stops.

### Ports

Each port you list is published on the host's `127.0.0.1`. Apps in the container don't need to listen on `0.0.0.0`: a forwarder in the container passes each port on to the app's `127.0.0.1`, so dev servers that bind to localhost by default (Angular, Vite, ASP.NET) work unchanged. Node is set to prefer IPv4, so `localhost` in Node means `127.0.0.1`.

To change the ports, run `dev config <name>`, then `dev rebuild <name>`.

### Containers inside the container

With the container engine selected, Podman runs inside the project's container, with the docker CLI and the compose plugin pointed at it. Containers that your project starts (for example a database from Aspire, docker compose or Testcontainers) run inside the dev container, so their published ports are on its `localhost`, as on a normal machine. The project's container then runs privileged.

Their images and data live in a volume per project, so they survive `dev rebuild`, and `dev rm` deletes them.

### What survives a rebuild

| Kept | Recreated |
| --- | --- |
| The shared package cache (NuGet, npm and other `~/.cache` data) | `~/Project`, with freshly cloned or copied code |
| Images and data of the containers run inside the container | Dotfiles, Neovim plugins and tools |
| Project settings in `~/.config/devenv/projects/` | Everything else in the container |

## Configuration

### devenv.conf

| Setting | Meaning |
| --- | --- |
| `CONTAINER_USER` | Name of the user in the container. |
| `RUNTIME` | `podman` or `docker`. Empty picks Podman when it is installed, otherwise Docker. |

### Project settings

Each project's answers are saved in `~/.config/devenv/projects/<name>.env`. Change them with `dev config <name>`, or edit the file, then run `dev rebuild <name>`.

### Bumping a version

[`image/versions`](image/versions) holds every pinned version and its checksums for arm64 and amd64. To bump a tool:

1. Change its `_VERSION`.
2. Replace both checksums with the new release's, from the source the tool publishes them in:

    | Tool | Checksum source |
    | --- | --- |
    | Neovim, lazygit, yazi, zellij, lsd, tree-sitter, Godot, docker compose | GitHub release asset digests: `curl -fsSL https://api.github.com/repos/<owner>/<repo>/releases/tags/<tag> \| jq -r '.assets[] \| "\(.name) \(.digest)"'` |
    | Node.js | `https://nodejs.org/dist/v<version>/SHASUMS256.txt` |
    | .NET SDK (sha512) | `https://builds.dotnet.microsoft.com/dotnet/release-metadata/<channel>/releases.json` |
    | Java (Temurin) | `https://api.adoptium.net/v3/assets/release_name/eclipse/jdk-<version>?os=linux&image_type=jdk` |
    | Claude Code | `https://downloads.claude.ai/claude-code-releases/<version>/manifest.json` |
    | docker CLI | No published checksums: download both files from `https://download.docker.com/linux/static/stable/` and run `shasum -a 256` |
    | Ubuntu image | The multi-architecture index digest: the `docker-content-digest` header of `https://registry-1.docker.io/v2/library/ubuntu/manifests/24.04` |

3. Run `dev rebuild <name>`. A wrong checksum fails the build and names the file.

To offer another .NET SDK, add its channel to `DOTNET_CHANNELS` in `image/versions` and add its `DOTNET_<channel>_VERSION` and both `DOTNET_<channel>_SHA512_*` lines. `dev new` then lists it.

Downloads are cached by the container engine between builds, so rebuilding only downloads what changed.

### Adding a dependency

1. Add its pins to `image/versions`.
2. Add `image/tools/<tool>.sh`, following the existing scripts: `download_verified` downloads a file and checks it against its pinned hash, and `fresh_install_dir` and `link_into_path` put it under `/opt` and on the `PATH`.
3. Install it in [`image/Containerfile`](image/Containerfile): always, or behind a `WITH_<TOOL>` build argument.
4. For an optional dependency, ask for it in `prompt_dependencies` in [`cli/prompts.sh`](cli/prompts.sh), save it in `save_project` in [`cli/projects.sh`](cli/projects.sh) and pass it to the build in `build_image` in [`cli/containers.sh`](cli/containers.sh).

## Layout

| Path | Purpose |
| --- | --- |
| `dev` | The command: loads the settings and the `cli/` modules, and runs a command. |
| `install.sh`, `uninstall.sh` | Link and unlink the `dev` command. |
| `devenv.conf` | Container user and runtime. |
| `cli/` | The `dev` command's modules, run on this machine: `engine.sh` (Podman or Docker), `projects.sh` (names and saved settings), `prompts.sh` (questions), `containers.sh` (image, container and setup), `project-code.sh` (cloning or copying the code) and `commands.sh` (one function per command). |
| `image/` | What builds the image: `Containerfile`, `versions`, `install-helpers.sh` and one script per tool in `tools/`. |
| `container/` | What runs inside a container: `entrypoint.sh` (ssh-agent, inner container engine and port forwarders) and `setup.sh` (dotfiles, Neovim, git and SSH). |
| `dotfiles/` | Everything linked into the container's home folder. |

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `The podman engine is not running` | Run the command it prints, such as `podman machine start`. |
| A Neovim tool did not install | Read `/tmp/devenv/setup.log` in the container, then fix it with `:Mason` or `:Lazy restore`, or rerun `dev setup <name>`. `csharpier` needs a .NET SDK in the project. |
| A port is already in use | Another program or project uses it on this machine. Stop it, or change the project's ports with `dev config`. |
| Builds or containers get killed | The Podman machine is out of memory. Give it more (see [Requirements](#requirements)). |
| The inner container engine misbehaves | Its log is `/tmp/devenv/container-engine.log` in the container. |
| A forwarded port doesn't answer | Check the app is running in the container, then see `/tmp/devenv/port-forwards.log`. |
