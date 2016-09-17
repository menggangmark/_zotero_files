{
  "translatorID": "36a3b0b5-bad0-4a04-b79b-441c7cef77db",
  "label": "BetterBibTeX JSON",
  "creator": "Emiliano Heyns",
  "target": "json",
  "minVersion": "3.0b3",
  "maxVersion": "",
  "configOptions": {
    "getCollections": true
  },
  "displayOptions": {
    "exportNotes": true,
    "exportFileData": false
  },
  "translatorType": 3,
  "browserSupport": "gcsv",
  "priority": 100,
  "inRepository": true,
  "lastUpdated": "2016-09-13 07:59:06"
}

// SOURCE: resource/translators/json5.js
// json5.js
// Modern JSON. See README.md for details.
//
// This file is based directly off of Douglas Crockford's json_parse.js:
// https://github.com/douglascrockford/JSON-js/blob/master/json_parse.js

var JSON5 = (typeof exports === 'object' ? exports : {});

JSON5.parse = (function () {
    "use strict";

// This is a function that can parse a JSON5 text, producing a JavaScript
// data structure. It is a simple, recursive descent parser. It does not use
// eval or regular expressions, so it can be used as a model for implementing
// a JSON5 parser in other languages.

// We are defining the function inside of another function to avoid creating
// global variables.

    var at,           // The index of the current character
        lineNumber,   // The current line number
        columnNumber, // The current column number
        ch,           // The current character
        escapee = {
            "'":  "'",
            '"':  '"',
            '\\': '\\',
            '/':  '/',
            '\n': '',       // Replace escaped newlines in strings w/ empty string
            b:    '\b',
            f:    '\f',
            n:    '\n',
            r:    '\r',
            t:    '\t'
        },
        ws = [
            ' ',
            '\t',
            '\r',
            '\n',
            '\v',
            '\f',
            '\xA0',
            '\uFEFF'
        ],
        text,

        renderChar = function (chr) {
            return chr === '' ? 'EOF' : "'" + chr + "'";
        },

        error = function (m) {

// Call error when something is wrong.

            var error = new SyntaxError();
            // beginning of message suffix to agree with that provided by Gecko - see https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
            error.message = m + " at line " + lineNumber + " column " + columnNumber + " of the JSON5 data. Still to read: " + JSON.stringify(text.substring(at - 1, at + 19));
            error.at = at;
            // These two property names have been chosen to agree with the ones in Gecko, the only popular
            // environment which seems to supply this info on JSON.parse
            error.lineNumber = lineNumber;
            error.columnNumber = columnNumber;
            throw error;
        },

        next = function (c) {

// If a c parameter is provided, verify that it matches the current character.

            if (c && c !== ch) {
                error("Expected " + renderChar(c) + " instead of " + renderChar(ch));
            }

// Get the next character. When there are no more characters,
// return the empty string.

            ch = text.charAt(at);
            at++;
            columnNumber++;
            if (ch === '\n' || ch === '\r' && peek() !== '\n') {
                lineNumber++;
                columnNumber = 0;
            }
            return ch;
        },

        peek = function () {

// Get the next character without consuming it or
// assigning it to the ch varaible.

            return text.charAt(at);
        },

        identifier = function () {

// Parse an identifier. Normally, reserved words are disallowed here, but we
// only use this for unquoted object keys, where reserved words are allowed,
// so we don't check for those here. References:
// - http://es5.github.com/#x7.6
// - https://developer.mozilla.org/en/Core_JavaScript_1.5_Guide/Core_Language_Features#Variables
// - http://docstore.mik.ua/orelly/webprog/jscript/ch02_07.htm
// TODO Identifiers can have Unicode "letters" in them; add support for those.

            var key = ch;

            // Identifiers must start with a letter, _ or $.
            if ((ch !== '_' && ch !== '$') &&
                    (ch < 'a' || ch > 'z') &&
                    (ch < 'A' || ch > 'Z')) {
                error("Bad identifier as unquoted key");
            }

            // Subsequent characters can contain digits.
            while (next() && (
                    ch === '_' || ch === '$' ||
                    (ch >= 'a' && ch <= 'z') ||
                    (ch >= 'A' && ch <= 'Z') ||
                    (ch >= '0' && ch <= '9'))) {
                key += ch;
            }

            return key;
        },

        number = function () {

// Parse a number value.

            var number,
                sign = '',
                string = '',
                base = 10;

            if (ch === '-' || ch === '+') {
                sign = ch;
                next(ch);
            }

            // support for Infinity (could tweak to allow other words):
            if (ch === 'I') {
                number = word();
                if (typeof number !== 'number' || isNaN(number)) {
                    error('Unexpected word for number');
                }
                return (sign === '-') ? -number : number;
            }

            // support for NaN
            if (ch === 'N' ) {
              number = word();
              if (!isNaN(number)) {
                error('expected word to be NaN');
              }
              // ignore sign as -NaN also is NaN
              return number;
            }

            if (ch === '0') {
                string += ch;
                next();
                if (ch === 'x' || ch === 'X') {
                    string += ch;
                    next();
                    base = 16;
                } else if (ch >= '0' && ch <= '9') {
                    error('Octal literal');
                }
            }

            switch (base) {
            case 10:
                while (ch >= '0' && ch <= '9' ) {
                    string += ch;
                    next();
                }
                if (ch === '.') {
                    string += '.';
                    while (next() && ch >= '0' && ch <= '9') {
                        string += ch;
                    }
                }
                if (ch === 'e' || ch === 'E') {
                    string += ch;
                    next();
                    if (ch === '-' || ch === '+') {
                        string += ch;
                        next();
                    }
                    while (ch >= '0' && ch <= '9') {
                        string += ch;
                        next();
                    }
                }
                break;
            case 16:
                while (ch >= '0' && ch <= '9' || ch >= 'A' && ch <= 'F' || ch >= 'a' && ch <= 'f') {
                    string += ch;
                    next();
                }
                break;
            }

            if(sign === '-') {
                number = -string;
            } else {
                number = +string;
            }

            if (!isFinite(number)) {
                error("Bad number");
            } else {
                return number;
            }
        },

        string = function () {

// Parse a string value.

            var hex,
                i,
                string = '',
                delim,      // double quote or single quote
                uffff;

// When parsing for string values, we must look for ' or " and \ characters.

            if (ch === '"' || ch === "'") {
                delim = ch;
                while (next()) {
                    if (ch === delim) {
                        next();
                        return string;
                    } else if (ch === '\\') {
                        next();
                        if (ch === 'u') {
                            uffff = 0;
                            for (i = 0; i < 4; i += 1) {
                                hex = parseInt(next(), 16);
                                if (!isFinite(hex)) {
                                    break;
                                }
                                uffff = uffff * 16 + hex;
                            }
                            string += String.fromCharCode(uffff);
                        } else if (ch === '\r') {
                            if (peek() === '\n') {
                                next();
                            }
                        } else if (typeof escapee[ch] === 'string') {
                            string += escapee[ch];
                        } else {
                            break;
                        }
                    } else if (ch === '\n') {
                        // unescaped newlines are invalid; see:
                        // https://github.com/aseemk/json5/issues/24
                        // TODO this feels special-cased; are there other
                        // invalid unescaped chars?
                        break;
                    } else {
                        string += ch;
                    }
                }
            }
            error("Bad string");
        },

        inlineComment = function () {

// Skip an inline comment, assuming this is one. The current character should
// be the second / character in the // pair that begins this inline comment.
// To finish the inline comment, we look for a newline or the end of the text.

            if (ch !== '/') {
                error("Not an inline comment");
            }

            do {
                next();
                if (ch === '\n' || ch === '\r') {
                    next();
                    return;
                }
            } while (ch);
        },

        blockComment = function () {

// Skip a block comment, assuming this is one. The current character should be
// the * character in the /* pair that begins this block comment.
// To finish the block comment, we look for an ending */ pair of characters,
// but we also watch for the end of text before the comment is terminated.

            if (ch !== '*') {
                error("Not a block comment");
            }

            do {
                next();
                while (ch === '*') {
                    next('*');
                    if (ch === '/') {
                        next('/');
                        return;
                    }
                }
            } while (ch);

            error("Unterminated block comment");
        },

        comment = function () {

// Skip a comment, whether inline or block-level, assuming this is one.
// Comments always begin with a / character.

            if (ch !== '/') {
                error("Not a comment");
            }

            next('/');

            if (ch === '/') {
                inlineComment();
            } else if (ch === '*') {
                blockComment();
            } else {
                error("Unrecognized comment");
            }
        },

        white = function () {

// Skip whitespace and comments.
// Note that we're detecting comments by only a single / character.
// This works since regular expressions are not valid JSON(5), but this will
// break if there are other valid values that begin with a / character!

            while (ch) {
                if (ch === '/') {
                    comment();
                } else if (ws.indexOf(ch) >= 0) {
                    next();
                } else {
                    return;
                }
            }
        },

        word = function () {

// true, false, or null.

            switch (ch) {
            case 't':
                next('t');
                next('r');
                next('u');
                next('e');
                return true;
            case 'f':
                next('f');
                next('a');
                next('l');
                next('s');
                next('e');
                return false;
            case 'n':
                next('n');
                next('u');
                next('l');
                next('l');
                return null;
            case 'I':
                next('I');
                next('n');
                next('f');
                next('i');
                next('n');
                next('i');
                next('t');
                next('y');
                return Infinity;
            case 'N':
              next( 'N' );
              next( 'a' );
              next( 'N' );
              return NaN;
            }
            error("Unexpected " + renderChar(ch));
        },

        value,  // Place holder for the value function.

        array = function () {

// Parse an array value.

            var array = [];

            if (ch === '[') {
                next('[');
                white();
                while (ch) {
                    if (ch === ']') {
                        next(']');
                        return array;   // Potentially empty array
                    }
                    // ES5 allows omitting elements in arrays, e.g. [,] and
                    // [,null]. We don't allow this in JSON5.
                    if (ch === ',') {
                        error("Missing array element");
                    } else {
                        array.push(value());
                    }
                    white();
                    // If there's no comma after this value, this needs to
                    // be the end of the array.
                    if (ch !== ',') {
                        next(']');
                        return array;
                    }
                    next(',');
                    white();
                }
            }
            error("Bad array");
        },

        object = function () {

// Parse an object value.

            var key,
                object = {};

            if (ch === '{') {
                next('{');
                white();
                while (ch) {
                    if (ch === '}') {
                        next('}');
                        return object;   // Potentially empty object
                    }

                    // Keys can be unquoted. If they are, they need to be
                    // valid JS identifiers.
                    if (ch === '"' || ch === "'") {
                        key = string();
                    } else {
                        key = identifier();
                    }

                    white();
                    next(':');
                    object[key] = value();
                    white();
                    // If there's no comma after this pair, this needs to be
                    // the end of the object.
                    if (ch !== ',') {
                        next('}');
                        return object;
                    }
                    next(',');
                    white();
                }
            }
            error("Bad object");
        };

    value = function () {

// Parse a JSON value. It could be an object, an array, a string, a number,
// or a word.

        white();
        switch (ch) {
        case '{':
            return object();
        case '[':
            return array();
        case '"':
        case "'":
            return string();
        case '-':
        case '+':
        case '.':
            return number();
        default:
            return ch >= '0' && ch <= '9' ? number() : word();
        }
    };

// Return the json_parse function. It will have access to all of the above
// functions and variables.

    return function (source, reviver) {
        var result;

        text = String(source);
        at = 0;
        lineNumber = 1;
        columnNumber = 1;
        ch = ' ';
        result = value();
        white();
        if (ch) {
            error("Syntax error");
        }

// If there is a reviver function, we recursively walk the new structure,
// passing each name/value pair to the reviver function for possible
// transformation, starting with a temporary root object that holds the result
// in an empty key. If there is not a reviver function, we simply return the
// result.

        return typeof reviver === 'function' ? (function walk(holder, key) {
            var k, v, value = holder[key];
            if (value && typeof value === 'object') {
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = walk(value, k);
                        if (v !== undefined) {
                            value[k] = v;
                        } else {
                            delete value[k];
                        }
                    }
                }
            }
            return reviver.call(holder, key, value);
        }({'': result}, '')) : result;
    };
}());

