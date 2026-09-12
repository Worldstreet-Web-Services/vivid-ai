#!/usr/bin/env bash
# The sandbox's start command. E2B runs it on boot and waits for :5173.
# Output goes to the log the builder's get_dev_server_logs tool tails.
export VIVID_SANDBOX=e2b CI=1 NO_COLOR=1 FORCE_COLOR=0
cd /home/user/app
exec npm run dev -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/vivid-dev.log 2>&1
