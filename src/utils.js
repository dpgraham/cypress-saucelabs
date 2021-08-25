const ignore = require('ignore');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const { default: SauceLabs } = require('saucelabs');
const { uuidV4 } = require('appium-support/build/lib/util');
const { get:emoji } = require('node-emoji');
const chalk = require('chalk');
const axios = require('axios');
const { retryInterval } = require('asyncbox');
const FormData = require('form-data');

let dotPrintingInterval;

function startPrintDots () {
  dotPrintingInterval = setInterval(function () {
    process.stdout.write('.');
  }, 1000);
}

function stopPrintDots () {
  process.stdout.write('\n');
  clearInterval(dotPrintingInterval);
}

function createProjectZip ({zipFileOut, workingDir, log}) {
  startPrintDots();
  const sauceIgnoreDir = path.join(workingDir, '.sauceignore');
  if (!fs.existsSync(sauceIgnoreDir)) {
    log.info(`${emoji('information_source')} Writing .sauceignore file to '${sauceIgnoreDir}'`);
    fs.copyFileSync(path.join(__dirname, '..', '.sauceignore'), sauceIgnoreDir);
  }
  const ig = ignore()
      .add(['.sauceignore', '.git', zipFileOut])
      .add('__$$cypress-saucelabs$$__.zip')
      .add(fs.readFileSync(sauceIgnoreDir).toString());
  let filenames = [];
  (function recursiveReaddirSync (dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      try {
        if (fs.lstatSync(path.join(dir, file)).isDirectory()) {
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
  stopPrintDots();
}

async function startTunnel (username, accessKey, log) {
  let tunnelName;
  const myAccount = new SauceLabs({user: username, key: accessKey});
  const scLogs = [];
  log.info(`${emoji('rocket')} Starting a SauceConnect tunnel`);
  tunnelName = uuidV4();
  try {
    startPrintDots();
    const scTunnel = await myAccount.startSauceConnect({
      logger: (stdout) => {
        scLogs.push(stdout);
      },
      tunnelIdentifier: tunnelName,
      // TODO: Let user set other SauceConnect parameters
    });
    stopPrintDots();
    log.info(`${emoji('white_check_mark')} Started SauceConnect tunnel successfully with tunnel ID ${chalk.blue(tunnelName)}`);
    return {tunnelName, scTunnel};
  } catch (e) {
    log.info(scLogs.join('\n'));
    log.errorAndThrow('Failed to start tunnel', e);
  }
}

let loggedBuild = false;

async function runJob ({
  suite,
  tunnelName,
  storageId,
  sauceUsername,
  sauceAccessKey,
  ciBuildId,
  frameworkVersion,
  sauceUrl,
  log,
}) {
  const getBuildId = async (jobId) => {
    const { data: job } = await axios.get(`${sauceUrl}/rest/v1/${sauceUsername}/jobs/${jobId}`);
    const { build:buildName } = job;
    const { data: builds } = await axios.get(`${sauceUrl}/rest/v1/${sauceUsername}/builds`, {params: {status: 'running'}});
    if (builds) {
      for (const build of builds) {
        if (build.name === buildName) {
          return build.id;
        }
      }
    }
    throw new Error(`Could not find build`);
  };

  // TODO: Introduce a way to retry job
  const { name, browser, browserVersion, platformName, screenResolution } = suite;
  const testComposerBody = {
    username: sauceUsername,
    accessKey: sauceAccessKey,
    browserName: browser,
    browserVersion,
    platformName,
    name,
    screenResolution,
    app: `storage:${storageId}`,
    suite: name,
    framework: 'cypress',
    build: ciBuildId,
    tags: null, // TODO: Tags
    tunnel: {
      id: tunnelName,
    },
    frameworkVersion,
  };
  const response = await axios.post(`${sauceUrl}/v1/testcomposer/jobs`, testComposerBody);
  const jobId = response.data.jobID;
  if (!loggedBuild) {
    loggedBuild = true;
    const buildId = await retryInterval(5, 5000, async () => getBuildId(jobId));
    if (buildId) {
      startPrintDots();
      log.info(`${emoji('information_source')}  To view your suites, visit ${chalk.blue(`https://app.saucelabs.com/builds/vdc/${buildId}`)}`);
    }
  }

  // TODO: Add a timeout option (right now it's just 30 minutes);
  const passed = await retryInterval(4 * 30, 15000, async function () {
    const resp = await axios.get(`${sauceUrl}/rest/v1/${sauceUsername}/jobs/${jobId}`);
    if (resp.data.status !== 'complete') {
      throw new Error('not done yet');
    }
    return resp.data.passed;
  });
  return passed;
}

async function createCypressConfig ({conf, workingDir, log, name}) {
  let cypressConfig = {};
  if (conf.configFile !== 'false') {
    const pathToConfig = path.join(workingDir, conf.configFile);
    if (!fs.existsSync(pathToConfig)) {
      log.errorAndThrow(`Could not find a Cypress configuration file, exiting.

We looked but did not find a ${pathToConfig} file in this folder: ${workingDir}`);
    }
    try {
      cypressConfig = {...cypressConfig, ...require(pathToConfig)};
    } catch (e) {
      log.errorAndThrow(`Cypress config file at '${pathToConfig}' contains invalid JSON: ${e.message}`);
    }
  }

  for (const keyValuePair of conf.config.trim().split(',')) {
    if (keyValuePair === '') {continue;}
    const [configKey, configValue] = keyValuePair.split('=');
    if (!configValue) {
      log.errorAndThrow(`Encountered an error while parsing the argument 'config'.
        
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
      log.errorAndThrow(`Cypress env file at '${pathToCypressEnv}' contains invalid JSON: ${e.message}`);
    }
  }

  for (const envPair of conf.env.trim().split(',')) {
    if (envPair === '') {continue;}
    const [envKey, envValue] = envPair.split('=');
    if (!envValue) {
      log.errorAndThrow(`Encountered an error while parsing the argument 'env'.
        
You passed: '${envPair}'. Must provide a key and value separated by = sign`);
    }
    cypressEnv[envKey] = envValue;
  }

  cypressConfig.env = {...cypressConfig.env, ...cypressEnv};

  // WRITE CYPRESS CONFIG TO JSON FILE
  const cypressFileName = `__$$cypress-saucelabs$$__` + (name ? `${name}__` : '') + '.json';
  const cypressFilePath = path.join(workingDir, cypressFileName);
  fs.writeFileSync(cypressFilePath, JSON.stringify(cypressConfig, null, 2));
  return cypressFilePath;
}

async function checkUser ({sauceUrl, sauceUsername, log, sauceConcurrency}) {
  const userUrl = `${sauceUrl}/rest/v1/users/${sauceUsername}`;
  const user = (await axios.get(userUrl)).data;
  const { user_type: userType } = user;
  if (userType === 'free') {
    log.error(`${emoji('x')} Your Sauce Labs account ${SAUCE_USERNAME} has expired. ` +
        `Visit https://app.saucelabs.com/billing/plans to upgrade your plan`);
  }
  if (userType === 'free_trial' || userType === 'freemium') {
    log.info(`${emoji('warning')} You are using a free version of Sauce Labs with limited concurrency and minutes. ` +
        `Visit https://app.saucelabs.com/billing/plans to upgrade your plan`);
  }
  
  const maxConcurrency = user?.concurrencyLimit?.overall;
  if (maxConcurrency < sauceConcurrency) {
    log.warn(`${emoji('warning')} You chose a concurrency limit of ${sauceConcurrency} but your account only provides ${maxConcurrency}. ` +
        `Setting concurrency to ${maxConcurrency}` +
        `To increase your concurrency visit https://app.saucelabs.com/billing/plans to upgrade your account`);
    sauceConcurrency = maxConcurrency;
  }

  return user;
}

async function uploadZipToApplicationStorage ({sauceUrl, zipFileOut, log}) {
  // Upload the zip file to Application Storage
  log.info(`${emoji('rocket')} Uploading zip file to Sauce Labs Application Storage`);
  startPrintDots();
  const zipFileStream = fs.createReadStream(zipFileOut);
  const formData = new FormData();
  formData.append('payload', zipFileStream);
  const endpoint = `${sauceUrl}/v1/storage/upload`;
  const upload = await axios.post(endpoint, formData, {
    headers: formData.getHeaders(),
    maxBodyLength: 3 * 1024 * 1024 * 1024,
  });
  const { id } = upload.data.item;
  stopPrintDots();
  log.info(`${emoji('white_check_mark')} Done uploading to Application Storage with storage ID ${chalk.blue(id)}`);
  return id;
}

async function runAllJobs ({
  sauceConcurrency,
  sauceUrl,
  sauceUsername,
  sauceAccessKey,
  sauceRunnerJson,
  tunnelName,
  storageId,
  log,
  ciBuildId,
}) {
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
        runJob({
          suite: sauceRunnerJson.suites[currentSuiteIndex],
          tunnelName,
          sauceUsername,
          sauceAccessKey,
          storageId,
          ciBuildId,
          frameworkVersion: sauceRunnerJson.cypress.version,
          sauceUrl,
          log
        }).then(function (passed) {
          if (!passed) {
            // TODO: Make a parameter to allow user to just continue until all are done
            reject(`Your suites did not pass`);
            return;
          }
          runningJobs--;
          runInterval();
        })
        .catch(function (reason) {
          // TODO: Make a parameter to allow user to just continue until all are done
          reject(`Your suites errored: ${reason}`);
        });
        currentSuiteIndex++;
      }
    }
    runInterval();
  });
  const numberOfSuites =  sauceRunnerJson.suites.length;
  log.info(`${emoji('rocket')} Running ${numberOfSuites} suites.`);
  await runAllJobsPromise;
  stopPrintDots();
  log.info(`${emoji('white_check_mark')} Finished running ${sauceRunnerJson.suites.length} suites. All passed.`);
}

function getSauceConfig (sauceConfig, workingDir) {
  if (sauceConfig) {
    if (!fs.existsSync(path.join(workingDir, sauceConfig))) {
      log.errorAndThrow(`No such file ${sauceConfig}`);
    }
    return require(path.join(workingDir, sauceConfig));
  } else {
    if (fs.existsSync(path.join(workingDir, 'sauce.conf.json'))) {
      return require(path.join(workingDir, 'sauce.conf.json'));
    } else if (fs.existsSync(path.join(workingDir, 'sauce.conf.js'))) {
      return require(path.join(workingDir, 'sauce.conf.js'));
    }
  }
}

function getSauceUrl ({sauceUsername, sauceAccessKey, sauceRegion}) {
  let region = 'us-west-1';
  if (sauceRegion === 'us' || sauceRegion === 'us-west-1') {
    region = 'us-west-1';
  } else if (sauceRegion === 'eu' || sauceRegion === 'eu-central-1') {
    region = 'eu-central-1';
  } else if (sauceRegion === 'staging') {
    region = 'staging';
  } else if (sauceRegion) {
    log.errorAndThrow(`Unsupported region ${sauceRegion}`);
  }
  let sauceUrl = `https://${sauceUsername}:${sauceAccessKey}@api.${region}.saucelabs.com`;
  if (region === 'staging') {
    sauceUrl = `https://${sauceUsername}:${sauceAccessKey}@api.${region}.saucelabs.net`;
  }
  return sauceUrl;
}

module.exports = {
  startPrintDots, stopPrintDots,
  createProjectZip,
  startTunnel,
  runJob,
  createCypressConfig,
  checkUser,
  uploadZipToApplicationStorage,
  runAllJobs,
  getSauceConfig,
  getSauceUrl,
}