// JSON5 stringify will not quote keys where appropriate
JSON5.stringify = function (obj, replacer, space) {
    if (replacer && (typeof(replacer) !== "function" && !isArray(replacer))) {
        throw new Error('Replacer must be a function or an array');
    }
    var getReplacedValueOrUndefined = function(holder, key, isTopLevel) {
        var value = holder[key];

        // Replace the value with its toJSON value first, if possible
        if (value && value.toJSON && typeof value.toJSON === "function") {
            value = value.toJSON();
        }

        // If the user-supplied replacer if a function, call it. If it's an array, check objects' string keys for
        // presence in the array (removing the key/value pair from the resulting JSON if the key is missing).
        if (typeof(replacer) === "function") {
            return replacer.call(holder, key, value);
        } else if(replacer) {
            if (isTopLevel || isArray(holder) || replacer.indexOf(key) >= 0) {
                return value;
            } else {
                return undefined;
            }
        } else {
            return value;
        }
    };

    function isWordChar(c) {
        return (c >= 'a' && c <= 'z') ||
            (c >= 'A' && c <= 'Z') ||
            (c >= '0' && c <= '9') ||
            c === '_' || c === '$';
    }

    function isWordStart(c) {
        return (c >= 'a' && c <= 'z') ||
            (c >= 'A' && c <= 'Z') ||
            c === '_' || c === '$';
    }

    function isWord(key) {
        if (typeof key !== 'string') {
            return false;
        }
        if (!isWordStart(key[0])) {
            return false;
        }
        var i = 1, length = key.length;
        while (i < length) {
            if (!isWordChar(key[i])) {
                return false;
            }
            i++;
        }
        return true;
    }

    // export for use in tests
    JSON5.isWord = isWord;

    // polyfills
    function isArray(obj) {
        if (Array.isArray) {
            return Array.isArray(obj);
        } else {
            return Object.prototype.toString.call(obj) === '[object Array]';
        }
    }

    function isDate(obj) {
        return Object.prototype.toString.call(obj) === '[object Date]';
    }

    var objStack = [];
    function checkForCircular(obj) {
        for (var i = 0; i < objStack.length; i++) {
            if (objStack[i] === obj) {
                throw new TypeError("Converting circular structure to JSON");
            }
        }
    }

    function makeIndent(str, num, noNewLine) {
        if (!str) {
            return "";
        }
        // indentation no more than 10 chars
        if (str.length > 10) {
            str = str.substring(0, 10);
        }

        var indent = noNewLine ? "" : "\n";
        for (var i = 0; i < num; i++) {
            indent += str;
        }

        return indent;
    }

    var indentStr;
    if (space) {
        if (typeof space === "string") {
            indentStr = space;
        } else if (typeof space === "number" && space >= 0) {
            indentStr = makeIndent(" ", space, true);
        } else {
            // ignore space parameter
        }
    }

    // Copied from Crokford's implementation of JSON
    // See https://github.com/douglascrockford/JSON-js/blob/e39db4b7e6249f04a195e7dd0840e610cc9e941e/json2.js#L195
    // Begin
    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        meta = { // table of character substitutions
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    };
    function escapeString(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.
        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ?
                c :
                '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }
    // End

    function internalStringify(holder, key, isTopLevel) {
        var buffer, res;

        // Replace the value, if necessary
        var obj_part = getReplacedValueOrUndefined(holder, key, isTopLevel);

        if (obj_part && !isDate(obj_part)) {
            // unbox objects
            // don't unbox dates, since will turn it into number
            obj_part = obj_part.valueOf();
        }
        switch(typeof obj_part) {
            case "boolean":
                return obj_part.toString();

            case "number":
                if (isNaN(obj_part) || !isFinite(obj_part)) {
                    return "null";
                }
                return obj_part.toString();

            case "string":
                return escapeString(obj_part.toString());

            case "object":
                if (obj_part === null) {
                    return "null";
                } else if (isArray(obj_part)) {
                    checkForCircular(obj_part);
                    buffer = "[";
                    objStack.push(obj_part);

                    for (var i = 0; i < obj_part.length; i++) {
                        res = internalStringify(obj_part, i, false);
                        buffer += makeIndent(indentStr, objStack.length);
                        if (res === null || typeof res === "undefined") {
                            buffer += "null";
                        } else {
                            buffer += res;
                        }
                        if (i < obj_part.length-1) {
                            buffer += ",";
                        } else if (indentStr) {
                            buffer += "\n";
                        }
                    }
                    objStack.pop();
                    buffer += makeIndent(indentStr, objStack.length, true) + "]";
                } else {
                    checkForCircular(obj_part);
                    buffer = "{";
                    var nonEmpty = false;
                    objStack.push(obj_part);
                    for (var prop in obj_part) {
                        if (obj_part.hasOwnProperty(prop)) {
                            var value = internalStringify(obj_part, prop, false);
                            isTopLevel = false;
                            if (typeof value !== "undefined" && value !== null) {
                                buffer += makeIndent(indentStr, objStack.length);
                                nonEmpty = true;
                                key = isWord(prop) ? prop : escapeString(prop);
                                buffer += key + ":" + (indentStr ? ' ' : '') + value + ",";
                            }
                        }
                    }
                    objStack.pop();
                    if (nonEmpty) {
                        buffer = buffer.substring(0, buffer.length-1) + makeIndent(indentStr, objStack.length) + "}";
                    } else {
                        buffer = '{}';
                    }
                }
                return buffer;
            default:
                // functions and undefined should be ignored
                return undefined;
        }
    }

    // special case...when undefined is used inside of
    // a compound object/array, return null.
    // but when top-level, return undefined
    var topLevelHolder = {"":obj};
    if (obj === undefined) {
        return getReplacedValueOrUndefined(topLevelHolder, '', true);
    }
    return internalStringify(topLevelHolder, '', true);
};

// SOURCE: resource/translators/translator.js
// Generated by CoffeeScript 1.10.0
var JabRef, Translator, name, ref, v,
  slice = [].slice,
  hasProp = {}.hasOwnProperty;

Translator = {};

Translator._log = function() {
  var j, len, level, m, msg, str;
  level = arguments[0], msg = 2 <= arguments.length ? slice.call(arguments, 1) : [];
  str = [];
  for (j = 0, len = msg.length; j < len; j++) {
    m = msg[j];
    switch (false) {
      case !(m instanceof Error):
        m = "<Exception: " + (m.message || m.name) + (m.stack ? '\n' + m.stack : '') + ">";
        break;
      case !(m instanceof String):
        m = '' + m;
        break;
      default:
        m = Zotero.Utilities.varDump(m);
    }
    if (m) {
      str.push(m);
    }
  }
  str = str.join(' ');
  return Zotero.debug('[better' + '-' + ("bibtex:" + this.header.label + "] ") + str, level);
};

Translator.debug_off = function() {};

Translator.debug = Translator.debug_on = function() {
  var msg;
  msg = 1 <= arguments.length ? slice.call(arguments, 0) : [];
  return this._log.apply(this, [5].concat(msg));
};

Translator.log_off = function() {};

Translator.log = Translator.log_on = function() {
  var msg;
  msg = 1 <= arguments.length ? slice.call(arguments, 0) : [];
  return this._log.apply(this, [3].concat(msg));
};

Translator.HTMLEncode = function(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

Translator.stringify = function(obj, replacer, spaces, cycleReplacer) {
  var j, key, keys, len, o, str;
  str = JSON.stringify(obj, this.stringifier(replacer, cycleReplacer), spaces);
  if (Array.isArray(obj)) {
    keys = Object.keys(obj);
    if (keys.length > 0) {
      o = {};
      for (j = 0, len = keys.length; j < len; j++) {
        key = keys[j];
        if (key.match(/^\d+$/)) {
          continue;
        }
        o[key] = obj[key];
      }
      str += '+' + this.stringify(o);
    }
  }
  return str;
};

Translator.locale = function(language) {
  var base, j, k, len, ll, locale, ref, v;
  if (!this.languages.locales[language]) {
    ll = language.toLowerCase();
    ref = this.languages.langs;
    for (j = 0, len = ref.length; j < len; j++) {
      locale = ref[j];
      for (k in locale) {
        v = locale[k];
        if (ll === v) {
          this.languages.locales[language] = locale[1];
        }
      }
      if (this.languages.locales[language]) {
        break;
      }
    }
    (base = this.languages.locales)[language] || (base[language] = language);
  }
  return this.languages.locales[language];
};

Translator.stringifier = function(replacer, cycleReplacer) {
  var keys, stack;
  stack = [];
  keys = [];
  if (cycleReplacer === null) {
    cycleReplacer = function(key, value) {
      if (stack[0] === value) {
        return '[Circular ~]';
      }
      return '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']';
    };
  }
  return function(key, value) {
    var thisPos;
    if (stack.length > 0) {
      thisPos = stack.indexOf(this);
      if (~thisPos) {
        stack.splice(thisPos + 1);
      } else {
        stack.push(this);
      }
      if (~thisPos) {
        keys.splice(thisPos, Infinity, key);
      } else {
        keys.push(key);
      }
      if (~stack.indexOf(value)) {
        value = cycleReplacer.call(this, key, value);
      }
    } else {
      stack.push(value);
    }
    if (replacer === null || replacer === void 0) {
      return value;
    }
    return replacer.call(this, key, value);
  };
};


/* http://docs.citationstyles.org/en/stable/specification.html#appendix-iv-variables */

Translator.CSLVariables = {
  archive: {},
  'archive_location': {},
  'archive-place': {},
  authority: {
    BibLaTeX: 'institution'
  },
  'call-number': {
    BibTeX: 'lccn'
  },
  'collection-title': {},
  'container-title': {
    BibLaTeX: function() {
      switch (this.item.itemType) {
        case 'film':
        case 'tvBroadcast':
        case 'videoRecording':
          return 'booktitle';
        case 'bookSection':
          return 'maintitle';
        default:
          return 'journaltitle';
      }
    }
  },
  'container-title-short': {},
  dimensions: {},
  DOI: {
    BibTeX: 'doi',
    BibLaTeX: 'doi'
  },
  event: {},
  'event-place': {},
  genre: {},
  ISBN: {
    BibTeX: 'isbn',
    BibLaTeX: 'isbn'
  },
  ISSN: {
    BibTeX: 'issn',
    BibLaTeX: 'issn'
  },
  jurisdiction: {},
  keyword: {},
  locator: {},
  medium: {},
  'original-publisher': {
    BibLaTeX: 'origpublisher',
    type: 'literal'
  },
  'original-publisher-place': {
    BibLaTeX: 'origlocation',
    type: 'literal'
  },
  'original-title': {
    BibLaTeX: 'origtitle'
  },
  page: {},
  'page-first': {},
  PMCID: {},
  PMID: {},
  publisher: {},
  'publisher-place': {
    BibLaTeX: 'location',
    type: 'literal'
  },
  references: {},
  'reviewed-title': {},
  scale: {},
  section: {},
  source: {},
  status: {},
  title: {
    BibLaTeX: function() {
      if (this.referencetype === 'book') {
        return 'maintitle';
      } else {
        return null;
      }
    }
  },
  'title-short': {},
  URL: {},
  version: {},
  'volume-title': {
    BibLaTeX: function() {
      switch (this.item.itemType) {
        case 'book':
          return 'title';
        case 'bookSection':
          return 'booktitle';
        default:
          return null;
      }
    }
  },
  'year-suffix': {},
  'chapter-number': {},
  'collection-number': {},
  edition: {},
  issue: {},
  number: {
    BibLaTeX: 'number'
  },
  'number-of-pages': {},
  'number-of-volumes': {},
  volume: {
    BibLaTeX: 'volume'
  },
  accessed: {
    type: 'date'
  },
  container: {
    type: 'date'
  },
  'event-date': {
    type: 'date'
  },
  issued: {
    type: 'date',
    BibLaTeX: 'date'
  },
  'original-date': {
    type: 'date',
    BibLaTeX: 'origdate'
  },
  submitted: {
    type: 'date'
  },
  author: {
    type: 'creator',
    BibLaTeX: 'author'
  },
  'collection-editor': {
    type: 'creator'
  },
  composer: {
    type: 'creator'
  },
  'container-author': {
    type: 'creator'
  },
  director: {
    type: 'creator',
    BibLaTeX: 'director'
  },
  editor: {
    type: 'creator',
    BibLaTeX: 'editor'
  },
  'editorial-director': {
    type: 'creator'
  },
  illustrator: {
    type: 'creator'
  },
  interviewer: {
    type: 'creator'
  },
  'original-author': {
    type: 'creator'
  },
  recipient: {
    type: 'creator'
  },
  'reviewed-author': {
    type: 'creator'
  },
  translator: {
    type: 'creator'
  }
};

ref = Translator.CSLVariables;
for (name in ref) {
  v = ref[name];
  v.name = name;
}

Translator.CSLVariable = function(name) {
  return this.CSLVariables[name] || this.CSLVariables[name.toLowerCase()] || this.CSLVariables[name.toUpperCase()];
};

Translator.CSLCreator = function(value) {
  var creator;
  creator = value.split(/\s*\|\|\s*/);
  if (creator.length === 2) {
    return {
      lastName: creator[0] || '',
      firstName: creator[1] || ''
    };
  } else {
    return {
      name: value
    };
  }
};

Translator.extractFieldsKVRE = new RegExp("^\\s*(" + (Object.keys(Translator.CSLVariables).join('|')) + "|LCCN|MR|Zbl|arXiv|JSTOR|HDL|GoogleBooksID)\\s*:\\s*(.+)\\s*$", 'i');

Translator.extractFields = function(item) {
  var assignment, cslvar, data, error, extra, fields, j, json, l, len, len1, line, m, prefix, raw, ref1, ref2, ref3, value;
  if (!item.extra) {
    return {};
  }
  fields = {};
  m = /(biblatexdata|bibtex|biblatex)(\*)?\[([^\]]+)\]/.exec(item.extra);
  if (m) {
    item.extra = item.extra.replace(m[0], '').trim();
    ref1 = m[3].split(';');
    for (j = 0, len = ref1.length; j < len; j++) {
      assignment = ref1[j];
      data = assignment.match(/^([^=]+)=\s*(.*)/);
      if (data) {
        fields[data[1].toLowerCase()] = {
          value: data[2],
          format: 'naive',
          raw: !m[2]
        };
      } else {
        Translator.debug("Not an assignment: " + assignment);
      }
    }
  }
  m = /(biblatexdata|bibtex|biblatex)(\*)?({[\s\S]+})/.exec(item.extra);
  if (m) {
    prefix = m[1] + (m[2] || '');
    raw = !m[2];
    data = m[3];
    while (data.indexOf('}') >= 0) {
      try {
        json = JSON5.parse(data);
      } catch (error) {
        json = null;
      }
      if (json) {
        break;
      }
      data = data.replace(/[^}]*}$/, '');
    }
    if (json) {
      item.extra = item.extra.replace(prefix + data, '').trim();
      for (name in json) {
        if (!hasProp.call(json, name)) continue;
        value = json[name];
        fields[name.toLowerCase()] = {
          value: value,
          format: 'json',
          raw: raw
        };
      }
    }
  }

  /* fetch fields as per https://forums.zotero.org/discussion/3673/2/original-date-of-publication/ */
  item.extra = item.extra.replace(/{:([^:]+):\s*([^}]+)}/g, (function(_this) {
    return function(m, name, value) {
      var cslvar, ref2;
      cslvar = Translator.CSLVariable(name);
      if (!cslvar) {
        return '';
      }
      if (cslvar.type === 'creator') {
        if (!Array.isArray((ref2 = fields[name]) != null ? ref2.value : void 0)) {
          fields[cslvar.name] = {
            value: [],
            format: 'csl'
          };
        }
        fields[cslvar.name].value.push(_this.CSLCreator(value));
      } else {
        fields[cslvar.name] = {
          value: value,
          format: 'csl'
        };
      }
      return '';
    };
  })(this));
  extra = [];
  ref2 = item.extra.split("\n");
  for (l = 0, len1 = ref2.length; l < len1; l++) {
    line = ref2[l];
    m = Translator.extractFieldsKVRE.exec(line);
    cslvar = m ? this.CSLVariable(m[1]) : null;
    switch (false) {
      case !!m:
        extra.push(line);
        break;
      case !!cslvar:
        fields[m[1].toLowerCase()] = {
          value: m[2].trim(),
          format: 'key-value'
        };
        break;
      case cslvar.type !== 'creator':
        if (!Array.isArray((ref3 = fields[cslvar.name]) != null ? ref3.value : void 0)) {
          fields[cslvar.name] = {
            value: [],
            format: 'csl'
          };
        }
        fields[cslvar.name].value.push(this.CSLCreator(m[2].trim()));
        break;
      default:
        fields[cslvar.name] = {
          value: m[2].trim(),
          format: 'csl'
        };
    }
  }
  item.extra = extra.join("\n");
  item.extra = item.extra.trim();
  if (item.extra === '') {
    delete item.extra;
  }
  return fields;
};

