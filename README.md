# devenv

A portable, containerized developer environment with a terminal UI. One command creates a container for a project with your tools, dotfiles, Neovim setup, git and SSH config already in place, and the project's code cloned or copied inside it. `dev start <name>` then drops you into a shell in it.

- No files are added to your projects. Everything devenv needs, your dotfiles included, lives in this repo, is built into the `dev` binary, and keeps its settings in `~/.config/devenv/`.
- Every tool version in the container is pinned and checksummed in [`image/versions`](image/versions), so a rebuild months from now gives the same environment.
- `dev` is a single self-contained binary built from this repo with Node.js and [Ink](https://github.com/vadimdemedes/ink). It guides you through creating projects, shows what is happening at every step, and tells you how to fix anything that goes wrong.

## Requirements

- macOS or Linux. The code is written to build on Windows too, but it is not tested there yet.
- [Node.js](https://nodejs.org) 26 (the current LTS) or newer, with npm 11 or newer. They are only needed to build `dev`; the binary carries its own runtime. With nvm: `nvm install 26` (the repo has an `.nvmrc`).
- git.
- [Podman](https://podman.io) (preferred) or Docker. On macOS, Podman runs in a Linux VM called the Podman machine; `dev` offers to create or start it when it is missing or stopped.

Building .NET or Node projects and running containers inside a dev container takes memory. On macOS, give the Podman machine at least 4 GB, and 6–8 GB for larger projects. `dev doctor` checks this and prints the command that changes it.

## Install

```sh
git clone git@github.com:MorneVenter/devenv.git
cd devenv
./install.sh
```

On Windows, run `install.cmd`. The installer works on a fresh clone:

1. It checks the Node.js and npm versions, and tells you how to upgrade when they are too old.
2. It installs the build tools with `npm ci`.
3. It builds `dev` for the machine it runs on: one binary with the Node.js runtime, the app, the image definition and your dotfiles inside.
4. It copies the binary to `~/.local/bin/dev` (on Windows, `%LOCALAPPDATA%\Programs\devenv\dev.exe`). To put it elsewhere, run `DEVENV_BIN_DIR=/some/dir ./install.sh`. It replaces an earlier devenv, including the old bash `dev` link, and never overwrites a command that is not devenv.
5. It runs `dev doctor`, which checks the container runtime, the engine, memory, git, SSH and your `PATH`, and prints the fix for anything that is not ready.

Run `./install.sh` again after pulling this repo, or after changing `dotfiles/` or `image/`, to rebuild `dev`.

## Uninstall

```sh
./uninstall.sh
```

On Windows, run `uninstall.cmd`. It finds the installed `dev` (in the install folder or anywhere on your `PATH`, and only if it is devenv's), offers to run `dev purge` first to remove every container, image, volume and project setting, then deletes the binary and its cache. It never deletes this repo.

## Use

```sh
dev new          # create a project, guided step by step
dev start api    # start the api project if needed and open a shell in it
dev              # see every project and act on it with single keys
```

`dev new` opens a form that asks, one step at a time:

1. **The code.** Either git repositories (HTTPS or SSH), cloned side by side into `~/Project/<repo-name>`, or a folder on this machine, copied into `~/Project/<folder-name>` (tab completes folder names). For a git repository you can copy only what git tracks or doesn't ignore, which leaves out `node_modules`, `bin`, `obj`, `.env` and other ignored files.
2. **The name**, suggested from the code.
3. **Extra tools**, picked from a list that explains each one: .NET SDKs side by side, Java, Godot (standard or .NET), Python, and a container engine inside the container.
4. **Ports** your apps listen on that this machine should reach at `localhost`: pick common ones from a list (Angular, Vite, ASP.NET Core, Spring Boot, the Node and Java debuggers, PostgreSQL, Redis and more), and add your own ports and ranges such as `3000-3009`.

A review then shows the choices, the container runtime in use, and what is about to happen. Esc goes back a step at any point. While the project builds, each step shows its progress (the image build with a progress bar and the tool being installed), the latest output and its duration. Repositories that need a password or SSH passphrase are cloned afterwards in the terminal, where git can ask for it. At the end, `dev new` offers to connect.

The code lives only in the container. Push your work before running `dev rebuild` or `dev rm`, because both throw away `~/Project`.

## Commands

| Command | What it does |
| --- | --- |
| `dev` | Opens the home screen: every project with its status. Enter connects; `s` stops, `e` configures, `r` rebuilds, `x` removes, `n` creates. |
| `dev new [name]` | Creates a project container through the guided form. |
| `dev start [name]` | Starts a project's container if needed and opens a bash login shell in `~/Project`. `-d` only starts it. `dev enter` is the same command. |
| `dev stop [name]` | Stops a project's container. `--all` stops every running project. |
| `dev ls` | Lists projects, their status, ports and where their code comes from. `--json` for scripts. |
| `dev config [name]` | Changes a project's code source, tools or ports in the same form, marks what changed, and can rebuild right away. |
| `dev rebuild [name]` | Rebuilds the image and recreates the container with fresh code and dotfiles. |
| `dev setup [name]` | Copies the dotfiles in again and reruns the in-container setup (Neovim, git and SSH) without recreating anything. |
| `dev rm [name]` | Removes a project's container, image, volumes and settings. |
| `dev purge` | Removes every devenv container, image, volume and project setting. |
| `dev doctor` | Checks that this machine is ready and prints the fix for anything that is not. |
| `dev help [command]` | Shows the manual for `dev`, or for one command. |

Leave out the project name and `dev` lets you pick it from a list. Every command has a manual page: `dev <command> --help` or `dev help <command>`. `dev --version` prints the version, which comes from `package.json`.

Commands that delete something show exactly what goes and what stays, then ask. In scripts, where nobody can answer, pass `--yes`. When the container engine is not running, `dev` explains why and how to start it, and for the Podman machine it offers to do it for you.

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

The dotfiles are built into the `dev` binary, so a change to `dotfiles/` takes two steps: run `./install.sh` to rebuild the binary with your working copy (there is nothing to commit first), then `dev setup <name>` to copy it into a running project. Links to files you deleted from `dotfiles/` are removed.

### Git and SSH

Containers use the git and SSH setup of the machine running `dev`. It works the same on macOS and Linux:

- **git:** `~/.gitconfig` and `~/.config/git/config` are included, `core.excludesfile` is mounted, and `~/.git-credentials` is shared, so the `store` credential helper works. A credential helper that doesn't exist on Linux (such as `osxkeychain`) is replaced by an in-memory cache for 8 hours.
- **SSH:** `~/.ssh` is mounted read-only and the keys are linked into the container's `~/.ssh`. The config is copied with macOS-only options ignored and host paths rewritten. `known_hosts` is a writable copy.

Each container runs its own `ssh-agent`. With `AddKeysToAgent yes` in your SSH config, a key's passphrase is asked once and then remembered until the container stops.

### Ports

Pick common ports from the list, or choose **Other ports and ranges** to add your own: a single port (`8081`), a range (`3000-3009`), or several at once (`3000-3009 8000-8005 9000`). Each entry is checked as you add it: ports run from 1 to 65535, a range can't run backwards or overlap one already in the list, and a project forwards at most 100 ports. Ports 61000–61099 are kept for devenv's own forwarding. You are warned when another project forwards the same port, and when a port below 1024 needs extra setup with rootless Podman.

Each port is published on the host's `127.0.0.1`. Apps in the container don't need to listen on `0.0.0.0`: a forwarder in the container passes each port on to the app's `127.0.0.1`, so dev servers that bind to localhost by default (Angular, Vite, ASP.NET) work unchanged. Node is set to prefer IPv4, so `localhost` in Node means `127.0.0.1`.

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

| Setting | Meaning |
| --- | --- |
| `~/.config/devenv/config.json` | Optional. `{"runtime": "podman"}` or `"docker"` picks the container runtime; otherwise devenv uses Podman when it is installed, else Docker. `"containerUser"` names the user in the container (default `dev`). |
| `DEVENV_RUNTIME` | `podman` or `docker`, overriding the above for one command. |
| `~/.config/devenv/projects/<name>.json` | Each project's settings. Change them with `dev config <name>`, then `dev rebuild <name>`. Settings from the old bash version (`<name>.env`) are converted the first time they are read. |
| `~/.local/state/devenv/logs/<name>/` | The full output of every build, setup and removal, the latest ten per project. Errors print the path of their log. |

### Updating a pinned version

[`image/versions`](image/versions) holds every pinned version and its sha256 checksums for arm64 and amd64. Change them with `repo-tools/update-version.sh`:

```sh
repo-tools/update-version.sh                  # list what is pinned
repo-tools/update-version.sh neovim 0.12.7    # pin a tool to another version
repo-tools/update-version.sh ubuntu 24.04     # re-pin the base image tag
repo-tools/update-version.sh dotnet-11 11.0.100   # offer another .NET SDK in dev new
```

Before it changes `image/versions`, it:

1. downloads the release for both architectures and computes their checksums,
2. compares them with the checksums GitHub publishes, for GitHub releases,
3. runs the tool's install script in a container built from the pinned Ubuntu image (`--skip-install-test` skips this).

If any step fails, `image/versions` is left as it was. Run `./install.sh` to build the new pins into `dev`, then apply them to a project with `dev rebuild <name>`.

### Adding a dependency

`repo-tools/add-dependency.sh` adds a tool that `dev new` and `dev config` offer as a yes/no choice. It asks for:

- a name and the label `dev new` shows,
- how it installs: Ubuntu packages, or a release download (an archive or a single executable) with `{version}` and `{arch}` in its URL,
- for an archive, which executables go on the `PATH`,
- a command that proves it works, such as `rg --version`.

It checks every answer: the packages exist in the pinned Ubuntu, both downloads exist and match GitHub's checksums, and the executables are in both archives. Then it installs the tool in a test container and runs the check command. Only when everything passes does it write `image/tools/<name>.sh` and add the tool to `image/versions`, `image/download-urls.sh`, `image/optional-dependencies` and `image/Containerfile`. Pin later versions of it with `repo-tools/update-version.sh <name> <version>`.

Tools that need more than this, such as the .NET SDK channels or Godot's two builds, are written by hand in the same files: the download URL in `image/download-urls.sh`, the install script in `image/tools/`, a `WITH_<NAME>` block in `image/Containerfile`, and a line in `image/optional-dependencies` (`yes-no`, or a comma-separated list of choices).


## Development

```sh
npm install
npm run dev -- new        # run dev from source, here: dev new
npm run check             # type-check
npm run format            # format with Prettier
npm run build             # build dist/dev for this machine
```

`npm run dev` reads `image/`, `container/` and `dotfiles/` straight from the repo, so changes show up without rebuilding.

## Layout

| Path | Purpose |
| --- | --- |
| `src/main.tsx` | Entry point: parses the command line and runs a command, or opens the home screen. |
| `src/cli/` | Command definitions, argument parsing, typo suggestions and the manual pages. |
| `src/commands/` | One file per command, plus `shared/` for what several commands do: connecting to the engine, picking a project, confirming, building a project and opening a shell. |
| `src/engine/` | Choosing Podman or Docker, checking that the engine runs, and the Podman machine. |
| `src/containers/` | Image builds, container creation, setup, fetching the code, and starting, stopping and removing. |
| `src/projects/` | Project settings, names, code sources and ports. |
| `src/resources/` | Finding `image/`, `container/` and `dotfiles/` (in the repo, or unpacked from the binary), and reading the tool catalog. |
| `src/tasks/` | The task runner behind every progress view, and the log files. |
| `src/ui/` | The terminal UI: theme, components (lists, multiselect, text input, confirmation, progress, problems), the project form and the screens. |
| `src/system/` | Platform paths, running processes, finding executables, folders and preferences. |
| `scripts/` | `build.mjs` (the single-executable build), `install.mjs` and `uninstall.mjs`, and the binary's launcher in `sea/`. |
| `install.sh`, `uninstall.sh`, `*.cmd` | Thin wrappers that check for Node.js and run the scripts above. |
| `image/` | What builds the image: `Containerfile`, `versions` (pinned versions and checksums), `download-urls.sh`, `optional-dependencies` (what `dev new` offers, with descriptions), `install-helpers.sh` and one install script per tool in `tools/`. |
| `container/` | What runs inside a container: `entrypoint.sh` (ssh-agent, inner container engine and port forwarders) and `setup.sh` (dotfiles, Neovim, git and SSH). |
| `dotfiles/` | Everything linked into the container's home folder. |
| `repo-tools/` | Tools for maintaining this repo: `update-version.sh` and `add-dependency.sh`, with their shared `pinning.sh`, `install-test.sh` and `shell-helpers.sh`. |

## Troubleshooting

Start with `dev doctor`: it checks everything `dev` depends on and prints the fix for each problem. Every failed step also prints the end of its output and the path of its full log.

| Problem | Fix |
| --- | --- |
| The installer says Node.js is too old | Install Node.js 26 or newer, for example `nvm install 26`, then run `./install.sh` again. |
| `The Podman machine is not running` | Let `dev` start it when it offers, or run the command it prints. |
| A Neovim tool did not install | The warning names it. Read `/tmp/devenv/setup.log` in the container, then fix it with `:Mason` or `:Lazy restore`, or rerun `dev setup <name>`. `csharpier` needs a .NET SDK in the project. |
| A port is already in use | Another program or project uses it on this machine. Stop it, or change the project's ports with `dev config`. |
| Builds or containers get killed | The Podman machine is out of memory. `dev doctor` prints the command that gives it more. |
| The inner container engine misbehaves | Its log is `/tmp/devenv/container-engine.log` in the container. |
| A forwarded port doesn't answer | Check the app is running in the container, then see `/tmp/devenv/port-forwards.log`. |
