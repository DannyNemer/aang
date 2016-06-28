/**
 * @license
 * dantil
 * Copyright 2015-2016 Danny Nemer <http://dannynemer.com>
 * Available under MIT license <http://opensource.org/licenses/MIT>
 */

var fs = require('fs')
var util = require('util')
var jsdiff = require('diff')

/**
 * Checks if `options` adheres to `schema` using the [`ill-formed-opts`](https://github.com/DannyNemer/ill-formed-opts) module, thereby simulating static function arguments (i.e., type checking and parameter count).
 *
 * Prints descriptive, helpful errors messages when `options` is ill-formed, including the line number of the offending function call.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @param {Object} schema The definition of required and optional properties for `options`.
 * @param {Object} [options] The options object to check for conformity to `schema`.
 * @param {Object} [ignoreUndefined] Specify ignoring non-`required` `options` properties defined as `undefined`. Otherwise, reports them as errors, which is useful for catching broken references.
 * @returns {boolean} Returns `true` if `options` is ill-formed, else `false`.
 * @example
 *
 * var schema = {
 *   // Optionally accept an `boolean` for 'silent'.
 *   silent: Boolean,
 *   // Optionally accept an `Array` of `string`s for 'args'.
 *   args: { type: Array, arrayType: String },
 *   // Require `string` 'modulePath'.
 *   modulePath: { type: String, required: true },
 *   // Optionally accept one of predefined values for 'stdio'.
 *   stdio: { values: [ 'pipe', 'ignore', 0, 1, 2 ] }
 * }
 *
 * function myFork(options) {
 *   if (illFormedOpts(schema, options)) {
 *     // => Prints descriptive, helpful error message
 *
 *     throw new Error('Ill-formed options')
 *   }
 *
 *   // ...stuff...
 * }
 * ```
 * ```js
 * myFork({ modulePath: './myModule.js', stdio: 'out' })
 * // => Prints: Error: Unrecognized value for 'stdio': 'out'
 * //                   Acceptable values for 'stdio': [ 'pipe', 'ignore', 0, 1, 2 ]
 * //
 * //            /Users/Danny/foo.js:22
 * //              { modulePath: './myModule.js', stdio: 'out' }
 */
exports.illFormedOpts = require('./illFormedOpts')

/**
 * Invokes `func` within a `try` block, and catches and prints any thrown exceptions (including the stack trace if an `Error` is thrown).
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @param {Function} func The function to invoke within a `try` block.
 * @param {boolean} [exitProcessIfFailure] Specify exiting the process with failure code `1` after catching and printing an exception (thrown within `func`).
 * @returns {*} Returns the return value of `func`.
 * @example
 *
 * dantil.tryCatchWrapper(function () {
 *   // ...stuff...
 *   throw new Error('test failed')
 * })
 * // => Catches thrown exception and prints stack trace
 */
exports.tryCatchWrapper = function (func, exitProcessIfFailure) {
	try {
		return func()
	} catch (e) {
		// Print leading newline.
		exports.log()

		// Print exception.
		if (e.stack) {
			exports.log(e.stack)
		} else {
			exports.log(e)
		}

		if (exitProcessIfFailure) {
			process.exit(1)
		}
	}
}

/**
 * Removes the modules identified by the provided paths from cache, forcing them to be reloaded at next `require()` call. Without removing a module from cache, subsequent `require()` calls to the same module will not enable changes to its file(s). This is useful for enabling changes on a server without restarting the server.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @param {...string} [paths] The paths of modules to remove from cache.
 * @example
 *
 * var myModule = require('./myModule.js')
 * // => Loads module
 *
 * dantil.deleteModuleCache('./myModule.js')
 * // => Removes module from cache
 *
 * myModule = require('./myModule.js')
 * // => Loads module again, enabling changes to './myModule.js'
 */
exports.deleteModuleCache = function () {
	for (var a = 0, argumentsLen = arguments.length; a < argumentsLen; ++a) {
		delete require.cache[fs.realpathSync(arguments[a])]
	}
}

/**
 * Gets this method's invocation location in the format `filePath:lineNumber:columnNumber`.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @returns {string} Returns this method's invocation location.
 * @example
 *
 * ```
 * The contents of `foo.js`:
 * ```js
 * dantil.getLocation()
 * // => '/Users/Danny/foo.js:1'
 */
exports.getLocation = function () {
	// Get the frame for where this method was invoked.
	var stack = getStackTraceArray()
	return getFrameLocation(stack[0])
}

/**
 * Gets the location of the function call that invoked the currently executing module in the format `filePath:lineNumber:columnNumber`.
 *
 * This is not necessarily the caller of the currently executing function, which can be another function within the same module. Nor is it necessarily this module's parent which instantiated the module. Rather, it is the most recent function call in the stack outside the currently executing module.
 * • Skips stack frames for native Node functions (e.g., `require()`).
 *
 * Returns `undefined` if there is no other module in the stack below where this method was called.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @returns {string} Returns the location of the function call that invoked the currently executing module.
 * @example
 *
 * ```
 * The contents of `main.js`:
 * ```js
 * var child = require('./child.js')
 * child.func()
 *
 * var grandchild = require('./grandchild.js')
 * grandchild.foo()
 *
 * // Try to get the frame of the nonexistent function call that invoked this module.
 * dantil.getModuleCallerLocation()
 * // => undefined
 * ```
 * The contents of `child.js`:
 * ```js
 * var grandchild = require('./grandchild.js')
 *
 * exports.func = function () {
 *   // Get the frame of the invocation of the current execution of this module.
 *   dantil.getModuleCallerLocation()
 *   // => '/Users/Danny/main.js:2'
 *
 *   // Call another function within the same module, though retrieves the same frame.
 *   subFunc()
 *
 *   // Call a function in another module.
 *   grandchild.bar()
 * }
 *
 * function subFunc() {
 *   // Get the frame of the invocation of the current execution of this module (which
 *   // is not the frame that invoked this function).
 *   dantil.getModuleCallerLocation()
 *   // => '/Users/Danny/main.js:2'
 * }
 * ```
 * The contents of `grandchild.js`:
 * ```js
 * exports.foo = function () {
 *   dantil.getModuleCallerLocation()
 *   // => '/Users/Danny/main.js:5'
 * }
 *
 * exports.bar = function () {
 *   dantil.getModuleCallerLocation()
 *   // => '/Users/Danny/child.js:13'
 * }
 */
exports.getModuleCallerLocation = function () {
	// Get the stack trace, excluding the stack frames for this module and native Node functions (e.g., `require()`).
	var stack = getStackTraceArray()

	var thisModuleName
	for (var f = 0, stackLen = stack.length; f < stackLen; ++f) {
		var frame = stack[f]
		var frameFileName = frame.getFileName()

		// Get the module name of where this method was invoked (in order to skip its associated frames).
		if (!thisModuleName) {
			thisModuleName = frameFileName
			continue
		}

		// Find the frame of the most recent module after where this method was invoked, skipping frames for modules in which `dantil.skipFileInLocationRetrieval()` was invoked, if any.
		if (thisModuleName !== frameFileName && _filesToSkipInLocationRetreival.indexOf(frameFileName) === -1) {
			return getFrameLocation(frame)
		}
	}

	// Returns `undefined` if there is no other module in the stack below where this method was invoked that meets these criteria.
}

/**
 * The file names of stack frames for `dantil.getModuleCallerLocation()` to skip when searching the call stack for the function call that invoked the currently executing module.
 *
 * `dantil.skipFileInLocationRetrieval()` appends this array with the file name in which the method is invoked.
 *
 * @private
 * @type {string[]}
 */
var _filesToSkipInLocationRetreival = []

/**
 * Marks the module in which this method is invoked for `dantil.getModuleCallerLocation()` to skip when searching the call stack.
 *
 * This is useful for using `dantil.getModuleCallerLocation()` to include a method's invocation location in an error message, though that location is deep within the call stack relative to the error's generation location. I.e., the error is caught several modules deep from the invocation to which the error applies, as opposed to being one module deep.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 */