Translator.initialize = function() {
  var attr, base, base1, bibtex, cfg, ch, collection, f, field, i, j, k, l, len, len1, len2, len3, len4, n, option, p, pref, q, ref1, ref2, ref3, ref4, ref5, type, typeMap, zotero;
  if (this.initialized) {
    return;
  }
  this.initialized = true;
  this.citekeys = Object.create(null);
  this.attachmentCounter = 0;
  this.rawLaTag = '#LaTeX';
  this.BibLaTeXDataFieldMap = Object.create(null);
  this.translatorID = this.header.translatorID;
  this.testing = Zotero.getHiddenPref('better-bibtex.tests') !== '';
  if (this.testing) {
    this.testing_timestamp = Zotero.getHiddenPref('better-bibtex.test.timestamp');
  }
  ref1 = this.fieldMap || {};
  for (attr in ref1) {
    if (!hasProp.call(ref1, attr)) continue;
    f = ref1[attr];
    if (f.name) {
      this.BibLaTeXDataFieldMap[f.name] = f;
    }
  }
  ref2 = Object.keys(this.preferences);
  for (j = 0, len = ref2.length; j < len; j++) {
    pref = ref2[j];
    this.preferences[pref] = this[pref] = Zotero.getHiddenPref("better-bibtex." + pref);
  }
  this.skipWords = this.skipWords.trim().split(/\s*,\s*/);
  this.titleCaseLowerCase = this.titleCaseLowerCase.trim().split(/\s+/);
  this.skipFields = (function() {
    var l, len1, ref3, results;
    ref3 = (this.skipFields || '').split(',');
    results = [];
    for (l = 0, len1 = ref3.length; l < len1; l++) {
      field = ref3[l];
      if (field.trim()) {
        results.push(field.trim());
      }
    }
    return results;
  }).call(this);
  if (this.csquotes) {
    this.csquotes = {
      open: '',
      close: ''
    };
    ref3 = Translator.preferences.csquotes;
    for (i = l = 0, len1 = ref3.length; l < len1; i = ++l) {
      ch = ref3[i];
      if (i % 2 === 0) {
        this.csquotes.open += ch;
      } else {
        this.csquotes.close += ch;
      }
    }
  }
  this.options = {};
  ref4 = ['useJournalAbbreviation', 'exportPath', 'exportFilename', 'exportCharset', 'exportFileData', 'exportNotes'];
  for (n = 0, len2 = ref4.length; n < len2; n++) {
    option = ref4[n];
    this.options[option] = this[option] = Zotero.getOption(option);
  }
  this.caching = !this.exportFileData;
  this.unicode = (function() {
    switch (false) {
      case !(this.BetterBibLaTeX || this.CollectedNotes):
        return !this.asciiBibLaTeX;
      case !this.BetterBibTeX:
        return !this.asciiBibTeX;
      default:
        return true;
    }
  }).call(this);
  if (this.typeMap) {
    typeMap = this.typeMap;
    this.typeMap = {
      BibTeX2Zotero: Object.create(null),
      Zotero2BibTeX: Object.create(null)
    };
    for (bibtex in typeMap) {
      if (!hasProp.call(typeMap, bibtex)) continue;
      zotero = typeMap[bibtex];
      bibtex = bibtex.replace(/^=/, '').trim().split(/\s+/);
      zotero = zotero.trim().split(/\s+/);
      for (p = 0, len3 = bibtex.length; p < len3; p++) {
        type = bibtex[p];
        if ((base = this.typeMap.BibTeX2Zotero)[type] == null) {
          base[type] = zotero[0];
        }
      }
      for (q = 0, len4 = zotero.length; q < len4; q++) {
        type = zotero[q];
        if ((base1 = this.typeMap.Zotero2BibTeX)[type] == null) {
          base1[type] = bibtex[0];
        }
      }
    }
  }
  if (Zotero.getHiddenPref('better-bibtex.debug')) {
    this.debug = this.debug_on;
    this.log = this.log_on;
    cfg = {};
    for (k in this) {
      if (!hasProp.call(this, k)) continue;
      v = this[k];
      if (typeof v !== 'object') {
        cfg[k] = v;
      }
    }
    this.debug("Translator initialized:", cfg);
  } else {
    this.debug = this.debug_off;
    this.log = this.log_off;
  }
  this.collections = [];
  if (Zotero.nextCollection && ((ref5 = Translator.header.configOptions) != null ? ref5.getCollections : void 0)) {
    while (collection = Zotero.nextCollection()) {
      this.debug('adding collection:', collection);
      this.collections.push(this.sanitizeCollection(collection));
    }
  }
  return this.context = {
    exportCharset: (this.exportCharset || 'UTF-8').toUpperCase(),
    exportNotes: !!this.exportNotes,
    translatorID: this.translatorID,
    useJournalAbbreviation: !!this.useJournalAbbreviation
  };
};

