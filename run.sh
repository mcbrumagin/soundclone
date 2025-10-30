export MICRO_REGISTRY_URL=http://localhost:4000
export ENVIRONMENT=dev
# export DISABLE_ALL_CUSTOM_LOGS=true
# export LOG_LEVEL=info
export LOG_INCLUDE_LINES=true
export LOG_EXCLUDE_FULL_PATH_IN_LOG_LINES=true

export ADMIN_USER=admin
export ADMIN_SECRET=password

if npm list -g | grep -q "nodemon"; then
  nodemon npm start --delay=1
else
  echo "nodemon not found, using npm start"
  npm start
fi
