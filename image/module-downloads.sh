# A module with versions is installed one version at a time. This writes the module as that
# version sees it: the version's requirements, packages, downloads and path come after the
# module's own, and its environment variables win.
module_version_file() {
  jq --arg id "$2" '
    (((.versions // []) | map(select(.id == $id)) | first)
      // error("the module has no version \($id)")) as $chosen
    | del(.versions, .multipleVersions)
    | .version = $chosen.version
    | .requires = ((.requires // []) + ($chosen.requires // []))
    | .packages = ((.packages // []) + ($chosen.packages // []))
    | .downloads = ((.downloads // []) + ($chosen.downloads // []))
    | .environment = ((.environment // {}) + ($chosen.environment // {}))
    | .path = ((.path // []) + ($chosen.path // []))
    | .versionId = $id
  ' "$1"
}

is_archive() {
  case "$1" in *.tar.gz | *.tgz | *.tar.xz | *.zip) return 0 ;; *) return 1 ;; esac
}

download_count() {
  jq '.downloads // [] | length' "$1"
}

download_field() {
  jq -r --argjson index "$2" ".downloads[\$index]$3 // empty" "$1"
}

download_checksum_algorithm() {
  jq -r --argjson index "$2" '.downloads[$index] | if .sha512 then "sha512" else "sha256" end' "$1"
}

download_checksum() {
  jq -r --argjson index "$2" --arg arch "$3" '.downloads[$index] | (.sha512 // .sha256)[$arch] // empty' "$1"
}

expand_download_text() {
  local module_file=$1 index=$2 architecture=$3 text=$4
  jq -r --argjson index "$index" --arg arch "$architecture" --arg text "$text" '
    .version as $moduleVersion
    | .downloads[$index]
    | (.version // $moduleVersion) as $version
    | (.architectures[$arch] // error("no download for \($arch)")) as $architecture
    | $text
    | gsub("\\{version\\}"; $version)
    | gsub("\\{version:major\\}"; ($version | split(".")[0]))
    | gsub("\\{version:url\\}"; ($version | gsub("\\+"; "%2B")))
    | gsub("\\{version:underscored\\}"; ($version | gsub("\\+"; "_")))
    | gsub("\\{arch\\}"; $architecture)
  ' "$module_file"
}

download_url() {
  expand_download_text "$1" "$2" "$3" "$(download_field "$1" "$2" .url)"
}