Translator.sanitizeCollection = function(coll) {
  var c, j, len, ref1, sane;
  sane = {
    name: coll.name,
    collections: [],
    items: []
  };
  ref1 = coll.children || coll.descendents;
  for (j = 0, len = ref1.length; j < len; j++) {
    c = ref1[j];
    switch (c.type) {
      case 'item':
        sane.items.push(c.id);
        break;
      case 'collection':
        sane.collections.push(this.sanitizeCollection(c));
        break;
      default:
        throw "Unexpected collection member type '" + c.type + "'";
    }
  }
  if (Translator.testing) {
    sane.collections.sort((function(a, b) {
      return a.name.localeCompare(b.name);
    }));
  }
  return sane;
};

Translator.nextItem = function() {
  var cached, item;
  this.initialize();
  while (item = Zotero.nextItem()) {
    if (item.itemType === 'note' || item.itemType === 'attachment') {
      continue;
    }
    if (this.caching) {
      cached = Zotero.BetterBibTeX.cache.fetch(item.itemID, this.context);
      if (cached != null ? cached.citekey : void 0) {
        Translator.debug('nextItem: cached');
        this.citekeys[item.itemID] = cached.citekey;
        Zotero.write(cached.bibtex);
        continue;
      }
    }
    Zotero.BetterBibTeX.keymanager.extract(item, 'nextItem');
    item.__citekey__ || (item.__citekey__ = Zotero.BetterBibTeX.keymanager.get(item, 'on-export').citekey);
    this.citekeys[item.itemID] = item.__citekey__;
    return item;
  }
  return null;
};

