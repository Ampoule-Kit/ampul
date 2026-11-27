# Modules

Every tool ampul can put in a container is a module: a folder here with a `module.json`. ampul itself knows nothing about any one tool. It reads these folders and handles them all the same way, so adding or changing a tool only ever touches this folder.

## Add a module

```sh
npm run modules:add
```

This asks for everything below, pins the download checksums, tests the install in a container, and writes `modules/<id>/module.json` and its place in [`catalog.json`](catalog.json). To do it by hand, create the folder and add its id to a section of `catalog.json`; ampul refuses to start with a folder the catalog does not list.

## Update a module

```sh
npm run modules:outdated                                  # each module's version and the latest one
npm run modules:update-version -- lazygit                 # pin the latest version
npm run modules:update-version -- lazygit 0.67.0          # pin a given version
npm run modules:update-version -- container-engine:compose  # pin one named download
npm run modules:update-version -- --all                   # pin every outdated module to its latest
```

Each update downloads the files for both architectures, records their sha256, compares them with the checksums GitHub publishes where it can, and tests the install in a container before it changes `module.json`. Set `GITHUB_TOKEN` to avoid GitHub's rate limit.

The latest version comes from the module's `latestVersion` when it has one, and otherwise from the latest GitHub release of its download.

## The folder

| File          | When it runs                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| `module.json` | Required. What the module is and how it installs, described below.                                            |
| `install.sh`  | At image build, as root, after the packages and downloads are in place.                                       |
| `config/`     | Linked into the container's home with stow, such as `config/.config/<tool>/` or `config/.bashrc.d/<tool>.sh`. |
| `setup.sh`    | In the container after the config is linked, as the user. `step` and `warn` are available.                    |
| `start.sh`    | Each time the container starts, as the user, for services the tool needs. `$LOG_DIR` is set.                  |

## module.json

| Field                   | Meaning                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`                 | Required. The name shown by `ampul new` and `ampul config`.                                                                                          |
| `description`           | Required. One or two sentences shown with it.                                                                                                        |
| `check`                 | Required. A command that proves the tool works once installed.                                                                                       |
| `version`               | The version its downloads use, unless a download has its own.                                                                                        |
| `latestVersion`         | Where updates find the latest `version`: `{ "url": ..., "match": ... }`, see below.                                                                  |
| `selectedByDefault`     | Whether new projects get it.                                                                                                                         |
| `requires`              | Ids of the modules it needs. They are selected with it and installed before it.                                                                      |
| `mutuallyExclusiveWith` | Ids of modules it can never be selected with. It works both ways, so only one of the two needs to list the other. Selecting one unselects the other. |
| `packages`              | Ubuntu packages to install with apt.                                                                                                                 |
| `downloads`             | Release files to download, verify and unpack, described below.                                                                                       |
| `environment`           | Environment variables for the container. `{home}` becomes the user's home folder.                                                                    |
| `path`                  | Folders to put at the front of `PATH`. `{home}` works here too.                                                                                      |
| `container`             | What the container needs at run time: `privileged: true`, and `volumes` that keep data across rebuilds, described below.                             |
| `portPresets`           | Ports the tool's apps usually listen on, offered on the ports screen when the module is selected, described below.                                   |

### downloads

| Field             | Meaning                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`             | Required. An https URL with `{version}` and `{arch}`. `{version:major}`, `{version:url}` and `{version:underscored}` help with versions such as `25.0.5+2`. |
| `architectures`   | Required. What `{arch}` is for `arm64` and `amd64`.                                                                                                         |
| `sha256`          | The checksum for each architecture. The update and add commands fill it in. `sha512` works instead.                                                         |
| `installTo`       | Required. The folder it is unpacked into. It is emptied first, unless `sharedFolder` is true.                                                               |
| `sharedFolder`    | Set it on every download that installs into the same folder, such as several SDK versions side by side.                                                     |
| `fileName`        | For a single file, the name to save it as.                                                                                                                  |
| `commands`        | Files to link into `/usr/local/bin`: a path in `installTo`, or `{ "path": ..., "as": ... }` to give it another name.                                        |
| `name`, `version` | Give a download its own version, pinned with `<module>:<name>`.                                                                                             |
| `latestVersion`   | Where updates find the latest version of a named download.                                                                                                  |

### latestVersion

```json
"latestVersion": {
  "url": "https://nodejs.org/dist/index.json",
  "match": "\"version\":\"v(26\\.[0-9]+\\.[0-9]+)\""
}
```

The page at `url` is read, and the highest version captured by the regular expression `match` is the latest. Leave `latestVersion` out for a download from GitHub releases: the latest release is used, and its tag is matched against the tag in the download's URL.

### container

```json
"container": {
  "privileged": true,
  "volumes": [
    {
      "name": "engine",
      "path": "/var/lib/containers",
      "contents": "Images and data of the containers run inside the project"
    }
  ]
}
```

A privileged module makes the whole container privileged, and ampul warns about it before creating the project. Each volume is created for the project as `ampul-<project>-<name>`, mounted at `path`, kept across rebuilds and removed with `ampul rm`. `contents` is how `ampul rebuild` and `ampul rm` describe what it holds. Volume names must be unique across all modules.

### portPresets

```json
"portPresets": [
  {
    "id": "my-tool-web",
    "label": "My Tool dev server",
    "port": 5000,
    "lastPort": 5001,
    "section": "Web apps",
    "description": "What listens on these ports."
  }
]
```

`lastPort` makes it a range. Presets are grouped by `section`. Several modules can offer the same preset, such as side-by-side versions of one SDK, as long as every copy is identical.

## Checks

ampul checks the modules when it loads them, and `npm test` does too. It refuses:

- a folder that `catalog.json` does not list, or lists twice
- a requirement that does not exist, or modules that require each other in a circle
- a module that is mutually exclusive with a module that does not exist
- a module that needs, directly or through its requirements, two mutually exclusive modules
- two modules that install to the same folder and could be selected together
- two modules with a volume of the same name
- two copies of a port preset that differ, or two presets with the same label
- a download without a checksum for both architectures
