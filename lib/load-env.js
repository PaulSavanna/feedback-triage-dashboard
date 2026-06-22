const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath = path.join(process.cwd(), '.env')) {
  if (process.env.__FEEDBACK_ENV_LOADED === 'true') {
    return;
  }

  process.env.__FEEDBACK_ENV_LOADED = 'true';

  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

module.exports = {
  loadEnvFile,
};
