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

- **Your machine stays clean.** Every tool, SDK and setting lives in the container. On your machine, ampul keeps only its [settings](#configuration), your dotfiles and the settings of each project.
- **Rebuilds are repeatable.** Every tool is pinned to a version and checked against its checksum, so a rebuild months from now gives you the same environment.
- **It feels like home.** Your dotfiles, git config, credentials, SSH keys and time zone come with you into every container.
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

The first time ampul runs, it asks which container runtime to use and what to call your user in the containers, and saves the answers in [`settings.json`](#settingsjson).

## Quick start

```sh
ampul new          # create a project, step by step
ampul start api    # open a shell in the api project
ampul              # see all your projects and manage them with single keys
```

`ampul new` asks for:

1. **Your code.** Clone git repositories, use folders already on your machine, or bring your whole home folder along. See [your code](#your-code) for how each one works.
2. **A name**, suggested from your code.
3. **Extra tools**, such as Go, Rust, .NET SDKs, Java, cloud command lines, database clients or a container engine.

Ports need no answer: every port an app listens on in the container is [forwarded to your machine](#ports) on its own. You can review everything before it builds, and press Esc to go back a step at any time. When it's done, ampul offers to connect you.

## Your code

Your code is in `~/work` inside the container, and every shell starts there. You choose how it gets there:

| Option                 | What you get in the container                                     | Good for                                                      |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Clone git repositories | A fresh clone of each repository in `~/work/<repository name>`    | A clean start, or code you don't have on your machine yet     |
| Mount folders          | Each folder you pick from your machine, in `~/work/<folder name>` | Repositories and projects you already work on                 |
| Pass-through           | Your whole home folder from your machine, as `~/work`             | Reaching all your own folders, as if you were on your machine |

**Cloned repositories live only in the container.** Push your work before running `ampul rebuild` or `ampul rm`, as both throw the clones away and clone them again from scratch.

**Mounted folders stay on your machine.** The container works on the real folders, so a change on either side shows up on the other straight away. Rebuilding or removing a project never deletes them.

**Pass-through keeps the container's own setup.** Your home folder appears as `~/work`, not in place of the container's home folder, so the container still uses your [ampul dotfiles](#dotfiles). Your hidden folders, such as `.ssh` and `.config`, are visible inside `~/work` too.

## Commands

| Command                | What it does                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ampul`                | Shows every project and its status. Enter connects; `s` stops, `e` configures, `r` rebuilds, `x` removes, `n` creates. |
| `ampul new [name]`     | Creates a project.                                                                                                     |
| `ampul start [name]`   | Starts a project if needed and opens a shell in `~/work`. Use `-d` to only start it.                                   |
| `ampul stop [name]`    | Stops a project. Use `--all` to stop every project.                                                                    |
| `ampul ls`             | Lists your projects, their status, forwarded ports and code. Use `--json` for scripts.                                 |
| `ampul config [name]`  | Changes where a project's code comes from or its tools.                                                                |
| `ampul rebuild [name]` | Rebuilds a project with fresh config, cloning its repositories again.                                                  |
| `ampul setup [name]`   | Reapplies your dotfiles, git and SSH without rebuilding.                                                               |
| `ampul rm [name]`      | Removes a project and everything that belongs to it. Mounted folders on your machine are kept.                         |
| `ampul purge`          | Removes every ampul project, container, image and volume.                                                              |
| `ampul doctor`         | Checks that your machine is ready and explains how to fix anything that isn't.                                         |
| `ampul help [command]` | Shows the manual for ampul or for one command.                                                                         |

Leave out the project name and ampul lets you pick from a list. Before deleting anything, ampul shows what will go and asks first. In scripts, pass `--yes` to skip the question.

## What's in the container

Every container runs Ubuntu 24.04 with git, curl, ssh, sudo, jq and bash completion, whatever system you run ampul on. You choose the rest:

| Tool                 | Category                 | Version                       | Default | Notes                                                                                                                                                           |
| -------------------- | ------------------------ | ----------------------------- | :-----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neovim               | Editor                   | 0.12.6                        |   Yes   | Installs the plugins pinned in your Neovim config. Brings Node.js, tree-sitter CLI, ripgrep, fd and build-essential.                                            |
| tree-sitter CLI      | Editor                   | 0.27.2                        |   Yes   | Builds Neovim's syntax parsers. Brings build-essential.                                                                                                         |
| Helix                | Editor                   | 25.07.1                       |   No    | Modal editor, `hx`, with language server support built in.                                                                                                      |
| lazygit              | Terminal tools           | 0.66.3                        |   Yes   | Terminal UI for git.                                                                                                                                            |
| Yazi                 | Terminal tools           | 26.9.1                        |   Yes   | Terminal file manager.                                                                                                                                          |
| Zellij               | Terminal tools           | 0.46.1                        |   Yes   | Terminal multiplexer.                                                                                                                                           |
| tmux                 | Terminal tools           | Ubuntu package                |   No    | Terminal multiplexer, if you prefer it to Zellij.                                                                                                               |
| lsd                  | Terminal tools           | 1.2.0                         |   Yes   | `ls` with colours and icons.                                                                                                                                    |
| ripgrep              | Terminal tools           | Ubuntu package                |   Yes   | Fast recursive search, `rg`.                                                                                                                                    |
| fd                   | Terminal tools           | Ubuntu package                |   Yes   | A fast, friendly `find`.                                                                                                                                        |
| fzf                  | Terminal tools           | Ubuntu package                |   Yes   | Fuzzy finder.                                                                                                                                                   |
| yq                   | Terminal tools           | 4.54.3                        |   No    | jq for YAML, JSON, TOML and XML.                                                                                                                                |
| Claude Code          | AI                       | 2.1.332                       |   Yes   | Coding agent for the terminal. Start it with `claude`.                                                                                                          |
| Codex CLI            | AI                       | 0.172.0                       |   No    | OpenAI's coding agent. Start it with `codex`.                                                                                                                   |
| Gemini CLI           | AI                       | 0.71.1                        |   No    | Google's coding agent. Start it with `gemini`. Brings Node.js.                                                                                                  |
| Node.js              | Languages                | 26.13.1                       |   Yes   | With npm.                                                                                                                                                       |
| build-essential      | Languages                | Ubuntu package                |   Yes   | gcc, g++ and make, for native npm packages and Python wheels.                                                                                                   |
| Python               | Languages                | Ubuntu package                |   No    | Python 3 with pip, venv and development headers.                                                                                                                |
| Java (Temurin)       | Languages                | 25.0.5.1+2                    |   No    | Eclipse Temurin JDK with `JAVA_HOME` set.                                                                                                                       |
| Go                   | Languages                | 1.27.4                        |   No    | Module cache kept across rebuilds. `go install` puts tools in `~/go/bin`.                                                                                       |
| Rust                 | Languages                | 1.100.0, rustup 1.29.3        |   No    | With clippy, rustfmt and rust-analyzer. Brings build-essential.                                                                                                 |
| Kotlin               | Languages                | 2.4.21                        |   No    | The `kotlinc` compiler. Brings Java.                                                                                                                            |
| Zig                  | Languages                | 0.17.1                        |   No    | Also a C and C++ compiler, with `zig cc`.                                                                                                                       |
| Bun                  | Languages                | 1.4.5                         |   No    | JavaScript runtime and package manager, `bun` and `bunx`.                                                                                                       |
| pnpm                 | Build tools              | 12.23.0                       |   No    | Node.js package manager. Brings Node.js.                                                                                                                        |
| uv                   | Build tools              | 0.13.10                       |   No    | Python package and project manager, `uv` and `uvx`. Installs its own Python versions.                                                                           |
| Maven                | Build tools              | 3.10.2                        |   No    | Brings Java.                                                                                                                                                    |
| Gradle               | Build tools              | 9.9.2                         |   No    | For projects without a Gradle wrapper, and for `gradle init`. Brings Java.                                                                                      |
| CMake and Ninja      | Build tools              | cmake 4.5.1, ninja 1.13.2     |   No    | For C and C++ projects. Brings build-essential.                                                                                                                 |
| .NET 11 SDK          | .NET                     | 11.0.100                      |   No    | Installs side by side with other .NET SDKs. NuGet cache kept across rebuilds. Trusts the ASP.NET Core dev certificate made by `dotnet dev-certs https --trust`. |
| .NET 10 SDK          | .NET                     | 10.0.404                      |   No    | Installs side by side with other .NET SDKs. NuGet cache kept across rebuilds. Trusts the ASP.NET Core dev certificate made by `dotnet dev-certs https --trust`. |
| .NET 8 SDK           | .NET                     | 8.0.428                       |   No    | Installs side by side with other .NET SDKs. NuGet cache kept across rebuilds. Trusts the ASP.NET Core dev certificate made by `dotnet dev-certs https --trust`. |
| .NET 6 SDK           | .NET                     | 6.0.428                       |   No    | Installs side by side with other .NET SDKs. NuGet cache kept across rebuilds. Trusts the ASP.NET Core dev certificate made by `dotnet dev-certs https --trust`. |
| kubectl              | Cloud and infrastructure | 1.37.3                        |   No    | Kubernetes command line.                                                                                                                                        |
| k3d                  | Cloud and infrastructure | 5.9.0                         |   No    | Local k3s Kubernetes clusters in containers. Brings the container engine and kubectl.                                                                           |
| Terraform            | Cloud and infrastructure | 1.17.2                        |   No    | Infrastructure as code. Update checks are turned off.                                                                                                           |
| Ansible              | Cloud and infrastructure | 15.0.0, core 2.22.0           |   No    | With the community collections, on its own Python 3.14. Brings uv.                                                                                              |
| Azure CLI            | Cloud and infrastructure | 2.93.0                        |   No    | The `az` command. Telemetry is turned off.                                                                                                                      |
| AWS CLI              | Cloud and infrastructure | 2.42.4                        |   No    | The `aws` command, version 2.                                                                                                                                   |
| PostgreSQL client    | Databases                | 19.0                          |   No    | `psql`, `pg_dump` and `pg_restore`, from the PostgreSQL project's packages.                                                                                     |
| MongoDB Shell        | Databases                | 2.14.3                        |   No    | The `mongosh` shell.                                                                                                                                            |
| Playwright libraries | Testing                  | Playwright 1.65.1             |   No    | System libraries for Playwright's browsers. Your project's Playwright downloads the browsers into `~/.cache`. Brings Node.js.                                   |
| Godot                | Game engines             | 4.7.2-stable                  |   No    | For GDScript projects. Pick this or Godot (.NET), not both.                                                                                                     |
| Godot (.NET)         | Game engines             | 4.7.2-stable                  |   No    | C# scripting. Brings the .NET 8 SDK.                                                                                                                            |
| Blender              | 3D                       | Ubuntu package                |   No    | Headless rendering and Python scripting with `blender -b`. Built without OpenImageDenoise on arm64, so turn off Cycles denoising there.                         |
| Container engine     | Containers               | docker 29.10.1, compose 5.8.0 |   No    | Podman (Ubuntu package) with the docker CLI and compose. The container runs privileged.                                                                         |

Selecting a tool also selects the tools it brings, so they are installed together.

You work as the user `dev`, or the `containerUser` in your [settings](#settingsjson), with passwordless `sudo`.

### Git and SSH

Containers use the git and SSH setup from your home folder (`~`):

- **git** uses your `~/.gitconfig`, global ignore file and stored credentials. If your credential helper can't run inside the container, such as one tied to your system's keychain, it is replaced with an in-memory cache that lasts 8 hours.
- **SSH** uses your keys and config from `~/.ssh`, read-only. Each container runs its own `ssh-agent`, so with `AddKeysToAgent yes` you enter a passphrase once per session.

### Ports

Every port an app listens on in the container is available on your machine at `localhost`, under the same number, as soon as the app starts listening. When the app stops, so does the forward. There is nothing to choose up front, so tools that pick their ports at random, such as Aspire, work as they are, and links they show, such as those in the Aspire dashboard, open on your machine. Your apps don't need to listen on `0.0.0.0`, so dev servers that bind to localhost by default, such as Angular, Vite and ASP.NET, work as they are too.

Ports are forwarded while the project runs: `ampul start` begins and `ampul stop` ends it. `ampul ls` shows which ports are forwarded right now. Behind it, a small ampul process for each running project watches the ports in the container and reaches them through a single port the container publishes on your machine's loopback address.

- Ports below 1024 aren't forwarded, and neither is port 61000, which ampul uses inside the container.
- A port that another program on your machine already uses isn't forwarded. `ampul ls` shows it as in use here, and ampul forwards it as soon as it is free. When two running projects use the same port, the one that listened first keeps it.
- To keep a port inside the container, add it to [`ignoredPorts`](#settingsjson).

### Containers inside the container

Select the container engine to run Podman, docker and docker compose inside your project. Databases and services started by tools such as Aspire, docker compose or Testcontainers then run inside the project, just as they would on a normal machine, and the ports they publish are forwarded to your machine like any other. Their images and data are kept across rebuilds and removed with `ampul rm`.

### What survives a rebuild

| Kept                                                 | Replaced                                    |
| ---------------------------------------------------- | ------------------------------------------- |
| Package caches in `~/.cache`                         | Cloned repositories, which are cloned again |
| Mounted folders, which stay on your machine          | Installed tools, and links to your dotfiles |
| Images and data of containers run inside the project | Everything else in the container            |
| Project settings                                     |                                             |

## Make it yours

### Dotfiles

ampul ships no dotfiles. Yours live in `~/.config/ampul/dotfiles`, laid out exactly like a home folder: each file in it is linked into the home folder of every container, at the same place.

| On your machine                                  | In the container          |
| ------------------------------------------------ | ------------------------- |
| `~/.config/ampul/dotfiles/.bashrc`               | `~/.bashrc`               |
| `~/.config/ampul/dotfiles/.config/nvim/init.lua` | `~/.config/nvim/init.lua` |

Every project gets all of your dotfiles, whichever tools it has. Your file takes the place of the one Ubuntu puts in the home folder, such as `.bashrc`; where you have none, Ubuntu's stays. Tools with a setup step use your config for it: with a Neovim config, setup installs the plugins pinned in its `lazy-lock.json`.

To apply a change to a running project:

```sh
ampul setup api
```

### Add a tool

```sh
npm run modules:add
```

This asks how the tool installs, checks that the packages or downloads exist and match their checksums, and tests it in a container before adding it. Run `npm run cli:install` afterwards, and the new tool appears in `ampul new` and `ampul config`.

A tool is a folder in [`modules/`](modules) and nothing else: ampul has no code for any one tool. What it requires, what it can't be selected with, what it installs, and what the container needs to run it are all fields of its `module.json`, described in [`modules/README.md`](modules/README.md).

### Update a tool's version

```sh
npm run modules:outdated                          # every tool, its version and the latest one
npm run modules:update-version -- neovim          # pin the latest version
npm run modules:update-version -- neovim 0.12.7   # pin a given version
npm run modules:update-version -- --all           # pin every outdated tool to its latest
```

The new version is downloaded, its checksums are recorded and verified, and it is tested in a container before anything changes. Run `npm run cli:install`, then `ampul rebuild <name>` to use it.

## Configuration

| Path                            | What it holds                                                 |
| ------------------------------- | ------------------------------------------------------------- |
| `~/.config/ampul/settings.json` | Your settings, described below.                               |
| `~/.config/ampul/dotfiles/`     | Your [dotfiles](#dotfiles).                                   |
| `~/.ampul/projects/<name>.json` | A project's settings. Change them with `ampul config <name>`. |

`~/.config/ampul` holds nothing about any one project, so you can keep it in a git repository and bring the same settings and dotfiles to every machine. Project settings stay apart in `~/.ampul/projects`. [Platform notes](#platform-notes) list where these folders are on each system.

### settings.json

ampul writes every setting into the file, with its current value:

```json
{
  "ampulVersion": "1.0.3",
  "runtime": "auto",
  "containerUser": "dev",
  "ignoredPorts": []
}
```

| Setting         | Meaning                                                                                                                   | Default |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ------- |
| `ampulVersion`  | The version of ampul that last wrote the file. ampul keeps it up to date.                                                 |         |
| `runtime`       | `auto` uses Podman when it is installed, otherwise Docker. `podman` or `docker` always uses that one.                     | `auto`  |
| `containerUser` | Your user in the containers: lowercase letters, digits, `-` and `_`. Run `ampul rebuild` for a project to use a new name. | `dev`   |
| `ignoredPorts`  | Ports that are never [forwarded](#ports) to your machine, such as `[9229]`. Applies to projects started after the change. | `[]`    |

ampul checks the file every time it starts. A file that isn't JSON, a setting it doesn't know or a value of the wrong type stops it with a message saying what to fix. A setting you remove comes back with its default.

After an update, ampul reads the file as it is and, when it still fits, records the new version in it. When a setting has changed in a way the file no longer fits, ampul says the file does not work with this version and lists what to fix. Delete the file to answer the first-run questions again.

To choose a runtime for a single command, set the `AMPUL_RUNTIME` environment variable to `podman` or `docker`.

## Platform notes

Everything above works the same on every system. The differences are in how you set up the container engine, which folders it can mount, and where ampul keeps its files. Logs hold the last ten builds, setups, removals and port forwarding runs for each project.

### macOS

- **Podman** runs containers inside a Linux virtual machine, called the Podman machine. Install it with `brew install podman`; ampul offers to create and start the machine for you.
- **Memory:** builds need it, so give the Podman machine at least 4 GB, or 6 to 8 GB for larger projects. `ampul doctor` checks this and shows the command to change it.
- **Docker:** use Docker Desktop or Colima, and make sure it is running before you use ampul.
- **Mounted folders:** Podman and Docker can see the folders in your home folder out of the box. To mount a folder somewhere else, such as an external drive under `/Volumes`, add it to the shared folders in their settings first. ampul warns you when you pick such a folder, and tells you how to share it if the container can't see it.

| What             | Location                                                       |
| ---------------- | -------------------------------------------------------------- |
| `ampul` binary   | `~/.local/bin`                                                 |
| Config folder    | `~/.config/ampul`, or `$XDG_CONFIG_HOME/ampul`                 |
| Project settings | `~/.ampul/projects`                                            |
| Logs             | `~/.local/state/ampul/logs/<name>`, or under `$XDG_STATE_HOME` |

### Linux

- **Podman** runs natively, with no virtual machine. Install it from your distribution, for example `sudo apt install podman`.
- **Docker:** install [Docker Engine](https://docs.docker.com/engine/install/). If ampul says Docker refused the connection, add yourself to the `docker` group with `sudo usermod -aG docker $USER`, then log out and back in.

File locations are the same as on macOS.

### Windows

- **Podman:** install [Podman Desktop](https://podman.io). Like on macOS, it runs containers inside a Podman machine, which ampul offers to create and start. The same memory advice applies.
- **Docker:** use Docker Desktop, and make sure it is running before you use ampul.
- **Mounted folders** can be on any drive that is part of your computer, such as `C:\Users\you\code`. Network drives can't be mounted.

| What             | Location                           |
| ---------------- | ---------------------------------- |
| `ampul` binary   | `%LOCALAPPDATA%\Programs\ampul`    |
| Config folder    | `%USERPROFILE%\.config\ampul`      |
| Project settings | `%USERPROFILE%\.ampul\projects`    |
| Logs             | `%LOCALAPPDATA%\ampul\logs\<name>` |

## Troubleshooting

Start with `ampul doctor`. It checks everything ampul depends on and tells you how to fix each problem. When a step fails, ampul shows the end of its output and where to find the full log.

| Problem                               | Fix                                                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| The installer says Node.js is too old | Install Node.js 26 or newer, for example with your Node.js version manager, then run `npm run cli:install` again. |
| The container engine is not running   | Let ampul start the Podman machine when it offers, or run the command `ampul doctor` shows.                       |
| Builds or containers get killed       | The container engine is out of memory. `ampul doctor` shows how to give the Podman machine more.                  |
| A port shows as in use here           | Another program or project on your machine uses it. Stop that one, and ampul forwards the port within seconds.    |
| A port isn't forwarded                | Check that your app runs, then read the project's `ports` log and `/tmp/ampul/port-forwards.log` inside.          |
| A Neovim tool didn't install          | Read `/tmp/ampul/setup.log` in the container, then run `:Mason` or `:Lazy restore`, or `ampul setup <name>`.      |
| Your dotfiles could not be linked     | Read `/tmp/ampul/setup.log` in the container. It names the file or folder in the way.                             |
| settings.json is not valid            | Fix what the message lists, or delete the file and answer the first-run questions again.                          |
| The container cannot see a folder     | ampul tells you how to share it with Podman or Docker on your system. See [platform notes](#platform-notes).      |
| A mounted folder no longer exists     | You moved or deleted it. Point the project at its new place with `ampul config`, then run `ampul rebuild`.        |
| The inner container engine misbehaves | Read `/tmp/ampul/container-engine.log` in the container.                                                          |

## Uninstall

```sh
npm run cli:uninstall
```

This offers to remove all your projects first, then deletes the `ampul` binary. Your settings and dotfiles in `~/.config/ampul` and your clone of the repo are left as they are.

## License

[MIT](LICENSE)
