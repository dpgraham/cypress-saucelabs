#!/usr/bin/env node
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const ignore = require('ignore');
const AdmZip = require('adm-zip');
const FormData = require('form-data');
const { retryInterval } = require('asyncbox');

const defaultCypressVersion = require('./package.json').version;
const { default: axios } = require('axios');

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
      .option('sauce-concurrency', {
        alias: ['ccy', 'concurrency'],
        type: 'number',
        description: `max number of jobs to run concurrently`
      })
      .option('sauce-region', {
        alias: ['region'],
        type: 'string',
        description: `data center to run tests from. Can be US (United States) or EU (Europe)`,
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

async function run (argv) {
    let {
      sauceUsername,
      sauceAccessKey,
      sauceLocal,
      sauceCypressVersion,
      sauceConcurrency = 2,
      sauceRegion,
      project = './',
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

    // Determine region to run tests
    let region = 'us-west-1';
    if (sauceRegion === 'us' || sauceRegion === 'us-west-1') {
      region = 'us-west-1';
    } else if (sauceRegion === 'eu' || sauceRegion === 'eu-central-1') {
      region = 'eu-central-1';
    } else if (sauceRegion === 'staging') {
      region = 'staging';
    } else if (sauceRegion) {
      throw new Error(`Unsupported region ${sauceRegion}`);
    }
    let sauceUrl = `https://${SAUCE_USERNAME}:${SAUCE_ACCESS_KEY}@api.${region}.saucelabs.com`;
    if (region === 'staging') {
      sauceUrl = `https://${SAUCE_USERNAME}:${SAUCE_ACCESS_KEY}@api.${region}.saucelabs.net`;
    }
    
    // Look at the users info
    const userUrl = `${sauceUrl}/rest/v1/users/${SAUCE_USERNAME}`;
    const { user_type:userType, concurrency_limit:concurrencyLimit } = (await axios.get(userUrl)).data;
    if (userType === 'free') {
      console.error(`Your Sauce Labs account ${SAUCE_USERNAME} has expired. ` +
        `Visit https://app.saucelabs.com/billing/plans to upgrade your plan`);
    }
    if (userType === 'free' || userType === 'free_trial' || userType === 'freemium') {
      // TODO: Add a log message saying they're using a free version and give a call to action to upgrade
    }

    const maxConcurrency = concurrencyLimit.overall;
    if (maxConcurrency < sauceConcurrency) {
      console.warn(`You chose a concurrency limit of ${sauceConcurrency} but your account only provides ${maxConcurrency}. ` +
        `Setting concurrency to ${maxConcurrency}` + 
        `To increase your concurrency visit https://app.saucelabs.com/billing/plans to upgrade your account`);
      sauceConcurrency = maxConcurrency;
    }

    // TODO: Generate a sauceignore here if none exists

    const workingDir = process.cwd();

    const sauceBrowserList = [];
    for (const browserInfo of browser.split(',')) {
      let [browserName, browserVersion, os, screenResolution] = browserInfo.trim().split(':');
      sauceBrowserList.push([
        browserName,
        browserVersion || '',
        os || 'Windows 10', // TODO: Allow generic Windows or Win and convert it to a good default
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
    const cypressFilePath = path.join(workingDir, project, cypressFileName);
    fs.writeFileSync(cypressFilePath, JSON.stringify(cypressConfig, null, 2));

    if (!ciBuildId) {
      // TODO: Auto-detect the CI build ID
      ciBuildId = `Cypress Build -- ${+ new Date()}`;
    }

    // CREATE SAUCE-RUNNER.JSON
    const sauceRunnerJson = {
      apiVersion: 'v1alpha',
      kind: 'cypress',
      sauce: {
        metadata: {
          name: ciBuildId,
          tags: [
            'cypress-saucelabs',
            // TODO: Add user defined tags here
          ],
          build: ciBuildId,
        },
        region: 'us-west-1', // TODO: Let user decide region here
      },
      cypress: {
        configFile: path.relative(workingDir, cypressFilePath),
        version: sauceCypressVersion || defaultCypressVersion,
      },
      suites: sauceBrowserList.map(([browserName, browserVersion, os, screenResolution], index) => {
        return {
          name: `SUITE ${index + 1} of ${sauceBrowserList.length}: ${browserName} -- ${browserVersion || 'latest'} -- ${os}` + (screenResolution ? ` -- ${screenResolution}` : ''),
          browser: browserName,
          browserVersion,
          platformName: os,
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

    // TODO: Add a cleanup task to remove artifacts

    if (sauceLocal) {
      // TODO: Add local mode that runs "sauce-cypress-runner" (need to publish "sauce-cypress-runner" to NPM)
    } else {
      // TODO: Check how many minutes the user has, if they're a free user and give a CTA to upgrade

      // ZIP THE PROJECT
      const zipFileOut = '__$$cypress-saucelabs$$__.zip';
      const ig = ignore()
        .add(['.sauceignore', '.git', zipFileOut])
        .add(fs.readFileSync(path.join(workingDir, '.sauceignore')).toString());
      let filenames = [];
      (function recursiveReaddirSync (dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          try {
            if ( fs.lstatSync(path.join(dir, file)).isDirectory() ) {
              recursiveReaddirSync(path.join(dir, file));
            } else {
              filenames.push(path.relative(workingDir, path.join(dir, file)));
            }
          } catch (ign) { }
        }
      })(workingDir);
      filenames = ig.filter(filenames);

      const zip = new AdmZip();
      for (const filename of filenames) {
        const absoluteFilePath = path.join(workingDir, filename);
        const relativeFilePath = path.relative(workingDir, absoluteFilePath);
        zip.addLocalFile(absoluteFilePath, path.dirname(relativeFilePath), path.basename(relativeFilePath));
      }
      zip.writeZip(zipFileOut);

      // Upload the zip file to Application Storage
      const zipFileStream = fs.createReadStream(zipFileOut);
      const formData = new FormData();
      formData.append('payload', zipFileStream);
      const endpoint = `${sauceUrl}/v1/storage/upload`;
      const upload = await axios.post(endpoint, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: 3 * 1024 * 1024 * 1024,
      });
      const {id: storageId} = upload.data.item;

      // TODO: Add sauce-connect tunnel automator. Check users Cypress to see if using 'localhost' and recommend they use 'sauce-tunnel'

      // Run the tests via testcomposer
      async function runJob (suite) {
        // TODO: Introduce a way to retry job
        const { name } = suite;
        const testComposerBody = {
          username: sauceUsername,
          accessKey: sauceAccessKey,
          browserName: suite.browser,
          browserVersion: suite.browserVersion,
          platformName: suite.platformName,
          name: suite.name,
          app: `storage:${storageId}`,
          suite: name,
          framework: 'cypress',
          build: ciBuildId,
          tags: null, // TODO: Tags
          tunnel: null, // TODO: Tunnel
          frameworkVersion: sauceRunnerJson.cypress.version,
        };
        const response = await axios.post(`${sauceUrl}/v1/testcomposer/jobs`, testComposerBody);
        // TODO: Add a timeout option (right now it's just 30 minutes);
        const passed = await retryInterval(4 * 30, 15000, async function () {
          const resp = await axios.get(`${sauceUrl}/rest/v1/${SAUCE_USERNAME}/jobs/${response.data.jobID}`);
          if (resp.data.status !== 'complete') throw new Error('not done yet');
          return resp.data.passed;
        });
        return passed;
      };

      let currentSuiteIndex = 0;
      let runningJobs = 0;
      const runAllJobsPromise = new Promise((resolve, reject) => {
        function runInterval () {
          while (runningJobs < Math.min(sauceConcurrency, sauceRunnerJson.suites.length)) {
            if (!sauceRunnerJson.suites[currentSuiteIndex]) {
              resolve();
              return;
            }
            runningJobs++;
            runJob(sauceRunnerJson.suites[currentSuiteIndex])
              .then(function (passed) {
                if (!passed) {
                  // TODO: Make a parameter to allow user to just continue until all are done
                  reject(`A suite did not pass. Cancelling rest of the suites.`);
                  return;
                }
                runningJobs--;
                runInterval();
              })
              .catch(function (reason) {
                // TODO: Make a parameter to allow user to just continue until all are done
                reject(`A suite failed. Cancelling rest of the suite. Reason: ${reason}`);
              });
            currentSuiteIndex++;
          }
        }
        runInterval();
      });
      await runAllJobsPromise;

      console.log(`Finished running ${sauceRunnerJson.suites.length} suites. All passed.`);
    }
  }

  // TODO: Add linting
  // TODO: Add Jest unit test
  // TODO: Add Jest E2E test
  // TODO: Add publishing script
  // TODO: Add GitHub Actions
  // TODO: NPM Package command line parameter

  module.exports = run;