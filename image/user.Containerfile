ARG USER_NAME=dev
ARG USER_UID=1000
ARG USER_GID=1000
RUN /opt/ampul/create-user.sh "$USER_NAME" "$USER_UID" "$USER_GID"

ENV SHELL=/bin/bash \
    SSH_AUTH_SOCK=/tmp/ampul/ssh-agent.sock

COPY container/entrypoint.sh container/port-tunnel.sh container/port-listeners.sh /opt/ampul/

USER ${USER_NAME}
WORKDIR /home/${USER_NAME}/work
CMD ["/opt/ampul/entrypoint.sh"]
