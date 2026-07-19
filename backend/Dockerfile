# Pin the PocketBase version to match the local dev binary. Upgrades are a
# deliberate tag bump here, never a side effect of a rebuild.
FROM ghcr.io/muchobien/pocketbase:0.39.6

COPY pb_hooks /pb_hooks
COPY pb_migrations /pb_migrations

EXPOSE 8090

# CI/branch-protection pipeline test 2026-07-19