exports.skipFileInLocationRetrieval = function () {
	var stack = getStackTraceArray()
	var fileName = stack[0].getFileName()

	// Alert if method invoked twice within same file.
	if (_filesToSkipInLocationRetreival.indexOf(fileName) !== -1) {
		exports.logError('`dantil.skipFileInLocationRetrieval()` invoked twice within same file:')
		exports.log('  ' + exports.stylize(fileName))
		exports.log()
		throw new Error('Duplicate file name to ignore')
	}

	_filesToSkipInLocationRetreival.push(fileName)
}

/**
 * Creates a string representation of the location of `stackFrame` in the format `filePath:lineNumber:columnNumber`.
 *
 * @private
 * @static
 * @param {CallSite} stackFrame The stack frame.
 * @returns {string} Returns the location of `stackFrame`.
 */
function getFrameLocation(stackFrame) {
	var frameString = stackFrame.toString()
	var lastParenIndex = frameString.lastIndexOf('(')
	return lastParenIndex === -1 ? frameString : frameString.slice(lastParenIndex + 1, -1)
}

/**
 * Gets the structured stack trace as an array of `CallSite` objects, excluding the stack frames for this module and native Node functions.
 *
 * @private
 * @static
 * @returns {CallSite[]} Returns the structured stack trace.
 */
function getStackTraceArray() {
	var origStackTraceLimit = Error.stackTraceLimit
	var origPrepareStackTrace = Error.prepareStackTrace

	// Collect all stack frames.
	Error.stackTraceLimit = Infinity

	// Get a structured stack trace as an `Array` of `CallSite` objects, each of which represents a stack frame, with frames for native Node functions and this file removed.
	Error.prepareStackTrace = function (error, structuredStackTrace) {
		return structuredStackTrace.filter(function (frame) {
			var filePath = frame.getFileName()

			// Skip frames from within this module (i.e., `dantil`).
			if (filePath === __filename) {
				return false
			}

			// Skip frames for native Node functions (e.g., `require()`).
			if (!/\//.test(filePath)) {
				return false
			}

			return true
		})
	}

	// Collect the stack trace.
	var stack = Error().stack

	// Restore stack trace configuration after collecting stack trace.
	Error.stackTraceLimit = origStackTraceLimit
	Error.prepareStackTrace = origPrepareStackTrace

	return stack
}

/**
 * Stylizes strings for printing to the console using the [`chalk`](https://github.com/chalk/chalk) module.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @type Object
 * @example
 *
 * console.log(dantil.colors.red('Error'))
 * // => Prints red-colored "Error"
 */
exports.colors = require('chalk')

/**
 * Invokes `func` while synchronously writing the process's `stdout` to a file at `path` instead of the console. Creates the file if it does not exist or truncates the file to zero length if it does exist. Restores `stdout` to the console when `func` returns or if an exception is thrown.
 *
 * @static
 * @memberOf dantil
 * @category File System
 * @param {string} path The path where to write `stdout`.
 * @param {Function} func The function to invoke while writing output to `path`.
 * @returns {*} Returns the value returned by `func`, if any.
 * @example
 *
 * // Print to console.
 * console.log('Begin output to file')
 *
 * // Redirect `stdout` from console to '~/Desktop/out.txt'.
 * dantil.stdoutToFile('~/Desktop/out.txt', function () {
 *   console.log('Numbers:')
 *   for (var i = 0; i < 100; ++i) {
 *     console.log(i)
 *   }
 * })
 * // => Restores `stdout` to console and prints "Output saved: ~/Desktop/out.txt"
 *
 * // Print to console (after restoring `stdout`).
 * console.log('Output to file complete')
 */
exports.stdoutToFile = function (path, func) {
	// Expand '~' if present. Can not resolve `path` here because `path` may not exist.
	path = exports.expandHomeDir(path)

	// Disable ANSI escape codes for color and formatting in output.
	var origSupportsColor = exports.colors.supportsColor
	exports.colors.supportsColor = false

	// Create file if does not exist, truncates file to zero length if it does exist, or throw an exception if `path` is a directory.
	fs.writeFileSync(path)

	// Redirect `process.stdout` to `path`.
	var writable = fs.createWriteStream(path)
	var origStdoutWrite = process.stdout.write
	process.stdout.write = function () {
		writable.write.apply(writable, arguments)
	}

	try {
		// Write output to `path`.
		var returnVal = func()

		// Restore `process.stdout`.
		process.stdout.write = origStdoutWrite

		// Re-enable output stylization.
		exports.colors.supportsColor = origSupportsColor

		exports.log('Output saved:', fs.realpathSync(path))

		return returnVal
	} catch (e) {
		// Restore `process.stdout`.
		process.stdout.write = origStdoutWrite

		// Re-enable output stylization.
		exports.colors.supportsColor = origSupportsColor

		throw e
	}
}

/**
 * Stringifies and writes `obj` to a JSON file at `path`.
 *
 * @static
 * @memberOf dantil
 * @category File System
 * @param {string} path The file path to write to.
 * @param {Object} obj The object to save to `path`.
 * @example
 *
 * var obj = {
 *   name: 'foo',
 *   value: 7,
 *   list: [ 'apple', 'orange' ]
 * }
 *
 * dantil.writeJSONFile('./myObj.json', obj)
 * // => Writes file and prints "File saved: /Users/Danny/myObj.json"
 */
exports.writeJSONFile = function (path, obj) {
	// Expand '~' if present. Can not resolve `path` here because `path` may not exist.
	path = exports.expandHomeDir(path)

	fs.writeFileSync(path, JSON.stringify(obj, function (key, val) {
		// Convert RegExp to strings for `JSON.stringify()`.
		return val instanceof RegExp ? val.source : val
	}, '\t'))

	exports.log('File saved:', fs.realpathSync(path))
}

/**
 * Gets the file path and line number in the format `filePath:lineNumber` of each occurrence of `value` in the source file at `filePath`. This is useful for error reporting.
 *
 * @static
 * @memberOf dantil
 * @category File System
 * @param {string} filePath The path of the source file to search.
 * @param {*} value The value for which to search.
 * @returns {Array} Returns the file path and line number of each matched line.
 * @example
 *
 * ```
 * The contents of `foo.js`:
 * ```js
 * var list = [
 *   { name: 'lorem', num: 2 },
 *   { name: 'lorem ipsum', num: 5 },
 *   { name: 'ipsum', num: 3 }
 * ]
 * ```
 * The contents of `bar.js`:
 * ```js
 * dantil.pathAndLineNumbersOf('./foo.js', 'ipsum')
 * // => [ '/Users/Danny/foo.js:3', '/Users/Danny/foo.js:3' ]
 *
 * // Enclose sought value to distinguish `ipsum` from `'ipsum'`.
 * dantil.pathAndLineNumbersOf('./foo.js', '\'ipsum\'')
 * // => [ '/Users/Danny/foo.js:4' ]
 */
exports.pathAndLineNumbersOf = function (filePath, value) {
	var matches = []

	basePathAndLineNumbersOf(filePath, value, function (pathAndLineNumber) {
		matches.push(pathAndLineNumber)
	})

	return matches
}

/**
 * Gets the file path and line number in the format `filePath:lineNumber` of the first occurrence of `value` in the source file at `filePath`. This is useful for error reporting.
 *
 * If `subValue` is provided, gets the line number of the first occurrence of `subValue` after the first occurrence of `value`. This is useful for using `value` to distinguish multiple occurrences of `subValue` in the file.
 *
 * @static
 * @memberOf dantil
 * @category File System
 * @param {string} filePath The path of the source file to search.
 * @param {*} value The value for which to search.
 * @param {*} [subValue] The second value for which to search, starting at the location of `value`.
 * @returns {string|undefined} Returns the file path and line number of the matched line, else `undefined`.
 * @example
 *
 * ```
 * The contents of `foo.js`:
 * ```js
 * var list = [
 *   {
 *     name: 'lorem',
 *     num: 2
 *   }, {
 *     name: 'lorem ipsum',
 *     num: 5
 *   }, {
 *     name: 'ipsum',
 *     num: 3
 *   }
 * ]
 * ```
 * The contents of `bar.js`:
 * ```js
 * dantil.firstPathAndLineNumberOf('./foo.js', 'ipsum')
 * // => '/Users/Danny/foo.js:6',
 *
 * // Get line number of first occurrence of `num` after `ipsum`.
 * dantil.firstPathAndLineNumberOf('./foo.js', 'ipsum', 'num')
 * // => '/Users/Danny/foo.js:7',
 *
 * // Enclose sought value to distinguish `ipsum` from `'ipsum'`.
 * dantil.firstPathAndLineNumberOf('./foo.js', '\'ipsum\'')
 * // => '/Users/Danny/foo.js:9'
 */
