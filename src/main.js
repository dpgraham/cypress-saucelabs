#!/usr/bin/env node
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const { logger } = require('appium-support');
const { get:emoji } = require('node-emoji');
const chalk = require('chalk');
const { createProjectZip, startTunnel, createCypressConfig, checkUser, uploadZipToApplicationStorage, runAllJobs, getSauceConfig, getSauceUrl } = require('./utils');

const defaultCypressVersion = require('../package.json').version;

const log = logger.getLogger();

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
      .option('sauce-tunnel', {
        alias: ['tunnel'],
        type: 'boolean',
        description: `open up a SauceConnect tunnel so that the Sauce Labs VM can access localhost`,
      })
      .option('sauce-config', {
        type: 'string',
        description: `a js or json file that can be used to define a group of jobs`,
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
      });
    return yargs;
  }, run)
  .argv;

async function run (argv) {
  let scTunnel;
  try {
    let {
      sauceUsername,
      sauceAccessKey,
      sauceLocal,
      sauceCypressVersion,
      sauceConcurrency = 2,
      sauceRegion,
      sauceTunnel,
      sauceConfig,
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
      log.errorAndThrow(`Looks like you haven't provided your Sauce username. If you haven't already, sign up for an account at ` +
          `https://saucelabs.com/sign-up and provide your username in the command: "--sauce-username YOUR_USERNAME"`);
    }
    if (!sauceAccessKey) {
      log.errorAndThrow(`Looks like you haven't provided your Sauce Access Key. To retrieve your Sauce Access Key, sign in to ` +
          `your Sauce Labs account '${sauceUsername}' and navigate to https://app.saucelabs.com/user-settings to copy and ` +
          `paste your Access Key and provide it in the command: "--sauce-access-key YOUR_ACCESS_KEY"`);
    }

    // Get Sauce API base URL
    const sauceUrl = getSauceUrl({sauceRegion, sauceUsername, sauceAccessKey});

    // Look at the users info
    await checkUser({sauceUrl, sauceUsername, sauceAccessKey, sauceConcurrency});

    const workingDir = path.join(process.cwd(), project);

    let sauceConfiguration = getSauceConfig(sauceConfig, workingDir);
    

    // const supportedBrowsers = axios.get(`${sauceUrl}/rest/v1/info/platforms/all?resolutions=true`);
    const suiteList = [];
    const entries = sauceConfiguration ? Object.entries(sauceConfiguration) : [[null, null]];
    for (let [name, conf] of entries) {
      conf = {
        browser,
        project,
        config,
        configFile,
        env,
        ...conf,
      };
      for (const browserInfo of conf.browser.split(',')) {
        let suite = {};
        let [browserName, browserVersion, os, screenResolution] = browserInfo.trim().split(':');
        // TODO: Validate the browser names, versions and platforms
        // TODO: Add browser aliasing
        if (os && os.toLowerCase().startsWith('mac')) {
          log.error(`Platform '${os}' is not supported in Sauce Cloud. ` +
              `If you'd like to see this, request it at https://saucelabs.ideas.aha.io/`);
        }
        suite.browser = [
          browserName,
          browserVersion || '',
          os || 'Windows 10', // TODO: Allow generic Windows or Win and convert it to a good default
          screenResolution,
        ];

        // GENERATE CYPRESS CONFIG
        suite.configFile = await createCypressConfig({conf, workingDir, log, name});
        suiteList.push(suite);
      }

      // TODO: Add a flag to set pre-existing tunnelId.... check open tunnels before running tests
      if (!sauceTunnel && cypressConfig.baseUrl && cypressConfig.baseUrl.includes('localhost')) {
        log.info(`${emoji('information_source')} Looks like you're running on localhost '${cypressConfig.baseUrl}'. ` +
          `To allow Sauce Labs VM's to access your localhost, set '--sauce-tunnel true' in your command line arguments`);
      }
    }

    if (!ciBuildId) {
      // TODO: Auto-detect the CI build ID
      ciBuildId = `Cypress Build -- ${+new Date()}`;
    }

    // Create "sauce-runner.json"
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
        configFile: path.relative(workingDir, suiteList[0].configFile), // TODO: This will be replaced once ship new Cypress Runner
        version: sauceCypressVersion || defaultCypressVersion,
      },
      suites: suiteList.map(({browser: [browserName, browserVersion, os, screenResolution], configFile}, index) => ({
        name: `SUITE ${index + 1} of ${suiteList.length}: ${browserName} -- ${browserVersion || 'latest'} -- ${os}` + (screenResolution ? ` -- ${screenResolution}` : ''),
        browser: browserName,
        browserVersion,
        platformName: os,
        screenResolution,
        config: {},
        configFile, // TODO: Put in a PR to make this one be supported by sauce-cypress-runner
      })),
    };
    fs.writeFileSync(path.join(workingDir, 'sauce-runner.json'), JSON.stringify(sauceRunnerJson, null, 2));

    // Warn about permanently unsupported Cypress parameters
    const unsupportedParameters = ['tag', 'spec', 'reporterOptions', 'reporter', 'quiet', 'noExit', 'headless', 'headed', 'group'];
    for (const parameter of unsupportedParameters) {
      if (argv[parameter]) {
        log.warn(`Found parameter '${parameter}=${argv[parameter]}'. '${parameter}' is not used in Sauce Labs cloud and will be ignored`);
      }
    }

    // Give a link to Aha! for unsupported
    if (argv.parallel) {
      log.warn(`'parallel' parameter is not supported in Sauce cloud. If you'd like to see this, request it at https://saucelabs.ideas.aha.io/`);
    }

    // TODO: Add a cleanup task to remove artifacts

    if (sauceLocal) {
      // TODO: Add local mode that runs "sauce-cypress-runner" (need to publish "sauce-cypress-runner" to NPM)
    } else {
      // Zip the project
      log.info(`${emoji('package')} Bundling contents of ${chalk.blue(workingDir)} to zip file`);
      const zipFileOut = path.join(workingDir, '__$$cypress-saucelabs$$__.zip');
      await createProjectZip({zipFileOut, workingDir, log});
      log.info(`${emoji('white_check_mark')} Wrote zip file to '${chalk.blue(path.join(workingDir, zipFileOut))}'`);

      // Upload the zip file to Application Storage
      const storageId = await uploadZipToApplicationStorage({zipFileOut, log, sauceUrl});

      // Start a SauceConnect tunnel
      const sauceTunnelData = sauceTunnel ? await startTunnel(sauceUsername, sauceAccessKey, log) : null;
      const { tunnelName } = sauceTunnelData;
      scTunnel = sauceTunnelData.scTunnel;

      // Run all of the jobs now
      await runAllJobs({
        sauceUrl,
        sauceConcurrency,
        sauceUsername,
        sauceAccessKey,
        sauceRunnerJson,
        tunnelName,
        storageId,
        log,
        ciBuildId,
      });
    }
  } catch (e) {
    process.stdout.write('\n');
    log.errorAndThrow(e);
  } finally {
    if (scTunnel) {
      log.info(`${emoji('information_source')}  Closing SauceConnect Tunnel`);
      await scTunnel.close();
    }
  }
}

// TODO: Add Jest unit test and linting
// TODO: Add Jest E2E test
// TODO: Add publishing script
// TODO: Add GitHub Actions
// TODO: NPM Package command line parameter
// TODO: Add bin to package.json
// TODO: Add a CI.js library to get build-id and git commit
// TODO: Add a cleanup task
// TODO: Change browser format to "chrome@version" instead of "chrome:version"
// TODO: Add a utils

module.exports = run;