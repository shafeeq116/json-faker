var faker = require('faker');
var fs = require('fs');

var JsonFaker = function () {
  this.validValueTypes = ['object', 'json', 'jsonString'];
  this.fileList = [];
  this.userTemplate = {};
};

JsonFaker.prototype.process = function (content, userTemplate) {
  this.userTemplate = userTemplate;
  var inputType = this.getInputType(content);
  if (!this.validValueTypes.includes(inputType)) return 'Invalid input data';

  if (inputType === 'json') this.fileList.push(content);

  var jsonObj = this.getJsonObj(content, inputType);
  if (jsonObj === 'Invalid input') return jsonObj;

  var getReturnData = this.generateMock(jsonObj);

  return getReturnData;
};

JsonFaker.prototype.post = function (inputArg) {
  return this.createResponse(inputArg);
};

JsonFaker.prototype.put = function (inputArg) {
  return this.createResponse(inputArg);
};

JsonFaker.prototype.delete = function (inputArg) {
  return this.createResponse(inputArg);
};

JsonFaker.prototype.createResponse = function (inputObj) {
  if (typeof inputObj !== 'object') inputObj = { message: 'Invalid input' };
  else inputObj['id'] = faker.random.uuid();
  return inputObj;
};

JsonFaker.prototype.getInputType = function (input) {
  if (typeof input === 'string') {
    input = this.processTemplate(input, typeof input);
    var fileExtension = input.split('.').pop();
    if (fileExtension === 'json') { // file type json
      return fileExtension;
    } else if (IsJsonString(input)) { // input string json object
      return 'jsonString';
    } else return 'string';
  } else if (input.constructor === Array) return 'array';
  else return typeof input;
};

JsonFaker.prototype.getJsonObj = function (input, inputType) {
  if (inputType === 'object') return input;
  var getContents = this.processTemplate(input, inputType);
  if (inputType === 'json') {
    try {
      return JSON.parse(getContents);
    } catch (e) {
      return 'Invalid input';
    }
  }
  if (inputType === 'jsonString') {
    return JSON.parse(getContents);
  }
};

JsonFaker.prototype.readArray = function (inputArray) {
  var newArray = [];
  var self = this;
  inputArray.forEach(function (element) {
    var valueType = self.getInputType(element);
    if (valueType === 'number') newArray.push(element);
    if (valueType === 'string') {
      let stringProcess = self.stringProcessing(element);
      newArray.push(self.getFakerData(stringProcess));
    }
    if (valueType === 'object') newArray.push(self.generateMock(element));
  });
  return newArray;
};

JsonFaker.prototype.generateMock = function (inputJson) {
  var returnData = {};
  var self = this;
  for (var property in inputJson) {
    if (inputJson.hasOwnProperty(property)) {
      var valueType = self.getInputType(inputJson[property]);
      if (valueType === 'string') {
        let stringProcess = self.stringProcessing(inputJson[property]);
        returnData[property] = self.getFakerData(stringProcess);
      } else if (valueType === 'number') {
        returnData[property] = inputJson[property];
      } else if (valueType === 'object') {
        returnData[property] = self.generateMock(inputJson[property]);
      } else if (valueType === 'array') {
        returnData[property] = self.readArray(inputJson[property]);
      }
    }
  }
  return returnData;
};

JsonFaker.prototype.getFakerData = function (inputValue) {
  if (this.isFaker(inputValue)) {
    return this.createFakerData(inputValue);
  } else return inputValue;
};

JsonFaker.prototype.createFakerData = function (inputValue) {
  var regExp = /(.*)\((.*)\)\)?/;
  /*
  Example
  input => '@faker.name.findName('someArg')
  output =>
  [ '@faker.name.findName(\'someArg\')',
  '@faker.name.findName',
  '\'someArg\'',
  index: 0,
  input: '@faker.name.findName(\'someArg\')' ]
  */
  var [, fakerDef, funcArg] = inputValue.match(regExp);
  var getStructure = fakerDef.split('.');
  var returnData;
  if (getStructure[1] === 'file') {
    funcArg = funcArg.replace(/'/g, '');

    if (this.fileList.includes(funcArg)) return 'infinit loop()';
    else this.fileList.push(funcArg);

    var jsonObj = this.getJsonObj(funcArg, 'json');
    if (jsonObj === 'Invalid input') {
      this.fileList.pop(); // removing file from array after processing
      return jsonObj;
    }

    returnData = this.generateMock(jsonObj);
    this.fileList.pop(); // removing file from array after processing
    return returnData;
  } else {
    if (funcArg[0] === '[') { // checking if it is array
      funcArg = funcArg.replace(/'/g, '"');
      funcArg = JSON.parse(funcArg);
    }

    if (funcArg[0] === '{') { // checking if it is object
      try {
        funcArg = JSON.parse(funcArg);
      } catch (err) {
        // since JSON.parse threw an error, assume parameters was actually a string
        funcArg = funcArg;
      }
    }
    returnData = faker[getStructure[1]][getStructure[2]](funcArg);
  }
  return returnData;
};

JsonFaker.prototype.isFaker = function (inputValue) {
  if (inputValue.split('.')[0] === '@faker') return true;
  else return false;
};

JsonFaker.prototype.processTemplate = function (input, inputType) {
  if (inputType === 'json') {
    input = this.readTemplateFile(input);
  }
  return this.repeatString(input);
};

JsonFaker.prototype.repeatString = function (input) {
  /*
  regEx = /{{repeat\s+(\d+)}}([\s\S]*?){{\/repeat}}/g
  {{repeat - a literal char sequence
  \s+ - 1+ whitespaces
  (\d+) - Group 1: one or more digits
  }} - literal }}
  ([\s\S]*?) - Group 2, any 0+ characters, as few as possible up to the first
  {{\/repeat}} - literal {{/repeat}}.
  */
  var res;
  if (typeof input === 'string') {
    res = input.replace(/{{repeat\s+(\d+)}}([\s\S]*?){{\/repeat}}/g, function ($0, $1, $2) {
      return fillArray($2.trim(), parseInt($1, 10)).join(', ');
    });
  }
  return res;
};

JsonFaker.prototype.readTemplateFile = function (path) {
  try {
    var data = fs.readFileSync(path);
    return data.toString();
  } catch (e) {
    return 'Invalid Input';
  }
};

JsonFaker.prototype.stringProcessing = function (inputString) {
  var self = this;
  inputString = this.repeatString(inputString);
  var result = inputString.replace(/\{{(.+?)\}}/gmi, function (match, textInside) {
    var objectProp = textInside.split('.');
    if (objectProp[0] === '@faker') return self.createFakerData(textInside);
    else {
      var obj = self.userTemplate;
      while (objectProp.length && (obj = obj[objectProp.shift()]));
      return obj;
    }
  });
  return result;
};

function IsJsonString (str) {
  if(!isNaN(Number(str))) return false;
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

function fillArray (s, num) {
  var arr = [];
  for (var i = 0; i < num; i++) {
    arr.push(s);
  }
  return arr;
}

module.exports = new JsonFaker();