exports.firstPathAndLineNumberOf = function (filePath, value, subValue) {
	var match

	if (subValue) {
		// Find first occurrence of `subValue` after `value`.
		lineNumbersOf(filePath, value, function (lineNumber) {
			return basePathAndLineNumbersOf(filePath, subValue, function (pathAndLineNumber) {
				match = pathAndLineNumber
				return true
			}, lineNumber)
		})
	} else {
		// Find first occurrence of `value`.
		basePathAndLineNumbersOf(filePath, value, function (pathAndLineNumber) {
			match = pathAndLineNumber
			return true
		})
	}

	return match
}

/**
 * The base implementation of `dantil.pathAndLineNumbersOf()` and `dantil.firstPathAndLineNumberOf()` which finds occurrences of `value` in the source file at `filePath`. Stops iteration once `iteratee` returns truthy. Invokes `iteratee` with the path and line number in the format `filePath:lineNumber` as the only argument: (pathAndLineNumber).
 *
 * @private
 * @static
 * @param {string} filePath The path of the source file to search.
 * @param {*} value The value for which to search.
 * @param {Function} iteratee The function invoked per matched line until it returns truthy.
 * @param {number} [fromLine=0] The line number at which to start the searching forward in the file at `filePath`.
 * @returns {boolean} Returns `true` if `iteratee` is invoked and returns truthy, else `false`.
 */
function basePathAndLineNumbersOf(filePath, value, iteratee, fromLine) {
	// Resolve `filePath` if relative.
	filePath = exports.realpathSync(filePath)

	return lineNumbersOf(filePath, value, function (lineNumber) {
		// Exit if `iteratee` returns truthy.
		return iteratee(filePath + ':' + lineNumber)
	}, fromLine)
}

/**
 * Gets the line numbers of occurrences of `value` in the source file at `filePath`. Stops iteration once `iteratee` returns truthy. Invokes `iteratee` with one argument: (lineNumber).
 *
 * @private
 * @static
 * @param {string} filePath The path of the source file to search.
 * @param {*} value The value for which to search.
 * @param {Function} iteratee The function invoked per matched line until it returns truthy.
 * @param {number} [fromLine=0] The line number at which to start the searching forward in the file at `filePath`.
 * @returns {boolean} Returns `true` if `iteratee` is invoked and returns truthy, else `false`.
 */
function lineNumbersOf(filePath, value, iteratee, fromLine) {
	// Get `filePath` lines.
	var fileLines = fs.readFileSync(filePath, 'utf8').split('\n')

	// Find occurrences of `value` in `fileLines`.
	for (var l = fromLine || 0, fileLinesLen = fileLines.length; l < fileLinesLen; ++l) {
		if (fileLines[l].indexOf(value) !== -1) {
			// Add 1 to line index because line numbers begin at 1.
			if (iteratee(l + 1)) {
				// Exit if `iteratee` returns truthy.
				return true
			}
		}
	}

	return false
}

/**
 * Replaces `'~'` in `path` (if present and at the path's start) with the home directory path.
 *
 * @static
 * @memberOf dantil
 * @category File System
 * @param {string} path The file path.
 * @returns {string} Returns `path` with `'~'`, if present, replaced with the home directory path.
 * @example
 *
 * dantil.expandHomeDir('~/Desktop')
 * // => '/Users/Danny/Desktop'
 */
exports.expandHomeDir = function (path) {
	return path.replace(/^~/, process.env[process.platform === 'win32' ? 'USERPROFILE' : 'HOME'])
}

/**
 * Synchronously resolves `path` to an absolute path.
 *
 * This method is similar to Node's `fs.realpathSync()`, but also expands `'~'` if found in `path`.
 *
 * @static
 * @memberOf dantil
 * @category File System
 * @param {string} path The path to resolve.
 * @returns {string} Returns the absolute path.
 * @example
 *
 * dantil.realpathSync('~/Desktop/../../Danny')
 * // => '/Users/Danny'
 */
exports.realpathSync = function (path) {
	return fs.realpathSync(exports.expandHomeDir(path))
}

/**
 * Synchronously checks if `path` exists by checking the file system.
 *
 * Replaces the deprecated `fs.existsSync()` by invoking `fs.accessSync(path)`, which throws an exception when `path` is not found, within a `try...catch` block.
 *
 * @static
 * @memberOf dantil
 * @category File System
 * @param {string} path The path to check.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 * @example
 *
 * dantil.pathExistsSync('/etc/passwd')
 * // => true
 *
 * dantil.pathExistsSync('/wrong/path')
 * // => false
 */
exports.pathExistsSync = function (path) {
	try {
		fs.accessSync(path)
		return true
	} catch (e) {
		return false
	}
}

/**
 * Pretty-prints the provided values and objects to `stdout`, in color, recursing 2 times while formatting objects (which is the behavior of `console.log()`).
 *
 * Formats plain `Object`s and `Array`s with multi-line string representations on separate lines. Concatenates and formats all other consecutive values on the same line.
 *
 * If the first argument is of a complex type (e.g., `Object`, `Array`), left-aligns all remaining lines. Otherwise, equally indents each line after the first line, if any. If the first argument has leading whitespace (or is entirely whitespace), prepends all remaining arguments with the same whitespace (as indentation) excluding newline characters.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} [values] The values and objects to print.
 * @example
 *
 * dantil.log({
 *   name: 'Danny',
 *   value: 3,
 *   terms: [ 'confident', 'farseeing', 'capable', 'prudent' ],
 *   exitFunc: process.exit,
 *   deepObject: {
 *     nestedArray: [ [ 1 ] ],
 *     nestedObject: { obj: { str: 'string', num: 2, bool: true, arr: [ 1, 2, 3, 4, 5, 6, 7 ] } }
 *   }
 * })
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-log-example.jpg" alt="dantil.log() example output"/>
 * ```
 */
exports.log = function () {
	writeToProcessStream('stdout', prettify(arguments))
}

/**
 * A version of `dantil.log()` that recurses indefinitely while formatting objects. This is useful for inspecting large, complicated objects.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} [values] The values and objects to print.
 * @example
 *
 * dantil.dir({
 *   name: 'Danny',
 *   value: 3,
 *   terms: [ 'confident', 'farseeing', 'capable', 'prudent' ],
 *   exitFunc: process.exit,
 *   deepObject: {
 *     nestedArray: [ [ 1 ] ],
 *     nestedObject: { obj: { str: 'string', num: 2, bool: true, arr: [ 1, 2, 3, 4, 5, 6, 7 ] } }
 *   }
 * })
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-dir-example.jpg" alt="dantil.dir() example output"/>
 * ```
 */
exports.dir = function () {
	// Recurse indefinitely while formatting objects.
	writeToProcessStream('stdout', prettify(arguments, { depth: null }))
}

/**
 * Prints `object` like `dantil.log()` but recurses `depth` times while formatting. This is useful for inspecting large, complicated objects.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {Object} object The object to print.
 * @param {number} depth The number of times to recurse while formatting `object`.
 * @example
 *
 * var obj = {
 *   name: 'Danny',
 *   nestedObj: { array: [ { isGood: false } ] }
 * }
 *
 * dantil.logObjectAtDepth(obj, 1)
 * dantil.logObjectAtDepth(obj, 2)
 * dantil.logObjectAtDepth(obj, 3)
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logObjectAtDepth-example.jpg" alt="dantil.logObjectAtDepth() example output"/>
 * ```
 */
exports.logObjectAtDepth = function (object, depth) {
	writeToProcessStream('stdout', prettify([ object ], { depth: depth }))
}

