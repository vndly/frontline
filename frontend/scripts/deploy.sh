#!/usr/bin/env bash

set -e

# Vite writes straight into ../backend/public (see vite.config.ts)
npm run build

cd ../backend

firebase deploy --only hosting

cd ../frontend
