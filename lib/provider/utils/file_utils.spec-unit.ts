import * as fs from 'fs';
import {
  convertXml2js,
  isExpired,
  getMatchingFiles,
  readJson,
  readXml} from './file_utils';
import { JsonObject } from './http_utils';

const xmlContents = `
<?xml version='1.0' encoding='UTF-8'?>
<ListBucketResult xmlns='http://doc.s3.amazonaws.com/2006-03-01'>
  <Name>foobar_driver</Name>
  <Contents>
    <Key>2.0/foobar.zip</Key>
    <Size>10</Size>
  </Contents>
  <Contents>
    <Key>2.1/foobar.zip</Key>
    <Size>11</Size>
  </Contents>
</ListBucketResult>`;

const jsonObjectContents = `{
  "foo": "abc",
  "bar": 123,
  "baz": {
    "num": 101,
    "list": ["a", "b", "c"]
  }
}`;

const jsonArrayContents = `[{
  "foo": "abc"
}, {
  "foo": "def"
}, {
  "foo": "ghi"
}]`;


describe('file_utils', () => {
  describe('isExpired', () => {
    it('should return true if the file is zero', () => {
      let mtime = Date.now() - 1000;
      spyOn(fs, 'statSync').and.returnValue({
        size: 0,
        mtime: mtime
      });
      expect(isExpired('foobar.xml')).toBeTruthy();
    });
  
    it('should return true if the file is zero', () => {
      let mtime = Date.now() - (60 * 60 * 1000) - 5000;
      spyOn(fs, 'statSync').and.returnValue({
        size: 1000,
        mtime: mtime
      });
      expect(isExpired('foobar.xml')).toBeTruthy();
    });
  
    it('should return true if the file is zero', () => {
      let mtime = Date.now() - (60 * 60 * 1000) + 5000;
      spyOn(fs, 'statSync').and.returnValue({
        size: 1000,
        mtime: mtime
      });
      expect(isExpired('foobar.xml')).toBeFalsy();
    });  
  });
  
  describe('readXml', () => {
    it('should read the file', () => {
      spyOn(fs, 'readFileSync').and.returnValue(xmlContents);
      let xmlContent = readXml('foobar');
      expect(xmlContent['ListBucketResult']['Name'][0]).toBe('foobar_driver');
      expect(xmlContent['ListBucketResult']['Contents'][0]['Key'][0])
        .toBe('2.0/foobar.zip');
    });

    it('should get null if reading the file fails', () => {
      let xmlContent = readXml('foobar');
      expect(xmlContent).toBeNull();
    });
  });
  
  describe('convertXml2js', () => {
    it('should convert the content to json', () => {
      let xmlContent = convertXml2js(xmlContents);
      expect(xmlContent['ListBucketResult']['Name'][0]).toBe('foobar_driver');
      expect(xmlContent['ListBucketResult']['Contents'][0]['Key'][0])
        .toBe('2.0/foobar.zip');
    });    
  });

  describe('readJson', () => {
    it('should read the json object from file', () => {
      spyOn(fs, 'readFileSync').and.returnValue(jsonObjectContents);
      let jsonObj = readJson('foobar') as JsonObject;
      expect(jsonObj['foo']).toBe('abc');
      expect(jsonObj['bar']).toBe(123);
      expect(jsonObj['baz']['num']).toBe(101);
      expect(jsonObj['baz']['list'][0]).toBe('a');
      expect(jsonObj['baz']['list'][1]).toBe('b');
      expect(jsonObj['baz']['list'][2]).toBe('c');
    });

    it('should read the json array from file', () => {
      spyOn(fs, 'readFileSync').and.returnValue(jsonArrayContents);
      let jsonArray = readJson('foobar') as JsonObject[];
      expect(jsonArray.length).toBe(3);
      expect(jsonArray[0]['foo']).toBe('abc');
      expect(jsonArray[1]['foo']).toBe('def');
      expect(jsonArray[2]['foo']).toBe('ghi');
    });

    it('should get null if reading the file fails', () => {
      let jsoNContent = readJson('foobar');
      expect(jsoNContent).toBeNull();
    });
  });

  describe('getMatchingFiles', () => {
    it('should find a set of matching files', () => {
      let existingFiles = [
        'foo.zip',
        'foo_.zip',
        'foo_12.2',
        'foo_12.4',
        'foo.xml',
        'foo_.xml',
        'bar.tar.gz',
        'bar_10.1.1',
        'bar_10.1.2',
        'bar.json',
      ];
      let fileBinaryPathRegex: RegExp = /foo_\d+.\d+/g;
      spyOn(fs, 'readdirSync').and.returnValue(existingFiles);
      let matchedFiles = getMatchingFiles('/path/to', fileBinaryPathRegex);
      expect(matchedFiles[0]).toContain('foo_12.2');
      expect(matchedFiles[1]).toContain('foo_12.4');
    });
  });
});

