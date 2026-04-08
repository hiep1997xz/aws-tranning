#!/bin/sh
set -e

echo "Running database migrations..."
npm run db:migrate
echo "Migrations complete. Starting server..."
exec node dist/server.js
