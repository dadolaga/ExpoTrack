#!/bin/sh

# The official image sources this script only when initializing an empty PGDATA.
# psql quotes the password as an SQL literal, including special characters.
psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DB_PASSWORD" --set=db_name="$POSTGRES_DB" <<'SQL'
BEGIN;
CREATE ROLE expotrack_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
  PASSWORD :'app_password';
REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO expotrack_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO expotrack_app;
COMMIT;
SQL
