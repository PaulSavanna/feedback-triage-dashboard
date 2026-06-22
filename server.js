const { loadEnvFile } = require('./lib/load-env');

loadEnvFile();

const { createApp } = require('./app');

const PORT = process.env.PORT || 4000;

function startServer(port = PORT) {
  const app = createApp();
  return app.listen(port, () => {
    console.log(`feedback-ops-dashboard running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
};