/**
 * Prints the provided values like `dantil.log()`, along with the calling file path and line number.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} [values] The values and objects to print.
 * @example
 *
 * dantil.logWithLine({
 *   name: 'Danny',
 *   value: 3,
 *   terms: [ 'confident', 'farseeing', 'capable', 'prudent' ],
 *   exitFunc: process.exit,
 *   deepObject: {
 *     nestedArray: [ [ 1 ] ],
 *     nestedObject: { obj: { str: 'string', num: 2, bool: true, arr: [ 1, 2, 3, 4, 5, 6, 7 ] } }
 *   }
 * })
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logWithLine-example.jpg" alt="dantil.logWithLine() example output"/>
 * ```
 */
exports.logWithLine = function () {
	exports.log(exports.colors.grey(exports.getLocation()))
	exports.log.apply(null, arguments)
}

/**
 * Prints the provided values like `dantil.dir()`, along with the calling file path and line number.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} [values] The values and objects to print.
 * @example
 *
 * dantil.dirWithLine({
 *   name: 'Danny',
 *   value: 3,
 *   terms: [ 'confident', 'farseeing', 'capable', 'prudent' ],
 *   exitFunc: process.exit,
 *   deepObject: {
 *     nestedArray: [ [ 1 ] ],
 *     nestedObject: { obj: { str: 'string', num: 2, bool: true, arr: [ 1, 2, 3, 4, 5, 6, 7 ] } }
 *   }
 * })
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-dirWithLine-example.jpg" alt="dantil.dirWithLine() example output"/>
 * ```
 */
exports.dirWithLine = function () {
	exports.log(exports.colors.grey(exports.getLocation()))
	exports.dir.apply(null, arguments)
}

/**
 * A version of `dantil.log()` that prints to `stderr`.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} [values] The values and objects to print.
 */
exports.logStderr = function () {
	writeToProcessStream('stderr', prettify(arguments))
}

/**
 * Writes `string` with a trailing newline to `processStreamName`.
 *
 * @private
 * @static
 * @param {string} processStreamName The name of the writable process stream (e.g., `stout`, `stderr`).
 * @param {string} string The string to print.
 */
function writeToProcessStream(processStreamName, string) {
	var writableStream = process[processStreamName]
	if (writableStream) {
		writableStream.write(string + '\n')
	} else {
		throw new Error('Unrecognized process stream: ' + exports.stylize(processStreamName))
	}
}

/**
 * Formats the provided values and objects in color for pretty-printing, recursing `options.depth` times while formatting objects.
 *
 * Formats plain `Object` and `Array` instances with multi-line string representations on separate lines. Concatenates and formats all other consecutive values on the same line.
 *
 * If the first argument is of a complex type (e.g., `Object`, `Array`), left-aligns all remaining lines. Otherwise, equally indents each line after the first line, if any. If the first argument has leading whitespace (or is entirely whitespace), prepends all remaining arguments with the same whitespace (as indentation) excluding newline characters.
 *
 * @private
 * @static
 * @param {Array} args The values and objects to format.
 * @param {Object} [options] The options object.
 * @param {number} [options.depth=2] The number of times to recurse while formating `args`. Pass `null` to recurse indefinitely.
 * @param {number} [options.stylizeStings=false] Specify stylizing strings in `args`. This does not apply to `Object` properties.
 * @returns {string} Returns the formatted string.
 */
function prettify(args, options) {
	if (!options) options = {}

	var stylizeOptions = {
		// Number of times to recurse while formatting; defaults to 2.
		depth: options.depth,
		// Format in color if the terminal supports color.
		colors: exports.colors.supportsColor,
	}

	// Use `RegExp()` to get correct `reMultiLined.source`.
	var reMultiLined = RegExp('\n', 'g')
	var reWhitespaceOnly = /^\s+$/
	var indent = '  '
	var prevArgIsSeperateLine = false

	var argsArray = Array.prototype.slice.call(args)

	// Remove any leading newline characters in the first argument, and prepend them to the remainder of the formatted arguments instead of including the characters in the indentation of each argument (as occurs with other whitespace characters in the first argument).
	var firstArg = argsArray[0]
	var leadingNewlines = ''
	if (/^\n+/.test(firstArg)) {
		var lastNewlineIdx = firstArg.lastIndexOf('\n')
		if (lastNewlineIdx === firstArg.length - 1) {
			argsArray.shift()
		} else {
			argsArray[0] = firstArg.slice(lastNewlineIdx + 1)
			firstArg = firstArg.slice(0, lastNewlineIdx + 1)
		}

		leadingNewlines = firstArg
	}

	return leadingNewlines + argsArray.reduce(function (formattedArgs, arg, i, args) {
		var argIsString = typeof arg === 'string'

		// Parse numbers passed as string for styling.
		if (argIsString && /^\S+$/.test(arg) && !isNaN(arg)) {
			arg = parseFloat(arg)
			argIsString = false
		}

		// Do not stylize strings passed as arguments (i.e., not `Object` properties). This also preserves any already-stylized arguments.
		var formattedArg = !options.stylizeStings && argIsString ? arg : exports.stylize(arg, stylizeOptions)

		if (i === 0) {
			// Extend indent for remaining arguments with the first argument's leading whitespace, if any.
			if (argIsString) {
				// Get the substring of leading whitespace characters from the start of the string, up to the first non-whitespace character, if any.
				var firstNonWhitespaceIndex = arg.search(/[^\s]/)
				arg = arg.slice(0, firstNonWhitespaceIndex === -1 ? arg.length : firstNonWhitespaceIndex)

				// JavaScript will not properly indent if '\t' is appended to spaces (i.e., reverse order as here).
				// If the first argument is entirely whitespace, indent all remaining arguments with that whitespace.
				indent = reWhitespaceOnly.test(formattedArg) ? arg : arg + indent

				// If first argument is entirely whitespace, exclude from output because it serves only to set indentation of all remaining arguments.
				if (reWhitespaceOnly.test(formattedArg)) {
					// Force the next argument to be pushed to `formattedArgs` to avoid concatenating with `undefined` (because `formattedArgs` remains empty).
					prevArgIsSeperateLine = true
				} else {
					formattedArgs.push(formattedArg)
				}
			} else {
				formattedArgs.push(formattedArg)

				if (arg instanceof Object) {
					// Do not indent remaining arguments if the first argument is of a complex type.
					indent = ''

					// Format the complex type on a separate line.
					prevArgIsSeperateLine = true
				}
			}
		} else if (arg instanceof Object && (!Array.isArray(arg) || reMultiLined.test(formattedArg) || args[0] instanceof Object)) {
			// Format plain `Object`s, `Array`s with multi-line string representations, and `Array`s when the first argument is of a complex type on separate lines.
			formattedArgs.push(indent + formattedArg.replace(reMultiLined, reMultiLined.source + indent))
			prevArgIsSeperateLine = true
		} else if (prevArgIsSeperateLine) {
			// Format anything that follows a multi-line string representations on a new line.
			formattedArgs.push(indent + formattedArg)
			prevArgIsSeperateLine = false
		} else {
			// Concatenate all consecutive primitive data types.
			formattedArgs[formattedArgs.length - 1] += ' ' + formattedArg
		}

		return formattedArgs
	}, []).join('\n')
}

/**
 * Formats `value` in color for pretty-printing, recursing `options.depth` times while formatting.
 *
 * This method is similar to Node's `util.inspect()`, but prints in color by default if the terminal supports color.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {*} value The object or value to stylize.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.colors=true] Specify coloring the string for pretty-printing.
 * @param {number} [options.depth=2] The number of times to recurse while formating `value` if of a complex type. Pass `null` to recurse indefinitely.
 * @returns {string} Returns a stylized string representation of `value`.
 */
exports.stylize = function (value, options) {
	if (!options) {
		options = {}
	}

	// Print in color if the terminal supports color.
	if (options.colors !== false) {
		options.colors = exports.colors.supportsColor
	}

	return util.inspect(value, options)
}

/**
 * Prints the provided values like `dantil.log()` prepended with red-colored "Error: ".
 *
 * If the first character of the first value is a newline character, moves the character to before "Error: ".
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} [values] The values to print following "Error: ".
 * @example
 *
 * dantil.logError('Failed', numTestsFailed, 'of', tests.length, 'tests')
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logError-example.jpg" alt="dantil.logError() example output"/>
 * ```
 */
exports.logError = logWithColoredLabel.bind(null, 'Error', 'red')

