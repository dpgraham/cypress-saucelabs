const { createProjectZip, startTunnel } = require("../utils");

jest.mock('fs');
jest.mock('adm-zip');
jest.mock('saucelabs');
const fs = require('fs');
const AdmZip = require('adm-zip');
const SauceLabs = require('saucelabs');

const mockLog = {
  info: () => {},
  error: () => {},
};

describe('utils', function () {
  describe('.createProjectZip', function () {
    it('should send non-ignored files to a zip entry', function () {
      fs.existsSync.mockImplementation(jest.fn(() => false));
      fs.readdirSync.mockImplementation(jest.fn((dir) => {
        if (dir === '/root/b/') {
          return ['c'];
        } else if (dir === '/root') {
          return ['a', 'b/', '.sauceignore', '.git']
        }
      }));
      fs.lstatSync.mockImplementation(jest.fn((dir) => ({isDirectory: () => dir.endsWith('/')})));
      fs.readFileSync.mockImplementation(() => 'hello world');
      AdmZip.prototype = {
        addLocalFile: jest.fn(),
        writeZip: jest.fn(),
      };
      createProjectZip({zipFileOut: '/path/to/zip', workingDir: '/root', log: mockLog});
      expect([AdmZip.prototype.addLocalFile.mock.calls, AdmZip.prototype.writeZip]).toMatchSnapshot();
    });
  });
  describe('.startTunnel', function () {
    it.only('should start a SauceConnect tunnel via SauceLabs NPM package', async function () {
      SauceLabs.default.prototype.startSauceConnect = jest.fn(() => 'some-tunnel-id');
      await startTunnel('fakeuser', 'fakeaccesskey', mockLog);
      const calls = SauceLabs.default.prototype.startSauceConnect.mock.calls;
      calls[0].logger();
      expect(calls).toMatchSnapshot();
    });
  });
});