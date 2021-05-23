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

function createProjectZip (zipFileOut, workingDir) {
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
}

async function startTunnel (username, accessKey, log) {
  let tunnelName;
  const myAccount = new SauceLabs({user: username, key: accessKey});
  const scLogs = [];
  log.info(`${emoji('rocket')} Starting a SauceConnect tunnel`);
  tunnelName = uuidV4();
  try {
    const scTunnel = await myAccount.startSauceConnect({
      logger: (stdout) => {
        scLogs.push(stdout);
      },
      tunnelIdentifier: tunnelName,
      // TODO: Let user set other SauceConnect parameters
    });
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
      log.info(`${emoji('information_source')}  To view your suites, visit ${chalk.blue(`https://app.saucelabs.com/builds/vdc/${buildId}`)}`);
    }
    startPrintDots();
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

module.exports = {
  startPrintDots, stopPrintDots,
  createProjectZip,
  startTunnel,
  runJob,
}