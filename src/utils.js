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

module.exports = {
  startPrintDots, stopPrintDots,
}