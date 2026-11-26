# ampul

Portable, containerized developer environments, one command away.

ampul gives every project its own container with the tools it needs, your dotfiles, and your git and SSH setup already in place. Run `ampul new`, answer a few questions, and `ampul start` drops you into a ready-to-use shell. Nothing is installed on your machine and nothing is added to your projects, so you can rebuild, share or throw away an environment without a second thought.

> **ampul** *(noun)*: a variant spelling of *ampoule*, a small sealed vessel that holds exactly one dose, clean and kept apart from everything around it.

That is the idea behind the name: each project lives in its own sealed container, with exactly what it needs and nothing it doesn't.

## Why ampul

- **Your machine stays clean.** Every tool, SDK and setting lives in the container. ampul's own settings live in `~/.config/ampul/`.
- **Rebuilds are repeatable.** Every tool is pinned to a version and checked against its checksum, so a rebuild months from now gives you the same environment.
- **It feels like home.** Your dotfiles, git config, credentials and SSH keys come with you into every container.
- **It guides you.** A terminal UI walks you through each step, shows progress as it builds, and tells you how to fix anything that goes wrong.

## Requirements

- macOS or Linux. Windows builds but is not tested yet.
- [Node.js](https://nodejs.org) 26 or newer, with npm 11 or newer. These are only needed to build ampul; the installed binary carries its own runtime.
- git.
- [Podman](https://podman.io) (recommended) or Docker. On macOS, ampul offers to create or start the Podman machine for you.

Building projects inside a container takes memory. On macOS, give the Podman machine at least 4 GB, or 6 to 8 GB for larger projects. `ampul doctor` checks this and tells you how to change it.

## Install

```sh
git clone git@github.com:MorneVenter/ampul.git
cd ampul
npm run cli:install
```

This builds a single `ampul` binary and installs it to `~/.local/bin/ampul` (on Windows, `%LOCALAPPDATA%\Programs\ampul\ampul.exe`). To install somewhere else, set `AMPUL_BIN_DIR`:

```sh
AMPUL_BIN_DIR=/some/dir npm run cli:install
```

When it finishes, it runs `ampul doctor` to check that your machine is ready. To update ampul, pull the repo and run `npm run cli:install` again.

## Quick start

```sh
ampul new          # create a project, step by step
ampul start api    # open a shell in the api project
ampul              # see all your projects and manage them with single keys
```

`ampul new` asks for:

1. **Your code.** One or more git repositories (HTTPS or SSH), or a folder on your machine. It is cloned or copied into `~/Project` in the container. For a git repository, you can copy only the files git tracks, leaving out `node_modules`, `.env` and other ignored files.
2. **A name**, suggested from your code.
3. **Extra tools**, such as .NET SDKs, Java, Godot, Python or a container engine.
4. **Ports** to reach from your machine at `localhost`. Pick common ones (Angular, Vite, ASP.NET Core, Spring Boot, PostgreSQL, Redis and more) or add your own, such as `3000-3009`.

You can review everything before it builds, and press Esc to go back a step at any time. When it's done, ampul offers to connect you.

> **Your code lives only in the container.** Push your work before running `ampul rebuild` or `ampul rm`, as both replace `~/Project`.

## Commands

| Command                | What it does                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `ampul`                | Shows every project and its status. Enter connects; `s` stops, `e` configures, `r` rebuilds, `x` removes, `n` creates. |
| `ampul new [name]`     | Creates a project.                                                                               |
| `ampul start [name]`   | Starts a project if needed and opens a shell in `~/Project`. Use `-d` to only start it.          |
| `ampul stop [name]`    | Stops a project. Use `--all` to stop every project.                                              |
| `ampul ls`             | Lists your projects, their status, ports and code. Use `--json` for scripts.                     |
| `ampul config [name]`  | Changes a project's code, tools or ports.                                                        |
| `ampul rebuild [name]` | Rebuilds a project with fresh code and config.                                                   |
| `ampul setup [name]`   | Reapplies your dotfiles, tool config, git and SSH without rebuilding.                            |
| `ampul rm [name]`      | Removes a project and everything that belongs to it.                                             |
| `ampul purge`          | Removes every ampul project, container, image and volume.                                        |
| `ampul doctor`         | Checks that your machine is ready and explains how to fix anything that isn't.                   |
| `ampul help [command]` | Shows the manual for ampul or for one command.                                                   |

Leave out the project name and ampul lets you pick from a list. Before deleting anything, ampul shows what will go and asks first. In scripts, pass `--yes` to skip the question.

## What's in the container

Every container runs Ubuntu 24.04 with git, curl, ssh, sudo, jq and bash completion. You choose the rest:

| Selected by default              | Optional                              |
| -------------------------------- | ------------------------------------- |
| Neovim and the tree-sitter CLI   | .NET 6, 8 and 10 SDKs, side by side   |
| lazygit, yazi, zellij, lsd       | Java (Temurin JDK)                    |
| ripgrep, fd, fzf                 | Godot, standard or .NET               |
| Claude Code                      | Python with pip and venv              |
| Node.js and npm, build-essential | Podman, docker CLI and docker compose |

Tools that depend on each other are selected together. For example, Neovim brings Node.js, ripgrep and fd, and Godot .NET brings the .NET 8 SDK.

You work as the user `dev`, with passwordless `sudo` and the same user ID as on your machine.

### Git and SSH

Containers use the git and SSH setup from your machine:

- **git** uses your `~/.gitconfig`, global ignore file and stored credentials. A macOS-only credential helper, such as the keychain, is replaced with an in-memory cache that lasts 8 hours.
- **SSH** uses your keys and config, read-only. Each container runs its own `ssh-agent`, so with `AddKeysToAgent yes` you enter a passphrase once per session.

### Ports

Each port you choose is available on your machine at `localhost`. Your apps don't need to listen on `0.0.0.0`, so dev servers that bind to localhost by default, such as Angular, Vite and ASP.NET, work as they are.

A project can forward up to 100 ports. Ports 61000 to 61099 are reserved for ampul. You are warned when two projects use the same port.

### Containers inside the container

Select the container engine to run Podman, docker and docker compose inside your project. Databases and services started by tools such as Aspire, docker compose or Testcontainers then run inside the project, just as they would on a normal machine. Their images and data are kept across rebuilds and removed with `ampul rm`.

### What survives a rebuild

| Kept                                                   | Replaced                                    |
| ------------------------------------------------------ | ------------------------------------------- |
| Package caches, such as NuGet and npm                  | `~/Project`, with freshly cloned or copied code |
| Images and data of containers run inside the project   | Dotfiles, tool config and installed tools   |
| Project settings                                       | Everything else in the container            |

## Make it yours

### Dotfiles

Your bash profile lives in [`dotfiles/`](dotfiles), and each tool's config lives with its module in [`modules/`](modules), such as `modules/neovim/config/`. To apply a change:

```sh
npm run cli:install    # rebuild ampul with your changes
ampul setup api        # apply them to a running project
```

### Add a tool

```sh
npm run modules:add
```

This asks how the tool installs, checks that the packages or downloads exist and match their checksums, and tests it in a container before adding it. Run `npm run cli:install` afterwards, and the new tool appears in `ampul new` and `ampul config`.

### Update a tool's version

```sh
npm run modules:update-version                    # list every tool and its version
npm run modules:update-version -- neovim 0.12.7   # pin a new version
```

The new version is downloaded, verified and tested before anything changes. Run `npm run cli:install`, then `ampul rebuild <name>` to use it.

## Configuration

| Setting                                | Meaning                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `~/.config/ampul/config.json`          | Optional. Set `"runtime"` to `"podman"` or `"docker"` to choose a runtime, and `"containerUser"` to rename the `dev` user. |
| `AMPUL_RUNTIME`                        | `podman` or `docker`, for a single command.                                                             |
| `~/.config/ampul/projects/<name>.json` | A project's settings. Change them with `ampul config <name>`.                                           |
| `~/.local/state/ampul/logs/<name>/`    | Full logs of the last ten builds, setups and removals for each project.                                 |

## Troubleshooting

Start with `ampul doctor`. It checks everything ampul depends on and tells you how to fix each problem. When a step fails, ampul shows the end of its output and where to find the full log.

| Problem                               | Fix                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| The installer says Node.js is too old | Install Node.js 26 or newer, for example with `nvm install 26`, then run `npm run cli:install` again.  |
| The Podman machine is not running     | Let ampul start it when it offers, or run the command it shows.                                        |
| Builds or containers get killed       | The Podman machine is out of memory. `ampul doctor` shows how to give it more.                         |
| A port is already in use              | Another program or project is using it. Stop it, or change the project's ports with `ampul config`.    |
| A forwarded port doesn't answer       | Check that your app is running, then read `/tmp/ampul/port-forwards.log` in the container.             |
| A Neovim tool didn't install          | Read `/tmp/ampul/setup.log` in the container, then run `:Mason` or `:Lazy restore`, or `ampul setup <name>`. |
| The inner container engine misbehaves | Read `/tmp/ampul/container-engine.log` in the container.                                               |

## Uninstall

```sh
npm run cli:uninstall
```

This offers to remove all your projects first, then deletes the `ampul` binary. Your clone of the repo is left as it is.

## License

[MIT](LICENSE)
