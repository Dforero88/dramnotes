#!/usr/bin/env sh
set -a
if [ -f ./config/runtime.env ]; then
  . ./config/runtime.env
fi
set +a

npm install --omit=dev
npm start
