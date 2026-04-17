#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies"
npm install

echo "[1/4] Running unit tests"
npm run test:unit

echo "[2/4] Running router contract tests"
npm run test:api

echo "[3/4] Running HTTP integration tests"
npm run test:http

echo "[4/4] Running browser E2E tests"
npm run test:e2e

echo "All tests passed"
