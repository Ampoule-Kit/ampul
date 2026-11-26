ARG USER_NAME=dev
ARG USER_UID=1000
ARG USER_GID=1000
RUN /opt/devenv/create-user.sh "$USER_NAME" "$USER_UID" "$USER_GID"

ENV SSH_AUTH_SOCK=/tmp/devenv/ssh-agent.sock

COPY container/entrypoint.sh /opt/devenv/entrypoint.sh

USER ${USER_NAME}
WORKDIR /home/${USER_NAME}/Project
CMD ["/opt/devenv/entrypoint.sh"]