/**
 * Prints the provided values like `dantil.logError()`, followed by a trailing newline.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} [values] The values to print following "Error: ".
 * @example
 *
 * dantil.logErrorWithNewLine('Failed', numTestsFailed, 'of', tests.length, 'tests')
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logErrorWithNewLine-example.jpg" alt="dantil.logErrorWithNewLine() example output"/>
 * ```
 */
exports.logErrorWithNewLine = function () {
	exports.logError.apply(null, arguments)
	exports.log()
}

/**
 * Prints the provided values like `dantil.log()` prepended with yellow-colored "Warning: ".
 *
 * If the first character of the first value is a newline character, moves the character to before "Warning: ".
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} [values] The values to print following "Warning: ".
 * @example
 *
 * dantil.logWarning('Missing property:', obj)
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logWarning-example.jpg" alt="dantil.logWarning() example output"/>
 * ```
 */
exports.logWarning = logWithColoredLabel.bind(null, 'Warning', 'yellow')

/**
 * Prints the provided values like `dantil.log()` prepended with green-colored "Success: ".
 *
 * If the first character of the first value is a newline character, moves the character to before "Success: ".
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} [values] The values to print following "Success: ".
 * @example
 *
 * dantil.logSuccess(tests.length, 'tests passed')
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logSuccess-example.jpg" alt="dantil.logSuccess() example output"/>
 * ```
 */
exports.logSuccess = logWithColoredLabel.bind(null, 'Success', 'green')

/**
 * Prints `values` to `stdout` like `dantil.log()` prepended with `label` (e.g., `'Error'`) colored `color` (e.g., `'red'`).
 *
 * @private
 * @static
 * @param {string} label The label to prepend to `values` (e.g., `'Error'`).
 * @param {string} color The color to stylize `label`.
 * @param {...*} [values] The values to print following `label`.
 */
function logWithColoredLabel(label, color) {
	var args = prependColoredLabel(label, color, Array.from(arguments).slice(2))
	exports.log.apply(null, args)
}

/**
 * Prepends `label` (e.g., `'Error'`) colored `color` (e.g., `'red'`) to `values`.
 *
 * If the first character of the first value in `values` is '\n', moves the character to before `label`. Appends a colon to `label` if it is not already the string's last character.
 *
 * @private
 * @static
 * @param {string} label The label to prepend to `values` (e.g., `'Error'`).
 * @param {string} color The color to stylize `label`.
 * @param {*[]} values The values to follow `label`.
 * @returns {Array} Returns the array of `label` followed by the contents of `values`.
 */
function prependColoredLabel(label, color, values) {
	// Temporarily remove ':', if any, to avoid coloring it.
	if (label[label.length - 1] === ':') {
		label = label.slice(0, -1)
	}

	// If the first character of the first value in `values` is '\n', move the character to before `label`.
	var firstVal = values[0]
	if (firstVal) {
		if (firstVal === '\n' && values.length !== 1) {
			// First value is '\n' and is not the only value.
			values.shift()
			label = '\n' + label
		} else if (firstVal[0] === '\n') {
			// First value begins with '\n'.
			values[0] = firstVal.slice(1)
			label = '\n' + label
		}
	}

	// Color `label` and append `values`.
	return [ exports.colors[color](label) + ':' ].concat(values)
}

/**
 * Prints the provided values in an error message like `dantil.logError()` followed by the file path and line number of the function call that invoked the currently executing module.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {boolean} [logThisLine] Specify logging the line where this method is called instead of the line which invoked the currently executing module.
 * @param {...*} [values] The values to print following "Error: ".
 * @example
 *
 * ```
 * The contents of `foo.js`:
 * ```js
 * dantil.logErrorAndPath('Failed', numTestsFailed, 'of', tests.length, 'tests')
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logErrorAndPath-example.jpg" alt="dantil.logErrorAndPath() example output"/>
 * ```
 */
exports.logErrorAndPath = logColoredLabelAndPath.bind(null, 'Error', 'red')

/**
 * Prints the provided values in a warning message like `dantil.logWarning()` followed by the file path and line number of the function call that invoked the currently executing module.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {boolean} [logThisLine] Specify logging the line where this method is called instead of the line which invoked the currently executing module.
 * @param {...*} [values] The values to print following "Warning: ".
 * @example
 *
 * ```
 * The contents of `foo.js`:
 * ```js
 * var badObj = { name: 'danny', age: undefined }
 * dantil.logWarningAndPath('Property undefined:', badObj)
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logWarningAndPath-example.jpg" alt="dantil.logWarningAndPath() example output"/>
 * ```
 */
exports.logWarningAndPath = logColoredLabelAndPath.bind(null, 'Warning', 'yellow')

/**
 * Prints `values` to `stdout` like `dantil.log()` prepended with `label` colored `color`, like `logWithColoredLabel()`, and followed by the file path and line number of the function call that invoked the currently executing module.
 *
 * @private
 * @static
 * @param {string} label The label to prepend to `value` (e.g., `'Error'`).
 * @param {string} color The color to stylize `label`.
 * @param {boolean} [logThisLine] Specify logging the line where this function is called instead of the line which invoked the currently executing module.
 * @param {...*} [values] The values to print following `label`.
 */
function logColoredLabelAndPath(label, color, logThisLine) {
	var pathAndLineNumber
	// Check `logThisLine` equality strictly to avoid checking truthiness of the function's trailing arguments.
	if (logThisLine !== true) {
		pathAndLineNumber = exports.getModuleCallerLocation()
	}

	// If `logThisLine` is `true` or this function was invoked via the main module without a parent module, then print the line where this function was called.
	if (!pathAndLineNumber) {
		pathAndLineNumber = exports.getLocation()
	}

	// Check arity.
	var args = Array.prototype.slice.call(arguments, typeof logThisLine === 'boolean' ? 3 : 2)
	if (args.length > 0) {
		logWithColoredLabel.apply(null, [ label, color ].concat(args))
		exports.log('  ' + pathAndLineNumber)
	} else {
		logWithColoredLabel(label, color, pathAndLineNumber)
	}

	// Print trailing newline.
	exports.log()
}

/**
 * Prints `object` preceded by the file path and line number of the function call that invoked the currently executing module. Surrounds output with a leading newline and a trailing newline.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {Object} object The object to print.
 * @param {boolean} [logThisLine] Specify logging the line where this method is called instead of the line which invoked the currently executing module.
 * @example
 *
 * ```
 * The contents of `foo.js`:
 * ```js
 * var obj = {
 *   values: [1, 2, 3],
 *   name: 'danny'
 * }
 *
 * dantil.logPathAndObject(obj)
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logPathAndObject-example.jpg" alt="dantil.logPathAndObject() example output"/>
 * ```
 */
exports.logPathAndObject = function (object, logThisLine) {
	var pathAndLineNumber
	if (!logThisLine) {
		pathAndLineNumber = exports.getModuleCallerLocation()
	}

	// If `logThisLine` is `true` or this method was invoked via the main module without a parent module, then print the line where this method was called.
	if (!pathAndLineNumber) {
		pathAndLineNumber = exports.getLocation()
	}

	// Print a leading newline, path and line number, `object`, and a trailing newline.
	exports.log('\n' + pathAndLineNumber)
	exports.log('  ', object)
	exports.log()
}

/**
 * Prints the stack trace to the current position with `danti.prettifyStackTrace()` stylization.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {string} [message] The optional message to print above the stack trace.
 * @example
 *
 * dantil.logTrace('Reached obscure condition')
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logTrace-example.jpg" alt="dantil.logTrace() example output"/>
 * ```
 */
exports.logTrace = function (message) {
	exports.log('Trace' + (message ? ': ' + message : ''))

	// Modify V8's default stack trace format (when printing) to color function names.
	var origPrepareStackTrace = Error.prepareStackTrace
	exports.prettifyStackTrace()

	// Get stack without lines for `Error` and this file.
	exports.log(Error().stack.split('\n').slice(3).join('\n'))

	// Restore original stack trace formatter after collecting stack trace.
	Error.prepareStackTrace = origPrepareStackTrace
}

