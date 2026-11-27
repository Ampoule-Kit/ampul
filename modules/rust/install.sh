export RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo
/opt/rustup-init/rustup-init -y --no-modify-path --profile minimal \
  --component clippy,rustfmt,rust-src,rust-analyzer \
  --default-toolchain "$(jq -r .version "$MODULE_FILE")"
/opt/cargo/bin/rustup set auto-self-update disable
rm -rf /opt/rustup-init
chmod -R a+w /opt/rustup /opt/cargo
