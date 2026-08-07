#!/bin/sh
set -eu
if [ ! -f /run/secrets/redis_password ]; then
  echo "redis_password secret is missing" >&2
  exit 1
fi
REDIS_PASSWORD="$(cat /run/secrets/redis_password)"
if [ -z "$REDIS_PASSWORD" ]; then
  echo "redis_password secret is empty" >&2
  exit 1
fi
cp /usr/local/etc/redis/redis.conf.template /tmp/redis.stage-a.conf
{
  printf '\n'
  printf 'requirepass %s\n' "$REDIS_PASSWORD"
  printf 'masterauth %s\n' "$REDIS_PASSWORD"
} >> /tmp/redis.stage-a.conf
exec redis-server /tmp/redis.stage-a.conf