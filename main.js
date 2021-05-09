const path = require('path');

export async function generateCypressConfig ({configFile, config={}, env={}, projectPath}) {
  projectPath = projectPath || process.PWD;
  const configFilePath = path.join(projectPath, configFile || 'cypress.json');
  let cypressJson = require(configFilePath);
  cypressJson = {...cypressJson, ...config};
  cypressJson.env = {...cypressJson.env, ...env};
  return cypressJson;
}

export async function generateSauceRunnerJson ({sauceBrowsersPath, cypressVersion, region}) {
  const runnerJson = {
    apiVersion: 'v1alpha',
    kind: 'cypress',
  };
  for (const browser of sauceBrowsers) {
    
  }
  return runnerJson;
}