Translator.exportGroups = function() {
  var collection, groups, j, len, ref1;
  this.debug('exportGroups:', this.collections);
  if (this.collections.length === 0 || !this.jabrefGroups) {
    return;
  }
  Zotero.write('@comment{jabref-meta: groupsversion:3;}\n');
  Zotero.write('@comment{jabref-meta: groupstree:\n');
  Zotero.write('0 AllEntriesGroup:;\n');
  this.debug('exportGroups: getting groups');
  groups = [];
  ref1 = this.collections;
  for (j = 0, len = ref1.length; j < len; j++) {
    collection = ref1[j];
    groups = groups.concat(JabRef.exportGroup(collection, 1));
  }
  this.debug('exportGroups: serialize', groups);
  return Zotero.write(JabRef.serialize(groups, ';\n', true) + ';\n}\n');
};

JabRef = {
  serialize: function(arr, sep, wrap) {
    arr = (function() {
      var j, len, results;
      results = [];
      for (j = 0, len = arr.length; j < len; j++) {
        v = arr[j];
        results.push(('' + v).replace(/;/g, "\\;"));
      }
      return results;
    })();
    if (wrap) {
      arr = (function() {
        var j, len, results;
        results = [];
        for (j = 0, len = arr.length; j < len; j++) {
          v = arr[j];
          results.push(v.match(/.{1,70}/g).join("\n"));
        }
        return results;
      })();
    }
    return arr.join(sep);
  },
  exportGroup: function(collection, level) {
    var coll, group, id, j, len, ref1, references, result;
    group = [level + " ExplicitGroup:" + collection.name, 0];
    references = (function() {
      var j, len, ref1, results;
      ref1 = collection.items;
      results = [];
      for (j = 0, len = ref1.length; j < len; j++) {
        id = ref1[j];
        results.push(Translator.citekeys[id]);
      }
      return results;
    })();
    if (Translator.testing) {
      references.sort();
    }
    group = group.concat(references);
    group.push('');
    group = this.serialize(group, ';');
    result = [group];
    ref1 = collection.collections;
    for (j = 0, len = ref1.length; j < len; j++) {
      coll = ref1[j];
      result = result.concat(JabRef.exportGroup(coll, level + 1));
    }
    return result;
  }
};

