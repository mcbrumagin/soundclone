export MICRO_REGISTRY_URL=http://localhost:3000
# export DISABLE_ALL_CUSTOM_LOGS=true

if npm list -g | grep -q "nodemon"; then
  nodemon npm start
else
  echo "nodemon not found, using npm start"
  npm start
fi