/**
 * Prints the file path and line number, prepended with `label` if provided else the invoking function's name. This is useful to mark reaching a section of code.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {string} [label] The label to prepend to the path and line number instead of the calling function name.
 * @example
 *
 * ```
 * The contents of `foo.js`:
 * ```js
 * function myFunction() {
 *   dantil.logLine()
 * }
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logLine-example.jpg" alt="dantil.logLine() example output"/>
 * ```js
 * function myFunction() {
 *   dantil.logLine('Bad area reached!')
 * }
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logLine-label-example.jpg" alt="dantil.logLine(label) example output"/>
 * ```
 */
exports.logLine = function (label) {
	var stack = getStackTraceArray()

	// Get the location of this method's invocation, prepended with `label` if provided else the invoking function's name.
	var frameString = stringifyStackFrame(stack[0], label)

	// If neither `label` is provided nor the invoking function's name is available (because invoked within an anonymous function), then prepend with the next function name in the call stack.
	if (frameString.indexOf(' ') === -1) {
		for (var s = 1, stackLen = stack.length; s < stackLen; ++s) {
			var prevFrameString = stack[s].toString()
			var lastSpaceIndex = prevFrameString.lastIndexOf(' ')
			if (lastSpaceIndex !== -1) {
				var outerFuncName = prevFrameString.slice(0, lastSpaceIndex)
				frameString = exports.colors.cyan(outerFuncName) + ' (' + frameString + ')'
				break
			}
		}
	}

	exports.log(frameString)
}

/**
 * If `value` is truthy, prints the file path and line number, prepended with `label` if provided else the invoking function's name. This is useful to mark reaching a section of code.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {*} value The value to check if truthy.
 * @param {string} [label] The label to prepend to the path and line number instead of the calling function
 * @example
 *
 * ```
 * The contents of `foo.js`:
 * ```js
 * function myFunction(myCondition) {
 *   dantil.logLineIf(myCondition)
 * }
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logLineIf-example.jpg" alt="dantil.logLineIf() example output"/>
 * ```js
 * function myFunction(myCondition) {
 *   dantil.logLineIf(myCondition, 'Condition met!')
 * }
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-logLineIf-label-example.jpg" alt="dantil.logLineIf(label) example output"/>
 * ```
 */
exports.logLineIf = function (value, label) {
	if (value) {
		exports.logLine(label)
	}
}

/**
 * Modifies V8's default stack trace format (when printing) to stylize output.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {boolean} [removePathParens] Specify removing parentheses that surround file paths. This prevents parentheses from breaking iTerm's open-file-path shortcut in iTerm v2.x.
 * @example
 *
 * dantil.prettifyStackTrace()
 * // => Prettifies all subsequent stack traces
 * ```
 * Before:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-prettifyStackTrace-before-example.jpg" alt="Before invoking dantil.prettifyStackTrace()"/>
 * After:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-prettifyStackTrace-after-example.jpg" alt="After invoking dantil.prettifyStackTrace()"/>
 * ```
 */
exports.prettifyStackTrace = function (removePathParens) {
	Error.prepareStackTrace = function (error, structuredStackTrace) {
		var stack = structuredStackTrace.map(function (frame) {
			// Stringify and stylize `frame`.
			var frameString = stringifyStackFrame(frame)

			// Remove parentheses surrounding file path, if any.
			if (removePathParens && /\//.test(frame.getFileName())) {
				frameString = frameString.replace(/[()]/g, '')
			}

			// Replicate default stack trace indentation.
			return '    at ' + frameString
		})

		// Colorize `Error` name (e.g., `TypeError`) red.
		error.name = exports.colors.red(error.name)

		// Prepend stack with error message (as is the default behavior).
		stack.unshift(error)

		return stack.join('\n')
	}
}

/**
 * Stringifies and colorizes the function name in `stackFrame`. If provided, `label` substitutes the function name in the `stackFrame` string representation.
 *
 * @private
 * @static
 * @param {CallSite} stackFrame The stack frame to stringify and stylize.
 * @param {string} [label] The label that substitutes the function name in the `stackFrame` string representation.
 * @returns {string} Returns the stylized string representation of `stackFrame`.
 */
function stringifyStackFrame(stackFrame, label) {
	var frameString = stackFrame.toString()

	// Colorize function name (or `label`, if provided).
	var lastSpaceIndex = frameString.lastIndexOf(' ')
	if (lastSpaceIndex !== -1) {
		return exports.colors.cyan(label || frameString.slice(0, lastSpaceIndex)) + frameString.slice(lastSpaceIndex)
	}

	// If there is no leading function, method, or type name (e.g., then root Node call: "node.js:405:3"), and `label` was provided.
	if (label) {
		return exports.colors.cyan(label) + ' ' + frameString
	}

	return frameString
}

/**
 * Tests shallow, coercive equality with the equal comparison operator (`==`). If the test fails, prints an error message and the file path and line number to `stderr`. In contrast, Node's `assert.equal()` throws an exception.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {string} [message] The optional message to print if the test fails.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * ```
 * The contents of `foo.js`:
 * ```js
 * dantil.assertEqual(false, 0)
 * // => true
 *
 * dantil.assertEqual(20, 21)
 * // => false
 * // => Prints: AssertionError: 20 == 21
 * //              /Users/Danny/foo.js:4
 *
 * dantil.assertEqual({ prop: 'value' }, { prop: 'value' })
 * // => false
 * // => Prints: AssertionError: { prop: 'value' } == { prop: 'value' }
 * //              /Users/Danny/foo.js:9
 *
 * dantil.assertEqual([ 3, 1, 4 ], [ 1, 5, 9 ], 'Array test failed')
 * // => false
 * // => Prints: AssertionError: Array test failed: [ 3, 1, 4 ] == [ 1, 5, 9 ]
 * //              /Users/Danny/foo.js:14
 *
 * if (dantil.assertEqual(myArray.length, 100)) {
 *   // => true
 *
 *   // ...stuff...
 * }
 */
exports.assertEqual = function (value, other, message) {
	if (value != other) {
		var label = exports.colors.red('AssertionError') + ': '
		var comparisonStr = exports.stylize(value) + ' == ' + exports.stylize(other)

		writeToProcessStream('stderr', label + (message ? message + ': ' : '') + comparisonStr)
		writeToProcessStream('stderr', '  ' + exports.getLocation())

		return false
	}

	return true
}

/**
 * Imports functions for `dantil.time()` and `dantil.timeEnd()`.
 *
 * @private
 * @type {Object}
 */
var _hrtimer = require('./hrtimer')

/**
 * Starts a high-resolution timer (with precision in microseconds) identified by `label`. Use `dantil.timeEnd(label)` to print the timer's current value.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {string} label The timer identifier.
 * @example
 *
 * // Start timer
 * dantil.time('my test')
 *
 * // ...stuff...
 *
 * dantil.timeEnd('my test')
 * // => Prints "my test: 13.264 ms"
 *
 * // ...more stuff...
 *
 * dantil.timeEnd('my test')
 * // => Prints "my test: 31.183 ms"
 */
exports.time = _hrtimer.start

/**
 * Prints the current high-resolution value of a timer initiated with `dantil.time(label)`.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {string} label The timer identifier.
 */
exports.timeEnd = _hrtimer.end

/**
 * Imports functions for `dantil.count()`, `dantil.countEnd()`, and `dantil.countEndAll()`.
 *
 * @private
 * @type {Object}
 */
var _counter = require('./counter')

/**
 * Increments the invocation count for `label`. Use `dantil.end(label)` or `dantil.endAll()` to print the counter's value. This is useful for profiling the number of times a section of code is reached.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {string} label The counter identifier.
 * @example
 *
 * for (var i = 0; i < 100; ++i) {
 *   if (i % 2 === 0) dantil.count('even')
 * }
 *
 * dantil.countEnd('even')
 * // => Resets the count for 'even' to 0
 * // => Prints "even: 50"
 */
exports.count = _counter.count

/**
 * Prints (and resets the value of) the number of `dantil.count(label)` invocations.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {string} label The counter identifier.
 */
exports.countEnd = _counter.end

/**
 * Prints (and resets the values of) the counter value of each label recorded by `counter.count()`, and each counter's value as a percentage of all counters.
 *
 * Does not print counters that are never reached (having not initialized their keys). Prints counts in order of decreasing value.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @example
 *
 * for (var i = 0; i < 99; ++i) {
 *  dantil.count(i % 2 === 0 ? 'even' : 'odd')
 * }
 *
 * dantil.endAll()
 * // => Resets all counts to 0
 * // => Prints "even: 50 (50.5%)
 * //            odd: 49 (49.5%)"
 */