// SOURCE: resource/translators/preferences.js
Translator.preferences = {
  "asciiBibLaTeX": false,
  "asciiBibTeX": true,
  "attachmentsNoMetadata": false,
  "autoAbbrevStyle": "",
  "autoAbbrev": false,
  "autoExport": "idle",
  "autoExportIdleWait": 10,
  "cacheFlushInterval": 5,
  "cacheReset": 0,
  "confirmCacheResetSize": 1000,
  "caching": true,
  "citeCommand": "cite",
  "citekeyFormat": "[zotero]",
  "citekeyFold": true,
  "debug": false,
  "DOIandURL": "both",
  "bibtexURL": "off",
  "csquotes": "",
  "keyConflictPolicy": "keep",
  "langID": "babel",
  "pinCitekeys": "manual",
  "preserveBibTeXVariables": false,
  "rawImports": false,
  "scanCitekeys": true,
  "showCitekeys": false,
  "showItemIDs": false,
  "skipFields": "",
  "skipWords": "a,ab,aboard,about,above,across,after,against,al,along,amid,among,an,and,anti,around,as,at,before,behind,below,beneath,beside,besides,between,beyond,but,by,d,da,das,de,del,dell,dello,dei,degli,della,dell,delle,dem,den,der,des,despite,die,do,down,du,during,ein,eine,einem,einen,einer,eines,el,en,et,except,for,from,gli,i,il,in,inside,into,is,l,la,las,le,les,like,lo,los,near,nor,of,off,on,onto,or,over,past,per,plus,round,save,since,so,some,sur,than,the,through,to,toward,towards,un,una,unas,under,underneath,une,unlike,uno,unos,until,up,upon,versus,via,von,while,with,within,without,yet,zu,zum",
  "tests": "",
  "warnBulkModify": 10,
  "postscript": "",
  "jabrefGroups": true,
  "defaultDateParserLocale": "",
  "parseParticles": true,
  "titleCaseLowerCase": "about above across afore after against along alongside amid amidst among amongst anenst apropos apud around as aside astride at athwart atop barring before behind below beneath beside besides between beyond but by circa despite down during except for forenenst from given in inside into lest like modulo near next notwithstanding of off on onto out over per plus pro qua sans since than through thru throughout thruout till to toward towards under underneath until unto up upon versus vs. v. vs v via vis-à-vis with within without according to ahead of apart from as for as of as per as regards aside from back to because of close to due to except for far from inside of instead of near to next to on to out from out of outside of prior to pursuant to rather than regardless of such as that of up to where as or yet so and nor a an the de d' von van c et ca thru according ahead apart regards back because close due far instead outside prior pursuant rather regardless such their where",
  "quickCopyMode": "latex",
  "jurismPreferredLanguage": "zh-alalc97",
  "ZotFile": true
}

