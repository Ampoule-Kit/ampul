ARG UBUNTU_IMAGE
FROM ${UBUNTU_IMAGE} AS base

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash-completion ca-certificates curl file git jq less openssh-client procps socat stow \
      sudo unzip wget xz-utils \
 && rm -rf /var/lib/apt/lists/*

COPY image/install-helpers.sh image/module-downloads.sh image/install-module.sh image/create-user.sh /opt/ampul/