exports.countEndAll = _counter.endAll

/**
 * Creates a shallow clone of `value`.
 *
 * @static
 * @memberOf dantil
 * @category Lang
 * @param {*} value The value to clone.
 * @returns {*} Returns the cloned value.
 * @example
 *
 * var objects = [ { a: 1 }, { b: 2 } ]
 *
 * var shallow = dantil.clone(objects)
 * shallow === objects
 * // => false
 * shallow[0] === objects[0]
 * // => true
 */
exports.clone = function (value) {
	// Return primitive values.
	var type = typeof value
	if (value === null || (type !== 'object' && type !== 'function')) {
		return value
	}

	// Copy arrays using `Array.prototype.slice()`.
	if (value instanceof Array) {
		return value.slice()
	}

	// Copy functions and objects.
	var clone = new value.constructor()
	for (var prop in value) {
		// Copy direct properties, skipping properties inherited through the prototype chain.
		if (value.hasOwnProperty(prop)) {
			clone[prop] = value[prop]
		}
	}
	return clone
}

/**
 * Performs a deep comparison between two values to determine if they are equivalent using the [`lodash.isEqual`](https://npmjs.com/package/lodash.isequal) module.
 *
 * @static
 * @memberOf dantil
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {Function} [customizer] The function to customize value comparisons.
 * @param {*} [thisArg] The `this` binding of `customizer`.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { user: 'fred' }
 * var other = { user: 'fred' }
 *
 * object == other
 * // => false
 *
 * dantil.isDeepEqual(object, other)
 * // => true
 */
exports.isDeepEqual = require('lodash.isequal')

/**
 * Creates a function that accepts up to one argument, ignoring any additional arguments.
 *
 * @static
 * @memberOf dantil
 * @category Function
 * @param {Function} func The function for which to cap arguments.
 * @returns {Function} Returns the new function.
 * @example
 *
 * [ '3', '1', '4' ].map(dantil.unary(parseInt))
 * // => [ 3, 1, 4 ]
 */
exports.unary = function (func) {
	return function () {
		return func(arguments[0])
	}
}

/**
 * Performs a shallow comparison between two objects to determine if they are equivalent.
 *
 * @static
 * @memberOf dantil
 * @category Object
 * @param {Object} a The object to compare.
 * @param {Object} b The other object to compare.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 * @example
 *
 * dantil.objectsEqual({}, {})
 * // => true
 *
 * dantil.objectsEqual({ name: 'danny', val: 1 }, { name: 'danny', val: 1 })
 * // => true
 *
 * dantil.objectsEqual({ name: 'danny' }, { val: 1 })
 * // => false
 *
 * // A shallow comparison will compare complex type references, not their contents.
 * var objA = { prop: 'val' }
 * var objB = { prop: 'val' }
 * dantil.objectsEqual({ name: 'danny', obj: objA }, { name: 'danny', obj: objB })
 * // => false
 *
 * // Rather, objects are only equal if they are the same instance.
 * dantil.objectsEqual({ a: objA, b: objB }, { a: objA, b: objB })
 * // => true
 */
exports.objectsEqual = function (a, b) {
	// Objects are identical references (or, both are `undefined`).
	if (a === b) return true

	// One of two is `undefined`.
	if (!a || !b) return false

	// Perform shallow comparison of property values.
	for (var prop in a) {
		if (a[prop] !== b[prop]) return false
	}

	return true
}

/**
 * Recursively removes all properties of `object` defined as `undefined`. This is useful for object comparisons and pretty-printing.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf dantil
 * @category Object
 * @param {Object} object The `Object` to purge of properties defined as `undefined`.
 * @returns {Object} Returns `object` without `undefined` properties.
 */
exports.deleteUndefinedObjectProps = function (object) {
	for (var prop in object) {
		var value = object[prop]

		if (value === undefined) {
			delete object[prop]
		} else if (typeof value === 'object') {
			object[prop] = exports.deleteUndefinedObjectProps(value)
		}
	}

	return object
}

/**
 * Compares two objects line by line and stylizes the differences for printing.
 *
 * @static
 * @memberOf dantil
 * @category Object
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {boolean} [collapsed] Specify putting ranges of unchanged lines in a fold.
 * @returns {string} Returns a string of the differences stylized for printing.
 * @example
 *
 * var objA = {
 *   name: 'dantil',
 *   author: 'Danny',
 *   version: 0.1,
 *   sagan: [
 *     'It has been said that astronomy is a humbling and character-building',
 *     'experience. There is perhaps no better demonstration of the folly of',
 *     'human conceits than this distant image of our tiny world. To me, it',
 *     'underscores our responsibility to deal more kindly with one another,',
 *     'and to preserve and cherish the pale blue dot, the only home we\'ve'
 *   ]
 * }
 *
 * var objB = {
 *   name: 'dantil',
 *   author: 'Danny',
 *   version: 0.2,
 *   sagan: [
 *     'It has been said that astronomy is a humbling and character-building',
 *     'experience. There is perhaps no better demonstration of the folly of',
 *     'human conceits than this distant image of our tiny world. To me, it',
 *     'underscores our responsibility to deal more kindly with one another,',
 *     'ever known.'
 *   ]
 * }
 * ```
 * ```js
 * // Compare objects and generate string with differences stylized.
 * console.log(dantil.diffObjects(objA, objB))
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-diffObjects-example.jpg" alt="dantil.diffObjects() example output"/>
 * ```js
 * // Collapse ranges of unchanged lines.
 * console.log(dantil.diffObjects(objA, objB, true))
 * ```
 * Collapsed output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-diffObjects-collapsed-example.jpg" alt="dantil.diffObjects() collapsed example output"/>
 * ```
 */
exports.diffObjects = function (object, other, collapsed) {
	// Stringify objects.
	object = JSON.stringify(object, null, '\t')
	other = JSON.stringify(other, null, '\t')

	// Compare stringified objects line by line.
	var diffParts = jsdiff.diffLines(object, other)
	var unchangedFoldBuffSize = 1
	var diff = ''

	for (var p = 0, partsLen = diffParts.length; p < partsLen; ++p) {
		var part = diffParts[p]

		if (part.added) {
			diff += exports.colors.green(part.value)
		} else if (part.removed) {
			diff += exports.colors.red(part.value)
		} else if (collapsed) {
			if (partsLen > 1) {
				// Split by line-breaks, except for the trailing line-break.
				var lines = part.value.split('\n', part.count)
				var unchangedPart = ''

				if (p === 0) {
					// The leading unchanged part of the diff, with only a change after.
					if (part.count > unchangedFoldBuffSize) {
						unchangedPart += genDiffFold(part, unchangedFoldBuffSize) + '\n'
					}

					unchangedPart += lines.slice(-unchangedFoldBuffSize).join('\n') + '\n'
				} else if (p === partsLen - 1) {
					// The trailing unchanged part of the diff, with only a change before.
					unchangedPart += lines.slice(0, unchangedFoldBuffSize).join('\n')

					if (part.count > unchangedFoldBuffSize) {
						unchangedPart += '\n' + genDiffFold(part, unchangedFoldBuffSize)
					}
				} else if (part.count > unchangedFoldBuffSize * 2) {
					// A middle unchanged part of the diff, with changes before and after.
					unchangedPart += lines.slice(0, unchangedFoldBuffSize).join('\n') + '\n'

					unchangedPart += genDiffFold(part, unchangedFoldBuffSize * 2) + '\n'

					unchangedPart += lines.slice(-unchangedFoldBuffSize).join('\n') + '\n'
				} else {
					// Separate from previous condition, because length of 1 produces duplicate lines.
					unchangedPart += part.value
				}

				diff += exports.colors.grey(unchangedPart)
			} else {
				return 'No changes.'
			}
		} else {
			diff += exports.colors.grey(part.value)
		}
	}

	return diff
}

/**
 * Generates a bar depicting a range of unchanged lines collapsed in a fold, for use by `dantil.diffObjects()`.
 *
 * @private
 * @static
 * @param {Object} part The part being collapsed.
 * @param {number} foldBuffSize The number of unfolded lines to surround the fold.
 * @returns {string} Returns the bar depicting the range of unchanged lines collapsed in a fold.
 */