// SOURCE: resource/translators/BetterBibTeX JSON.header.js

      Translator.header = {"translatorID":"36a3b0b5-bad0-4a04-b79b-441c7cef77db","label":"BetterBibTeX JSON","creator":"Emiliano Heyns","target":"json","minVersion":"3.0b3","maxVersion":"","configOptions":{"getCollections":true},"displayOptions":{"exportNotes":true,"exportFileData":false},"translatorType":3,"browserSupport":"gcsv","priority":100,"inRepository":true};
      Translator.release = "1.6.75";
      Translator.BetterBibTeXJSON = true;
    

// SOURCE: resource/translators/BetterBibTeX JSON.js
// Generated by CoffeeScript 1.10.0
var detectImport, doExport, doImport, scrub,
  hasProp = {}.hasOwnProperty;

scrub = function(item) {
  var attachment, attr, citekeys, note, tag, val;
  delete item.__citekey__;
  delete item.libraryID;
  delete item.key;
  delete item.uniqueFields;
  delete item.dateAdded;
  delete item.dateModified;
  delete item.uri;
  delete item.attachmentIDs;
  delete item.collections;
  item.attachments = (function() {
    var j, len, ref, results;
    ref = item.attachments || [];
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      attachment = ref[j];
      results.push({
        path: attachment.localPath,
        title: attachment.title,
        mimeType: attachment.mimeType,
        url: attachment.url
      });
    }
    return results;
  })();
  item.notes = (function() {
    var j, len, ref, results;
    ref = item.notes || [];
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      note = ref[j];
      results.push(note.note.trim());
    }
    return results;
  })();
  item.tags = (function() {
    var j, len, ref, results;
    ref = item.tags || [];
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      tag = ref[j];
      results.push(tag.tag);
    }
    return results;
  })();
  item.tags.sort();
  for (attr in item) {
    if (!hasProp.call(item, attr)) continue;
    val = item[attr];
    if (typeof val === 'number') {
      continue;
    }
    if (Array.isArray(val) && val.length !== 0) {
      continue;
    }
    switch (typeof val) {
      case 'string':
        if (val.trim() === '') {
          delete item[attr];
        }
        break;
      case 'undefined':
        delete item[attr];
    }
  }
  citekeys = Zotero.BetterBibTeX.keymanager.alternates(item);
  switch (false) {
    case !(!citekeys || citekeys.length === 0):
      break;
    case citekeys.length !== 1:
      item.__citekey__ = citekeys[0];
      break;
    default:
      item.__citekeys__ = citekeys;
  }
  return item;
};

