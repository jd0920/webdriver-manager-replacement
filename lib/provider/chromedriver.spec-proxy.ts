import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as rimraf from 'rimraf';
import {
  ChromeDriver,
  semanticVersionParser,
  versionParser
} from './chromedriver';
import { convertXmlToVersionList } from './utils/cloud_storage_xml';
import { getVersion } from './utils/version_list';
import { proxyBaseUrl } from '../../spec/server/env';
import { spawnProcess } from '../../spec/support/helpers/test_utils';
import { checkConnectivity } from '../../spec/support/helpers/test_utils';

describe('chromedriver', () => {
  let tmpDir = path.resolve(os.tmpdir(), 'test');

  describe('class ChromeDriver', () => {
    let origTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    let proxyProc: childProcess.ChildProcess;

    describe('updateBinary', () => {
      beforeEach((done) => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 15000;
        proxyProc = spawnProcess('node', ['dist/spec/server/proxy_server.js']);
        console.log('proxy-server: ' + proxyProc.pid);
        setTimeout(done, 3000);
        try {
          fs.mkdirSync(tmpDir);
        } catch (err) {}
      });
    
      afterEach((done) => {
        spawnProcess('kill', ['-TERM', proxyProc.pid.toString()]);
        setTimeout(done, 5000);
        jasmine.DEFAULT_TIMEOUT_INTERVAL = origTimeout;
        try {
          rimraf.sync(tmpDir);
        } catch (err) {}
      });

      it('should download the binary using a proxy', async(done) => {
        if (!await checkConnectivity('update binary for mac test')) {
          done();
        }
        let chromeDriver = new ChromeDriver({
          ignoreSSL: true, osType: 'Darwin', osArch: 'x64', outDir: tmpDir,
          proxy: proxyBaseUrl });
        await chromeDriver.updateBinary();
        let configFile = path.resolve(tmpDir, 'chromedriver.config.json');
        let xmlFile = path.resolve(tmpDir, 'chromedriver.xml');
        expect(fs.statSync(configFile).size).toBeTruthy();
        expect(fs.statSync(xmlFile).size).toBeTruthy();

        let versionList = convertXmlToVersionList(xmlFile, '.zip', 
          versionParser, semanticVersionParser);
        let versionObj = getVersion(versionList, 'mac');
        let executableFile = path.resolve(tmpDir,
          'chromedriver_' + versionObj.version);
        expect(fs.statSync(executableFile).size).toBeTruthy();
        done();
      });
    });
  });
});