function genDiffFold(part, foldBuffSize) {
	var linesToFold = part.count - foldBuffSize
	var bar = '----' + linesToFold + (linesToFold === 1 ? ' line' : ' lines')
	return bar + Array(process.stdout.columns + 1 - bar.length).join('-')
}

/**
 * Performs a shallow comparison between two arrays to determine if they are equivalent.
 *
 * If `predicate` is provided, checks if returns truthy when invoked per index with the values of both arrays at that index as arguments: (elementA, elementB).
 *
 * @static
 * @memberOf dantil
 * @category Array
 * @param {Array} a The array to compare.
 * @param {Array} b The other array to compare.
 * @param {Function} [predicate] The function invoked per index.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 * @example
 *
 * dantil.arraysEqual([], [])
 * // => true
 *
 * dantil.arraysEqual([1, 2, 3, 'danny'], [1, 2, 3, 'danny'])
 * // => true
 *
 * dantil.arraysEqual([ false, true ], [ true ])
 * // => false
 *
 * // A shallow comparison will compare complex type references, not their contents.
 * var objA = { prop: 'val' }
 * var objB = { prop: 'val' }
 * var objC = { prop: undefined }
 * dantil.arraysEqual([ objA, objC ], [ objB, objC ])
 * // => false
 *
 * // Compare elements at each index using `dantil.objectsEqual`.
 * dantil.arraysEqual([ objA, objC ], [ objB, objC ], dantil.objectsEqual)
 * // => true
 *
 * // Rather, objects are only equal if they are the same instance.
 * dantil.arraysEqual([ objA, objB ], [ objA, objB ])
 * // => true
 */
exports.arraysEqual = function (a, b, predicate) {
	// Arrays are identical references (or, both are `undefined`).
	if (a === b) return true

	// One of two is `undefined`.
	if (!a || !b) return false

	var aLength = a.length

	// Lengths are different.
	if (aLength !== b.length) return false

	if (predicate) {
		// Compare elements at each index with `predicate`.
		for (var i = 0; i < aLength; ++i) {
			if (!predicate(a[i], b[i])) return false
		}
	} else {
		// Perform shallow comparison of elements.
		for (var i = 0; i < aLength; ++i) {
			if (a[i] !== b[i]) return false
		}
	}

	return true
}

/**
 * Creates a new two-dimensional array with length `length`.
 *
 * @static
 * @memberOf dantil
 * @category Array
 * @param {number} length The length of the new array (i.e., the first dimension).
 * @param {number} [subLength=0] The length each sub-array (i.e., the second dimension).
 * @returns {Array} Returns the new two-dimensional array.
 * @example
 *
 * dantil.new2DArray(5)
 * // => [ [], [], [], [], [] ]
 *
 * dantil.new2DArray(4, 2)
 * // => [ [ ,  ], [ ,  ], [ ,  ], [ ,  ] ]
 */
exports.new2DArray = function (length, subLength) {
	if (isNaN(subLength)) {
		subLength = 0
	}

	var array = new Array(length)
	for (var i = 0; i < length; ++i) {
		array[i] = new Array(subLength)
	}
	return array
}

/**
 * Creates a new array from `array` excluding all provided values.
 *
 * @static
 * @memberOf dantil
 * @category Array
 * @param {Array} array The array to filter.
 * @param {...*} [values] The values to exclude.
 * @returns {Array} Returns the new array of filtered values.
 * @example
 *
 * dantil.without([ 3, 1, 4, 1, 5 ], 1, 5)
 * // => [ 3, 4 ]
 */
exports.without = function (array) {
	// Accumulate forbidden values to compare to `array`.
	var values = new Array(arguments.length - 1)
	for (var a = 1, argumentsLen = arguments.length; a < argumentsLen; ++a) {
		values[a - 1] = arguments[a]
	}

	// Copy items in `array` not included in provided values.
	var result = []
	for (var i = 0, arrayLen = array.length; i < arrayLen; ++i) {
		var el = array[i]
		if (values.indexOf(el) === -1) {
			result.push(el)
		}
	}
	return result
}

/**
 * Removes any extraneous digits from `number`, which result from operations limited by JavaScript's floating point number precision, such as `0.1 * 0.2` (which does not equal `0.02`). This limitation results from being unable to map `0.1` to a finite binary floating point number.
 *
 * @static
 * @memberOf dantil
 * @category Number
 * @param {number} number The number to rid of any extraneous digits.
 * @returns {number} Returns the cleaned number.
 * @example
 *
 * var number = 0.1 * 0.2
 * // => 0.020000000000000004
 *
 * number = dantil.cleanFloat(number)
 * // => 0.02
 */
exports.cleanFloat = function (number) {
	// JavaScript has floating point number precision of 13 digits after the decimal point.
	return Number(number.toFixed(13))
}

/**
 * Compares two strings word by word and stylizes the differences for printing.
 *
 * @static
 * @memberOf dantil
 * @category String
 * @param {string} expected The string to compare.
 * @param {string} actual The other string to compare.
 * @returns {Object} Returns an object with `expected` and `actual` as properties for the strings with their differences stylized for printing.
 * @example
 *
 * var expected = 'We long to be here for a purpose, even though, despite much self-deception, none is evident.'
 * var actual = 'We all long for a purpose, even though none is evident.'
 *
 * // Compare strings and style the differences.
 * var diff = dantil.diffStrings(expected, actual)
 * console.log(diff.expected)
 * console.log(diff.actual)
 * ```
 * Output:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-diffStrings-example.jpg" alt="dantil.diffStrings() example output"/>
 * ```
 */
exports.diffStrings = function (expected, actual) {
	// Compare strings word by word.
	var diffParts = jsdiff.diffWords(expected, actual)
	var diff = {
		expected: '',
		actual: '',
	}

	for (var p = 0, partsLen = diffParts.length; p < partsLen; ++p) {
		var part = diffParts[p]

		if (part.removed) {
			diff.expected += exports.colors.red(part.value)
		} else if (part.added) {
			diff.actual += exports.colors.green(part.value)
		} else {
			diff.expected += part.value
			diff.actual += part.value
		}
	}

	return diff
}

/**
 * Formats a string in a `printf()`-like format using Node's `util.format()`.
 *
 * @static
 * @memberOf dantil
 * @category String
 * @param {string} string The string to format containing zero or more placeholders. Each placeholder is replaced with the converted value from its corresponding argument.
 * @param {...string} [placeholderVals] The values to replace the corresponding placeholders in `string`.
 * @returns {string} Returns the formatted string.
 * @example
 *
 * dantil.format('%s:%s %d', 'foo', 'bar', 22)
 * // => 'foo:bar 22'
 */
exports.format = util.format

/**
 * Converts kebab cased `string` to camel case.
 *
 * @static
 * @memberOf dantil
 * @category String
 * @param {string} kebabCasedString The kebab cased string to convert.
 * @returns {string} Returns the camel cased string.
 * @example
 *
 * dantil.kebabToCamelCase('my-long-variable-name')
 * // => 'myLongVariableName'
 */
exports.kebabToCamelCase = function (kebabCasedString) {
	return kebabCasedString.replace(/-(\w)/g, function (match, group1) {
		return group1.toUpperCase()
	})
}

/**
 * Converts camel cased `string` to kebab case.
 *
 * @static
 * @memberOf dantil
 * @category String
 * @param {string} camelCasedString The camel cased string to convert.
 * @returns {string} Returns the kebab cased string.
 * @example
 *
 * dantil.camelToKebabCase('myLongVariableName')
 * // => 'my-long-variable-name'
 */
exports.camelToKebabCase = function (camelCasedString) {
	return camelCasedString.replace(/[A-Z]/g, function (match) {
		return '-' + match.toLowerCase()
	})
}

/**
 * Encloses `string` in single quotes.
 *
 * @static
 * @memberOf dantil
 * @category String
 * @param {string} string The string to enclose with single quotes.
 * @returns {string} Returns the enquoted string.
 * @example
 *
 * dantil.enquote('my string')
 * // => '\'my string\''
 */
exports.enquote = function (string) {
	return '\'' + string + '\''
}