detectImport = function() {
  var data, e, error, json, match, ref, str;
  json = '';
  while ((str = Zotero.read(0x100000)) !== false) {
    json += str;
  }
  try {
    data = JSON.parse(json);
  } catch (error) {
    e = error;
    Translator.log('BetterBibTeX JSON.detect failed:', e);
    return false;
  }
  match = (data != null ? (ref = data.config) != null ? ref.id : void 0 : void 0) === Translator.header.translatorID && data.items;
  Translator.log('BetterBibTeX JSON.detect:', match);
  return match;
};

doImport = function() {
  var att, data, i, item, j, json, k, len, len1, prop, ref, ref1, results, str, value;
  json = '';
  while ((str = Zotero.read(0x100000)) !== false) {
    json += str;
  }
  data = JSON.parse(json);
  ref = data.items;
  results = [];
  for (j = 0, len = ref.length; j < len; j++) {
    i = ref[j];

    /* works around https://github.com/Juris-M/zotero/issues/20 */
    if (i.multi) {
      delete i.multi.main;
    }
    item = new Zotero.Item();
    for (prop in i) {
      if (!hasProp.call(i, prop)) continue;
      value = i[prop];
      item[prop] = value;
    }
    ref1 = item.attachments || [];
    for (k = 0, len1 = ref1.length; k < len1; k++) {
      att = ref1[k];
      if (att.url) {
        delete att.path;
      }
    }
    results.push(item.complete());
  }
  return results;
};

doExport = function() {
  var data, item;
  Translator.initialize();
  data = {
    config: {
      id: Translator.header.translatorID,
      label: Translator.header.label,
      release: Translator.release,
      preferences: Translator.preferences,
      options: Translator.options
    },
    collections: Translator.collections,
    items: [],
    cache: {}
  };
  while (item = Zotero.nextItem()) {
    data.items.push(scrub(item));
  }
  if (Zotero.getHiddenPref('better-bibtex.debug')) {
    data.keymanager = Zotero.BetterBibTeX.keymanager.cache();
    data.cache.items = Zotero.BetterBibTeX.cache.dump((function() {
      var j, len, ref, results;
      ref = data.items;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        item = ref[j];
        results.push(item.itemID);
      }
      return results;
    })());
  }
  Zotero.write(JSON.stringify(data, null, '  '));
};
