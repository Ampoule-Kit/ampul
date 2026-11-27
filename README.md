# ampul

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)
![Node.js 26+](https://img.shields.io/badge/node-%3E%3D26-5FA04E?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Podman](https://img.shields.io/badge/Podman-892CA0?logo=podman&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![Container: Ubuntu 24.04](https://img.shields.io/badge/container-Ubuntu%2024.04-E95420?logo=ubuntu&logoColor=white)

Portable, containerized developer environments, one command away.

ampul gives every project its own container with the tools it needs, your dotfiles, and your git and SSH setup already in place. Run `ampul new`, answer a few questions, and `ampul start` drops you into a ready-to-use shell. Nothing is installed on your machine and nothing is added to your projects, so you can rebuild, share or throw away an environment without a second thought.

> **ampul** _(noun)_: a variant spelling of _ampoule_, a small sealed vessel that holds exactly one dose, clean and kept apart from everything around it.

That is the idea behind the name: each project lives in its own sealed container, with exactly what it needs and nothing it doesn't.

## Why ampul

- **Your machine stays clean.** Every tool, SDK and setting lives in the container. ampul keeps only its own settings in a single [config folder](#platform-notes).
- **Rebuilds are repeatable.** Every tool is pinned to a version and checked against its checksum, so a rebuild months from now gives you the same environment.
- **It feels like home.** Your dotfiles, git config, credentials and SSH keys come with you into every container.
- **It guides you.** A terminal UI walks you through each step, shows progress as it builds, and tells you how to fix anything that goes wrong.

## Requirements

- [Node.js](https://nodejs.org) 26 or newer, with npm 11 or newer. These are only needed to build ampul; the installed binary carries its own runtime.
- git.
- [Podman](https://podman.io) (recommended) or Docker.

ampul runs on macOS, Linux and Windows. See [platform notes](#platform-notes) for how to set up the container engine on yours and where ampul keeps its files.

## Install

```sh
git clone <repository-url> ampul
cd ampul
npm run cli:install
```

This builds a single `ampul` binary and installs it to your user's program folder (see [platform notes](#platform-notes)). To install it somewhere else, set the `AMPUL_BIN_DIR` environment variable to that folder before running the install.

When it finishes, it runs `ampul doctor` to check that your machine is ready. To update ampul, pull the repo and run `npm run cli:install` again.

## Quick start

```sh
ampul new          # create a project, step by step
ampul start api    # open a shell in the api project
ampul              # see all your projects and manage them with single keys
```

`ampul new` asks for:

1. **Your code.** Clone git repositories, use folders already on your machine, or bring your whole home folder along. See [your code](#your-code) for how each one works.
2. **A name**, suggested from your code.
3. **Extra tools**, such as .NET SDKs, Java, Godot, Python or a container engine.
4. **Ports** to reach from your machine at `localhost`. Pick common ones (Angular, Vite, ASP.NET Core, Spring Boot, PostgreSQL, Redis and more) or add your own, such as `3000-3009`.

You can review everything before it builds, and press Esc to go back a step at any time. When it's done, ampul offers to connect you.

## Your code

Your code is in `~/home` inside the container, and every shell starts there. You choose how it gets there:

| Option                 | What you get in the container                                     | Good for                                                      |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Clone git repositories | A fresh clone of each repository in `~/home/<repository name>`    | A clean start, or code you don't have on your machine yet     |
| Mount folders          | Each folder you pick from your machine, in `~/home/<folder name>` | Repositories and projects you already work on                 |
| Pass-through           | Your whole home folder from your machine, as `~/home`             | Reaching all your own folders, as if you were on your machine |

**Cloned repositories live only in the container.** Push your work before running `ampul rebuild` or `ampul rm`, as both throw the clones away and clone them again from scratch.

**Mounted folders stay on your machine.** The container works on the real folders, so a change on either side shows up on the other straight away. Rebuilding or removing a project never deletes them.

**Pass-through keeps the container's own setup.** Your home folder appears as `~/home`, not in place of the container's home folder, so the container still uses its own dotfiles and tool config. Your hidden folders, such as `.ssh` and `.config`, are visible inside `~/home` too.

## Commands

| Command                | What it does                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ampul`                | Shows every project and its status. Enter connects; `s` stops, `e` configures, `r` rebuilds, `x` removes, `n` creates. |
| `ampul new [name]`     | Creates a project.                                                                                                     |
| `ampul start [name]`   | Starts a project if needed and opens a shell in `~/home`. Use `-d` to only start it.                                   |
| `ampul stop [name]`    | Stops a project. Use `--all` to stop every project.                                                                    |
| `ampul ls`             | Lists your projects, their status, ports and code. Use `--json` for scripts.                                           |
| `ampul config [name]`  | Changes where a project's code comes from, its tools or its ports.                                                     |
| `ampul rebuild [name]` | Rebuilds a project with fresh config, cloning its repositories again.                                                  |
| `ampul setup [name]`   | Reapplies your dotfiles, tool config, git and SSH without rebuilding.                                                  |
| `ampul rm [name]`      | Removes a project and everything that belongs to it. Mounted folders on your machine are kept.                         |
| `ampul purge`          | Removes every ampul project, container, image and volume.                                                              |
| `ampul doctor`         | Checks that your machine is ready and explains how to fix anything that isn't.                                         |
| `ampul help [command]` | Shows the manual for ampul or for one command.                                                                         |

Leave out the project name and ampul lets you pick from a list. Before deleting anything, ampul shows what will go and asks first. In scripts, pass `--yes` to skip the question.

## What's in the container

Every container runs Ubuntu 24.04 with git, curl, ssh, sudo, jq and bash completion, whatever system you run ampul on. You choose the rest:

| Tool             | Category       | Version                       | Default | Notes                                                                                                                          |
| ---------------- | -------------- | ----------------------------- | :-----: | ------------------------------------------------------------------------------------------------------------------------------ |
| Neovim           | Editor         | 0.12.6                        |   Yes   | NvChad, with language servers for TypeScript, ESLint and C#. Brings Node.js, tree-sitter CLI, ripgrep, fd and build-essential. |
| tree-sitter CLI  | Editor         | 0.27.2                        |   Yes   | Builds Neovim's syntax parsers. Brings build-essential.                                                                        |
| lazygit          | Terminal tools | 0.66.3                        |   Yes   | Terminal UI for git. Start it with `lg`.                                                                                       |
| Yazi             | Terminal tools | 26.9.1                        |   Yes   | Terminal file manager. Start it with `y`.                                                                                      |
| Zellij           | Terminal tools | 0.46.1                        |   Yes   | Terminal multiplexer. `z` attaches to the `DEV` session.                                                                       |
| lsd              | Terminal tools | 1.2.0                         |   Yes   | `ls` with colours and icons. `ls` runs `lsd -Alh`.                                                                             |
| ripgrep          | Terminal tools | Ubuntu package                |   Yes   | Fast recursive search, `rg`.                                                                                                   |
| fd               | Terminal tools | Ubuntu package                |   Yes   | A fast, friendly `find`.                                                                                                       |
| fzf              | Terminal tools | Ubuntu package                |   Yes   | Fuzzy finder.                                                                                                                  |
| Claude Code      | AI             | 2.1.332                       |   Yes   | Coding agent for the terminal. Start it with `claude`.                                                                         |
| Node.js          | Languages      | 26.13.1                       |   Yes   | With npm.                                                                                                                      |
| build-essential  | Languages      | Ubuntu package                |   Yes   | gcc, g++ and make, for native npm packages and Python wheels.                                                                  |
| Python           | Languages      | Ubuntu package                |   No    | Python 3 with pip, venv and development headers.                                                                               |
| Java (Temurin)   | Languages      | 25.0.5.1+2                    |   No    | Eclipse Temurin JDK with `JAVA_HOME` set.                                                                                      |
| .NET 10 SDK      | .NET           | 10.0.404                      |   No    | Installs side by side with other .NET SDKs. NuGet cache kept across rebuilds.                                                  |
| .NET 8 SDK       | .NET           | 8.0.428                       |   No    | Installs side by side with other .NET SDKs. NuGet cache kept across rebuilds.                                                  |
| .NET 6 SDK       | .NET           | 6.0.428                       |   No    | Installs side by side with other .NET SDKs. NuGet cache kept across rebuilds.                                                  |
| Godot            | Game engines   | 4.7.2-stable                  |   No    | For GDScript projects. Pick this or Godot (.NET), not both.                                                                    |
| Godot (.NET)     | Game engines   | 4.7.2-stable                  |   No    | C# scripting. Brings the .NET 8 SDK.                                                                                           |
| Container engine | Containers     | docker 29.10.1, compose 5.8.0 |   No    | Podman (Ubuntu package) with the docker CLI and compose. The container runs privileged.                                        |

Selecting a tool also selects the tools it brings, so they are installed together.

You work as the user `dev`, with passwordless `sudo`.

### Git and SSH

Containers use the git and SSH setup from your home folder (`~`):

- **git** uses your `~/.gitconfig`, global ignore file and stored credentials. If your credential helper can't run inside the container, such as one tied to your system's keychain, it is replaced with an in-memory cache that lasts 8 hours.
- **SSH** uses your keys and config from `~/.ssh`, read-only. Each container runs its own `ssh-agent`, so with `AddKeysToAgent yes` you enter a passphrase once per session.

### Ports

Each port you choose is available on your machine at `localhost`. Your apps don't need to listen on `0.0.0.0`, so dev servers that bind to localhost by default, such as Angular, Vite and ASP.NET, work as they are.

A project can forward up to 100 ports. Ports 61000 to 61099 are reserved for ampul. You are warned when two projects use the same port.

### Containers inside the container

Select the container engine to run Podman, docker and docker compose inside your project. Databases and services started by tools such as Aspire, docker compose or Testcontainers then run inside the project, just as they would on a normal machine. Their images and data are kept across rebuilds and removed with `ampul rm`.

### What survives a rebuild

| Kept                                                 | Replaced                                    |
| ---------------------------------------------------- | ------------------------------------------- |
| Package caches, such as NuGet and npm                | Cloned repositories, which are cloned again |
| Mounted folders, which stay on your machine          | Dotfiles, tool config and installed tools   |
| Images and data of containers run inside the project | Everything else in the container            |
| Project settings                                     |                                             |

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

ampul reads these settings from its [config folder](#platform-notes):

| Setting                | Meaning                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `config.json`          | Optional. Set `"runtime"` to `"podman"` or `"docker"` to choose a runtime, and `"containerUser"` to rename the `dev` user. |
| `projects/<name>.json` | A project's settings. Change them with `ampul config <name>`.                                                              |

To choose a runtime for a single command, set the `AMPUL_RUNTIME` environment variable to `podman` or `docker`.

## Platform notes

Everything above works the same on every system. The differences are in how you set up the container engine, which folders it can mount, and where ampul keeps its files. Logs hold the last ten builds, setups and removals for each project.

### macOS

- **Podman** runs containers inside a Linux virtual machine, called the Podman machine. Install it with `brew install podman`; ampul offers to create and start the machine for you.
- **Memory:** builds need it, so give the Podman machine at least 4 GB, or 6 to 8 GB for larger projects. `ampul doctor` checks this and shows the command to change it.
- **Docker:** use Docker Desktop or Colima, and make sure it is running before you use ampul.
- **Mounted folders:** Podman and Docker can see the folders in your home folder out of the box. To mount a folder somewhere else, such as an external drive under `/Volumes`, add it to the shared folders in their settings first. ampul warns you when you pick such a folder, and tells you how to share it if the container can't see it.

| What           | Location                                                       |
| -------------- | -------------------------------------------------------------- |
| `ampul` binary | `~/.local/bin`                                                 |
| Config folder  | `~/.config/ampul`, or `$XDG_CONFIG_HOME/ampul`                 |
| Logs           | `~/.local/state/ampul/logs/<name>`, or under `$XDG_STATE_HOME` |

### Linux

- **Podman** runs natively, with no virtual machine. Install it from your distribution, for example `sudo apt install podman`.
- **Docker:** install [Docker Engine](https://docs.docker.com/engine/install/). If ampul says Docker refused the connection, add yourself to the `docker` group with `sudo usermod -aG docker $USER`, then log out and back in.

File locations are the same as on macOS.

### Windows

- **Podman:** install [Podman Desktop](https://podman.io). Like on macOS, it runs containers inside a Podman machine, which ampul offers to create and start. The same memory advice applies.
- **Docker:** use Docker Desktop, and make sure it is running before you use ampul.
- **Mounted folders** can be on any drive that is part of your computer, such as `C:\Users\you\code`. Network drives can't be mounted.

| What           | Location                           |
| -------------- | ---------------------------------- |
| `ampul` binary | `%LOCALAPPDATA%\Programs\ampul`    |
| Config folder  | `%APPDATA%\ampul`                  |
| Logs           | `%LOCALAPPDATA%\ampul\logs\<name>` |

## Troubleshooting

Start with `ampul doctor`. It checks everything ampul depends on and tells you how to fix each problem. When a step fails, ampul shows the end of its output and where to find the full log.

| Problem                               | Fix                                                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| The installer says Node.js is too old | Install Node.js 26 or newer, for example with your Node.js version manager, then run `npm run cli:install` again. |
| The container engine is not running   | Let ampul start the Podman machine when it offers, or run the command `ampul doctor` shows.                       |
| Builds or containers get killed       | The container engine is out of memory. `ampul doctor` shows how to give the Podman machine more.                  |
| A port is already in use              | Another program or project is using it. Stop it, or change the project's ports with `ampul config`.               |
| A forwarded port doesn't answer       | Check that your app is running, then read `/tmp/ampul/port-forwards.log` in the container.                        |
| A Neovim tool didn't install          | Read `/tmp/ampul/setup.log` in the container, then run `:Mason` or `:Lazy restore`, or `ampul setup <name>`.      |
| The container cannot see a folder     | ampul tells you how to share it with Podman or Docker on your system. See [platform notes](#platform-notes).      |
| A mounted folder no longer exists     | You moved or deleted it. Point the project at its new place with `ampul config`, then run `ampul rebuild`.        |
| The inner container engine misbehaves | Read `/tmp/ampul/container-engine.log` in the container.                                                          |

## Uninstall

```sh
npm run cli:uninstall
```

This offers to remove all your projects first, then deletes the `ampul` binary. Your clone of the repo is left as it is.

## License

[MIT](LICENSE)
