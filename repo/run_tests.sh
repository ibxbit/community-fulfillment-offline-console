#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies"
npm install

echo "[1/2] Running unit tests"
npm run test:unit

echo "[2/2] Running API tests"
npm run test:api

echo "All tests passed"
