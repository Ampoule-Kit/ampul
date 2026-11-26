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
