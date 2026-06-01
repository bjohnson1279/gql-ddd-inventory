#!/bin/bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/inventory_test?schema=public"
npx tsc -p tsconfig.benchmark.json
node dist/benchmark_usecase_mock.js
