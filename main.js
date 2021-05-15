#!/usr/bin/env node
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');

const defaultCypressVersion = require('./package.json').version;

yargs(hideBin(process.argv))
  .command('$0', `
Runs Cypress tests in the Sauce Labs cloud

***Sign up for a FREE Sauce Labs account at http://saucelabs.com/sign-up !***
  `, (yargs) => {
    yargs
      .option('sauce-username', {
        alias: ['username', 'u'],
        type: 'string',
        description: 'your Sauce Labs username. you can omit this if you set a SAUCE_USERNAME environment variable'
      })
      .option('sauce-access-key', {
        alias: 'a',
        type: 'string',
        description: 'your Sauce Labs access key. you can omit this if you set a SAUCE_ACCESS_KEY environment variable',
      })
      .option('sauce-local', {
        type: 'boolean',
        description: `run your Cypress test locally and send the results to Sauce Labs`,
      })
      .option('sauce-cypress-version', {
        type: 'string',
        description: `version of Cypress to run in cloud. Default is ${defaultCypressVersion}`
      })
      .option('browser', {
        alias: 'b',
        type: 'string',
        description: `a comma-separted list of Sauce Labs browsers to run your Cypress tests on.

        Each browser has the format "<browserName>:<browserVersion>:<operatingSystem>:<screenResolution>". 

        'browserName' is the only required field

        example: "--browsers chrome, firefox:78:windows , edge:latest:windows:1920x1078"`
      })
      .option('ci-build-id', {
        type: 'string',
        description: `the unique identifier for a run on your CI provider. typically a "BUILD_ID" env var. this value is automatically detected for most CI providers`,
      })
      .option('config', {
        alias: 'c',
        type: 'string',
        description: `sets configuration values. separate multiple values with a comma. overrides any value in cypress.json.`,
      })
      .option('config-file', {
        alias: 'C',
        type: 'string',
        description: `path to JSON file where configuration values are set. defaults to "cypress.json". pass "false" to disable.`,
      })
      .option('env', {
        alias: 'e',
        type: 'string',
        description: `sets environment variables. separate multiple values with a comma. overrides any value in cypress.json or cypress.env.json`,
      })
      .option('group', {
        type: 'string',
        description: `a named group for recorded runs in the Cypress Dashboard`,
      })
      .option('key', {
        alias: 'k',
        type: 'string',
        description: `your secret Record Key. you can omit this if you set a CYPRESS_RECORD_KEY environment variable.`,
      })
      .option('headed', {
        type: 'boolean',
        description: `displays the browser instead of running headlessly (defaults to true for Firefox and Chromium-family browsers)`,
      })
      .option('headless', {
        type: 'boolean',
        description: `hide the browser instead of running headed (defaults to true for Electron)`,
      })
      .option('no-exit', {
        type: 'string',
        description: `keep the browser open after tests finish`,
      })
      .option('parallel', {
        type: 'string',
        description: `enables concurrent runs and automatic load balancing of specs across multiple machines or processes`,
      })
      .option('port', {
        alias: 'p',
        type: 'string',
        description: `runs Cypress on a specific port. overrides any value in cypress.json`,
      })
      .option('project', {
        alias: 'P',
        type: 'string',
        description: `path to the project`,
      })
      .option('quiet', {
        alias: 'q',
        type: 'string',
        description: `run quietly, using only the configured reporter`,
      })
      .option('record', {
        type: 'boolean',
        description: `records the run. sends test results, screenshots and videos to your Cypress Dashboard.`,
      })
      .option('reporter', {
        alias: 'r',
        type: 'string',
        description: `setruns a specific mocha reporter. pass a path to use a custom reporter. defaults to "spec"`,
      })
      .option('reporter-options', {
        alias: 'o',
        type: 'string',
        description: `options for the mocha reporter. defaults to "null"`,
      })
      .option('spec', {
        alias: 's',
        type: 'string',
        description: `runs specific spec file(s). defaults to "all"`,
      })
      .option('tag', {
        alias: 't',
        type: 'string',
        description: `named tag(s) for recorded runs in the Cypress Dashboard`,
      })
      .option('dev', {
        alias: 's',
        type: 'string',
        description: `runs cypress in development and bypasses binary check`,
      })
    return yargs;
  }, run)
  .argv;

