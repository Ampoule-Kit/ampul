apt-get update
apt-get install -y --no-install-recommends /opt/postgres-client/*.deb
rm -rf /var/lib/apt/lists/* /opt/postgres-client
