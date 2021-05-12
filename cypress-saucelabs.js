#!/usr/bin/env node
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

yargs(hideBin(process.argv))
  .command('serve [port]', 'start the server', (yargs) => {
    return yargs
      .positional('port', {
        describe: 'port to bind on',
        default: 5000
      })
  }, (argv) => {
    if (argv.verbose) console.info(`start server on :${argv.port}`)
    serve(argv.port)
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging'
  })
  .argv



/*yargs(hideBin(process.argv))
  .command('run', `
Runs Cypress tests in the Sauce Labs cloud

***Register for a FREE Sauce Labs account at http://saucelabs.com/sign-up !***
  `, (yargs) => {
    yargs.option('sauce-username', {
      alias: ['username', 'u'],
      type: 'string',
      description: 'your Sauce Labs username (see documentation). you can omit this if you set a SAUCE_USERNAME environment variable'
    })
    return yargs;
  }, (argv) => {
    console.log('@@@@argv', argv);
  })
  .argv;*/

/*module.exports.generateCypressConfig = async function generateCypressConfig ({configFile, config={}, env={}, projectPath}) {
  projectPath = projectPath || process.PWD;
  const configFilePath = path.join(projectPath, configFile || 'cypress.json');
  let cypressJson = require(configFilePath);
  cypressJson = {...cypressJson, ...config};
  cypressJson.env = {...cypressJson.env, ...env};
  return cypressJson;
}

module.exports.generateSauceRunnerJson = async function generateSauceRunnerJson ({sauceBrowsersPath, cypressVersion, region}) {
  const runnerJson = {
    apiVersion: 'v1alpha',
    kind: 'cypress',
  };
  for (const browser of sauceBrowsers) {

  }
  return runnerJson;
}*/