function run (argv) {
    let {
      sauceUsername,
      sauceAccessKey,
      sauceLocal,
      project,
      config = '',
      configFile = './cypress.json',
      env = '',
      ciBuildId,
      browser = 'chrome',
    } = argv;

    let {
        SAUCE_USERNAME,
        SAUCE_ACCESS_KEY,
    } = process.env;

    sauceUsername = SAUCE_USERNAME || sauceUsername;
    sauceAccessKey = SAUCE_ACCESS_KEY || sauceAccessKey;

    if (!sauceUsername) {
        throw new Error(`Looks like you haven't provided your Sauce username. If you haven't already, sign up for an account at ` +
        `https://saucelabs.com/sign-up and provide your username in the command: "--sauce-username YOUR_USERNAME"`);
    }
    if (!sauceAccessKey) {
        throw new Error(`Looks like you haven't provided your Sauce Access Key. To retrieve your Sauce Access Key, sign in to ` +
        `your Sauce Labs account '${sauceUsername}' and navigate to https://app.saucelabs.com/user-settings to copy and ` +
        `paste your Access Key and provide it in the command: "--sauce-access-key YOUR_ACCESS_KEY"`);
    }

    // TODO: Generate a sauceignore here if none exists

    const workingDir = process.cwd();

    const sauceBrowserList = [];
    for (const browserInfo of browser.split(',')) {
      let [browserName, browserVersion, os, screenResolution] = browserInfo.trim().split(':');
      sauceBrowserList.push([
        browserName,
        browserVersion || '',
        os || 'Windows',
        screenResolution,
      ]);
      // TODO: Validate the browser names, versions and platforms
    }

    // GENERATE CYPRESS CONFIG
    let cypressConfig = {};

    if (configFile != 'false') {
      const pathToConfig = path.join(workingDir, project, configFile);
      if (!fs.existsSync(pathToConfig)) {
        throw new Error(`Could not find a Cypress configuration file, exiting.

We looked but did not find a ${pathToConfig} file in this folder: /Users/danielgraham/personal/cypress-saucelabs`);
      }
      try {
        cypressConfig = {...cypressConfig, ...require(pathToConfig)};
      } catch (e) {
        throw new Error(`Cypress config file at '${pathToConfig}' contains invalid JSON: ${e.message}`);
      }
    }

    for (const keyValuePair of config.trim().split(',')) {
      if (keyValuePair === '') continue;
      const [configKey, configValue] = keyValuePair.split('=');
      if (!configValue) {
        throw new Error(`Encountered an error while parsing the argument 'config'.
        
You passed: '${keyValuePair}'. Must provide a key and value separated by = sign`);
      }
      cypressConfig[configKey] = configValue;
    }

    // ENVIRONMENT VARIABLES
    let cypressEnv = {};

    const pathToCypressEnv = path.join(process.cwd(), 'cypress.env.json');
    if (fs.existsSync(pathToCypressEnv)) {
      try {
        cypressEnv = {...cypressEnv, ...JSON.parse(require(pathToCypressEnv))};
      } catch (e) {
        throw new Error(`Cypress env file at '${pathToCypressEnv}' contains invalid JSON: ${e.message}`);
      }
    }

    for (const envPair of env.trim().split(',')) {
      if (envPair === '') continue;
      const [envKey, envValue] = envPair.split('=');
      if (!envValue) {
        throw new Error(`Encountered an error while parsing the argument 'env'.
        
You passed: '${envPair}'. Must provide a key and value separated by = sign`);
      }
      cypressEnv[envKey] = envValue; 
    }

    cypressConfig.env = {...cypressConfig.env, ...cypressEnv};

    // WRITE CYPRESS CONFIG TO JSON FILE
    const cypressFileName = `__$$cypress-saucelabs$$__.json`;
    const cypressFilePath = path.join(workingDir, cypressFileName);
    fs.writeFileSync(cypressFilePath, JSON.stringify(cypressConfig, null, 2));

    if (!ciBuildId) {
      // TODO: Auto-detect the CI build ID
      ciBuildId = `Build -- ${+ new Date()}`;
    }

    // CREATE SAUCE-RUNNER.JSON
    const sauceRunnerJson = {
      apiVersion: 'v1alpha',
      kind: 'cypress',
      sauce: {
        metadata: {
          name: 'Test Name', // TODO: Add a general test name
          tags: [
            'cypress-saucelabs',
            // TODO: Add user defined tags here
          ],
          build: ciBuildId,
        },
        region: 'us-west-1', // TODO: Let user decide region here
      },
      cypress: {
        configFile: cypressFilePath,
        version: defaultCypressVersion,
      },
      suites: sauceBrowserList.map(([browserName, browserVersion, os, screenResolution]) => {
        return {
          name: `${browserName} -- ${browserVersion} -- ${os}` + (screenResolution ? ` -- ${screenResolution}` : ''),
          browser: browserName,
          browserVersion,
          screenResolution,
          config: {},
        };
      }),
    };
    fs.writeFileSync(path.join(workingDir, 'sauce-runner.json'), JSON.stringify(sauceRunnerJson, null, 2));

    // TODO: Add Winston logging

    // Warn about permanently unsupported Cypress parameters
    const unsupportedParameters = ['tag', 'spec', 'reporterOptions', 'reporter', 'quiet', 'noExit', 'headless', 'headed', 'group'];
    for (const parameter of unsupportedParameters) {
      if (argv[parameter]) {
        console.warn(`Found parameter '${parameter}=${argv[parameter]}'. '${parameter}' is not used in Sauce Labs cloud and will be ignored`);
      }
    }

    // Give a link to Aha! for unsupported 
    if (argv.parallel) {
      console.warn(`'parallel' parameter is not supported in Sauce cloud. If you'd like to see this, request it at https://saucelabs.ideas.aha.io/`);
    }

    if (sauceLocal) {
      // TODO: Add local mode that runs "sauce-cypress-runner"
    } else {
      // ZIP THE PROJECT
      // TODO: Create the zip file (ignore .sauceignore, cypress.json, cypress.env.json; add .sauce-runner.json, cypress-<UNIQUE-HASH>.json)

      // TODO: Check how many minutes the user has, if they're a free user and give a CTA to upgrade

      // TODO: Upload the zip file to App Storage

      // TODO: Add sauce-connect tunnel automator. Check users Cypress to see if using 'localhost' and recommend they use 'sauce-tunnel'

      // TODO: Run the test using TestComposer
    }
      
    console.log('#####RUNNING CLOUD TESTS NOW', sauceBrowserList, cypressConfig, cypressEnv, ciBuildId);
  }

  // TODO: Add linting
  // TODO: Add Jest unit test
  // TODO: Add Jest E2E test
  // TODO: Add publishing script
  // TODO: Add GitHub Actions

  module.exports = run;