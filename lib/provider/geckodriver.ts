import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { OUT_DIR, Provider, ProviderConfig } from './provider';
import {
  changeFilePermissions,
  generateConfigFile,
  renameFileWithVersion,
  uncompressTarball,
  unzipFile,
  tarFileList,
  zipFileList,
} from './utils/file_utils';
import { convertJsonToVersionList, updateJson } from './utils/github_json';
import { requestBinary } from './utils/http_utils';
import { getVersion } from './utils/version_list';

export class GeckoDriver implements Provider {
  cacheFileName = 'geckodriver.json';
  configFileName = 'geckodriver.config.json';
  ignoreSSL: boolean = false;
  oauthToken: string;
  osType = os.type();
  osArch = os.arch();
  outDir = OUT_DIR;
  proxy: string = null;
  requestUrl = 'https://api.github.com/repos/mozilla/geckodriver/releases';

  constructor(providerConfig?: ProviderConfig) {
    if (providerConfig) {
      if (providerConfig.cacheFileName) {
        this.cacheFileName = providerConfig.cacheFileName;
      }
      if (providerConfig.configFileName) {
        this.configFileName = providerConfig.configFileName;
      }
      this.ignoreSSL = providerConfig.ignoreSSL;
      if (providerConfig.osArch) {
        this.osArch = providerConfig.osArch;
      }
      if (providerConfig.osType) {
        this.osType = providerConfig.osType;
      }
      if (providerConfig.outDir) {
        this.outDir = providerConfig.outDir;
      }
      if (providerConfig.proxy) {
        this.proxy = providerConfig.proxy;
      }
      if (providerConfig.requestUrl) {
        this.requestUrl = providerConfig.requestUrl;
      }
    }
  }

  /**
   * Should update the cache and download, find the version to download,
   * then download that binary.
   * @param version Optional to provide the version number or latest.
   */
  async updateBinary(version?: string): Promise<any> {
    await updateJson(this.requestUrl, {
      fileName: path.resolve(this.outDir, this.cacheFileName),
      ignoreSSL: this.ignoreSSL,
      proxy: this.proxy
    }, this.oauthToken);

    let versionList = convertJsonToVersionList(
      path.resolve(this.outDir, this.cacheFileName));
    let versionObj = getVersion(
      versionList, osHelper(this.osType, this.osArch), version);

    let geckoDriverUrl = versionObj.url;
    let geckoDriverCompressed = path.resolve(this.outDir, versionObj.name);

    // We should check the zip file size if it exists. The size will
    // be used to either make the request, or quit the request if the file
    // size matches.
    let fileSize = 0;
    try {
      fileSize = fs.statSync(geckoDriverCompressed).size;
    } catch (err) {}
    await requestBinary(geckoDriverUrl, {
      fileName: geckoDriverCompressed, fileSize, ignoreSSL: this.ignoreSSL,
      proxy: this.proxy });

    // Uncompress tarball (for linux and mac) or unzip the file for Windows.
    // Rename all the files (a grand total of 1) and set the permissions.
    let fileList: string[];
    if (this.osType === 'Windows_NT') {
      fileList = zipFileList(geckoDriverCompressed);
    } else {
      fileList = await tarFileList(geckoDriverCompressed);
    }
    let fileItem = path.resolve(this.outDir, fileList[0]);

    if (this.osType === 'Windows_NT') {
      unzipFile(geckoDriverCompressed, this.outDir);
    } else {
      await uncompressTarball(geckoDriverCompressed, this.outDir);
    }
    
    let renamedFileName = renameFileWithVersion(
      fileItem, '_' + versionObj.version);

    changeFilePermissions(renamedFileName, '0755', this.osType);
    generateConfigFile(this.outDir,
      path.resolve(this.outDir, this.configFileName),
      matchBinaries(this.osType), renamedFileName);
    return Promise.resolve();
  }
}

/**
 * Helps translate the os type and arch to the download name associated
 * with composing the download link.
 * @param ostype The operating stystem type.
 * @param osarch The chip architecture.
 * @returns The download name associated with composing the download link.
 */
export function osHelper(ostype: string, osarch: string): string {
  if (ostype === 'Darwin') {
    return 'macos';
  } else if (ostype === 'Windows_NT') {
    if (osarch === 'x64')  {
      return 'win64';
    } else if (osarch === 'x32') {
      return 'win32';
    }
  } else if (ostype == 'Linux') {
    if (osarch === 'x64') {
      return 'linux64';
    } else if (osarch === 'x32') {
      return 'linux32';
    }
  }
  return null;
}

/**
 * Matches the installed binaries depending on the operating system.
 * @param ostype The operating stystem type.
 */
export function matchBinaries(ostype: string): RegExp | null {
  if (ostype === 'Darwin' || ostype == 'Linux') {
    return /geckodriver_\d+.\d+.\d+/g
  } else if (ostype === 'Windows_NT') {
    return /geckodriver_\d+.\d+.\d+.exe/g
  }
  return null;
}