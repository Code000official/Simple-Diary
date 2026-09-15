#!/bin/bash
# 旧入口，保留兼容：转发到新的统一管理脚本 sync-server.sh
exec "$(dirname "$(readlink -f "$0")")/sync-server.sh" start
