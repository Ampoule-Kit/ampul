ARG USER_NAME=dev
ARG USER_UID=1000
ARG USER_GID=1000
RUN /opt/ampul/create-user.sh "$USER_NAME" "$USER_UID" "$USER_GID"

ENV SSH_AUTH_SOCK=/tmp/ampul/ssh-agent.sock

COPY container/entrypoint.sh /opt/ampul/entrypoint.sh

USER ${USER_NAME}
WORKDIR /home/${USER_NAME}/home
CMD ["/opt/ampul/entrypoint.sh"]
