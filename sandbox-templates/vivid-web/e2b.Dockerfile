# The vivid-web sandbox: the Vite + React + Tailwind + shadcn template with
# node_modules installed and git initialised, so a sandbox boots straight
# into a working dev server. Built by template.py, not by docker.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# E2B runs commands as `user`; the app must be writable by it.
RUN id -u user >/dev/null 2>&1 || useradd -m -u 1000 -s /bin/bash user

WORKDIR /home/user/app
COPY --chown=user:user package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY --chown=user:user . .
RUN chown -R user:user /home/user/app && rm -f e2b.Dockerfile template.py README.md

USER user
RUN git init -q -b main \
    && git config user.name Vivid && git config user.email builder@vivid \
    && git add -A && git commit -q -m template
