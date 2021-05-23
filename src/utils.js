const ignore = require('ignore');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

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

module.exports = {
  startPrintDots, stopPrintDots,
  createProjectZip,
}