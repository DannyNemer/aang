/**
 * @license
 * dantil 0.0.1 - A Node.js utility library.
 * Copyright 2015-2016 Danny Nemer
 * Available under MIT license <http://opensource.org/licenses/MIT>
 */

var fs = require('fs')
var util = require('util')
var jsdiff = require('diff')

/**
 * Checks if `options` adheres to `schema` using the [`ill-formed-opts`] (https://github.com/DannyNemer/ill-formed-opts) module, thereby simulating static function arguments (i.e., type checking and parameter count). Prints descriptive, helpful errors messages when `options` is ill-formed, including the line number of the offending function call.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @param {Object} schema The definition of required and optional properties for `options`.
 * @param {Object} options The options object to check for conformity to `schema`.
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
 * Invokes `func` within a `try` block. If an exception is thrown, removes parentheses surrounding file paths in its stack trace for iTerm's open-file-path shortcut, collects 15 stack frames instead of 10 (the default), and colors the error type name (e.g., `TypeError`) red.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @param {Function} func The function invoked within a `try` block.
 * @param {boolean} [exitProcessIfFailure] Specify ending the process with 'failure' code `1` (after printing its stack trace) should `func` throw an exception. The shell that executed Node will see an exit code of `1`.
 * @returns {*} Returns the return value of `func`, if any.
 * @example
 *
 * dantil.tryCatchWrapper(function () {
 *   // ...stuff...
 *   throw new Error('test failed')
 * })
 * // => Catches thrown exception and prints a formatted stack trace
 */
exports.tryCatchWrapper = function (func, exitProcessIfFailure) {
	// Temporarily increase the stack trace limit.
	var origStackTraceLimit = Error.stackTraceLimit
	Error.stackTraceLimit = 15

	try {
		var returnVal = func()

		// Restore stack trace limit.
		Error.stackTraceLimit = origStackTraceLimit

		return returnVal
	} catch (e) {
		// Print leading newline.
		exports.log()

		if (e.stack) {
			// Error message without source code (if present).
			var message = e.message.split('\n').pop()

			e.stack.split('\n').forEach(function (stackLine) {
				if (e.message.indexOf(stackLine) !== -1) {
					exports.log(stackLine)
				} else if (stackLine.indexOf(message) !== -1) {
					// Color error type name red.
					exports.log(stackLine.replace(e.name, exports.colors.red(e.name)))
					message = null
				} else {
					// Remove parentheses surrounding file paths for iTerm's open-file-path shortcut.
					exports.log(stackLine.replace(/[()]/g, ''))
				}
			})
		} else {
			exports.log(e)
		}

		if (exitProcessIfFailure) process.exit(1)

		// Restore stack trace limit after collecting stack trace.
		Error.stackTraceLimit = origStackTraceLimit
	}
}

/**
 * Deletes the modules identified by the provided paths from cache, forcing them to be reloaded at next `require()` call. Without removing a module from cache, subsequent `require()` calls to the same module will not enable changes to its file(s). This is useful for enabling changes on a server without restarting the server.
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
 * Gets the file path and line number in the format `filePath:lineNumber` of where this method is invoked.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @returns {string} Returns the file path and line number in the format `filePath:lineNumber`.
 * @example
 *
 * // The contents of 'foo.js':
 *
 * dantil.getPathAndLineNumber()
 * // => '/Users/Danny/foo.js:1'
 */
exports.getPathAndLineNumber = function () {
	return getFormattedStackFrame(function (stack) {
		// Get the frame for where this method is invoked.
		return stack[0]
	})
}

/**
 * Gets the file path and line number of the function call that invoked the currently executing module. Returns the path and line number in the format `filePath:lineNumber`.
 *
 * This is not necessarily the caller of the currently executing function, which can be another function within the same module. Nor is it necessarily this module's parent which instantiated the module. Rather, it is the most recent function call in the stack outside the currently executing module.
 *
 * Returns `undefined` if there is no other module in the stack below where this method was called.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @returns {string} Returns the file path and line number in the format `filePath:lineNumber`.
 * @example
 *
 * // The contents of 'main.js':
 *
 * var child = require('./child.js')
 * child.func()
 *
 * var grandchild = require('./grandchild.js')
 * grandchild.foo()
 *
 * // Try to get the frame of the nonexistent function call that invoked this module.
 * dantil.getModuleCallerPathAndLineNumber()
 * // => undefined
 * ```
 *
 * ```js
 * // The contents of 'child.js':
 *
 * var grandchild = require('./grandchild.js')
 *
 * exports.func = function () {
 *   // Get the frame of the invocation of the current execution of this module.
 *   dantil.getModuleCallerPathAndLineNumber()
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
 *   dantil.getModuleCallerPathAndLineNumber()
 *   // => '/Users/Danny/main.js:2'
 * }
 * ```
 *
 * ```js
 * // The contents of 'grandchild.js':
 *
 * exports.foo = function () {
 *   dantil.getModuleCallerPathAndLineNumber()
 *   // => '/Users/Danny/main.js:5'
 * }
 *
 * exports.bar = function () {
 *   dantil.getModuleCallerPathAndLineNumber()
 *   // => '/Users/Danny/child.js:13'
 * }
 */
exports.getModuleCallerPathAndLineNumber = function () {
	return getFormattedStackFrame(function (stack) {
		var thisModuleName

		for (var f = 0, stackLen = stack.length; f < stackLen; ++f) {
			var frame = stack[f]

			// Get the module name of where this method was called.
			if (!thisModuleName) {
				thisModuleName = frame.getFileName()
				continue
			}

			// Stop when finding the frame of the most recent module after where this method was called.
			if (thisModuleName !== frame.getFileName()) {
				return frame
			}
		}

		// Return `undefined` if there is no other module in the stack below where this method was called.
		return undefined
	})
}

/**
 * Passes a structured stack trace as an `Array` of `CallSite` objects, without frames for native Node functions and this file, to the provided `getFrameFunc(stack)`, which returns a single frame from the `Array`. Returns the file path and line number of the returned frame in the format `filePath:lineNumber`.
 *
 * @private
 * @static
 * @param {Function} getFrameFunc The function passed the structured stack trace and returns a single stack frame.
 * @returns {string} Returns the file path and line number of the frame returned by `getFrameFunc` in the format `filePath:lineNumber`.
 */
function getFormattedStackFrame(getFrameFunc) {
	var origStackTraceLimit = Error.stackTraceLimit
	var origPrepareStackTrace = Error.prepareStackTrace

	// Collect all stack frames.
	Error.stackTraceLimit = Infinity

	// Get a structured stack trace as an `Array` of `CallSite` objects, each of which represents a stack frame, with frames for native Node functions and this file removed.
	Error.prepareStackTrace = function (error, structuredStackTrace) {
		return structuredStackTrace.filter(function (frame) {
			var filePath = frame.getFileName()

			// Avoid frames for native Node functions, such as `require()`.
			if (!/\//.test(filePath)) return false

			// Avoid frames from within this file, 'dantil.js'.
			if (filePath === __filename) return false

			return true
		})
	}

	// Get the stack frame.
	var frame = getFrameFunc(Error().stack)

	// Restore stack trace configuration after collecting stack trace.
	Error.stackTraceLimit = origStackTraceLimit
	Error.prepareStackTrace = origPrepareStackTrace

	// Return the path and line number of the frame in the format `filePath:lineNumber` if a frame was found, else return `false`.
	return frame && frame.getFileName() + ':' + frame.getLineNumber()
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
 * Invokes `func` while synchronously writing the process's `stdout` to a file at `path` instead of the console. Creates the file if it does not exist or truncates the file to zero length if it does exist. Restores `stdout` to the console when `func` completes or if an exception is thrown.
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
	// Expand '~' if present. Cannot resolve `path` here because `path` may not exist.
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
	// Expand '~' if present. Cannot resolve `path` here because `path` may not exist.
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
 * @param {*} value The value to search for.
 * @param {boolean} [stringify] Specify converting `value` to a string representation before searching.
 * @returns {Array} Returns the file path and line number of each matched line.
 * @example
 *
 * // The contents of 'foo.js':
 *
 * var list = [
 *   { name: 'lorem', value: 2 },
 *   { name: 'lorem ipsum', value: 5 },
 *   { name: 'ipsum', value: 3 }
 * ]
 * ```
 *
 * ```js
 * // The contents of 'bar.js':
 *
 * dantil.pathAndLineNumbersOf('./foo.js', 'ipsum')
 * // => [ '/Users/Danny/foo.js:4', '/Users/Danny/foo.js:3' ]
 *
 * dantil.pathAndLineNumbersOf('./foo.js', 'ipsum', true)
 * // => [ '/Users/Danny/foo.js:4' ]
 */
exports.pathAndLineNumbersOf = function (filePath, string, stringify) {
	var matches = []

	basePathAndLineNumbersOf(filePath, string, stringify, function (pathAndLineNumber) {
		matches.push(pathAndLineNumber)
	})

	return matches
}

/**
 * Gets the file path and line number in the format `filePath:lineNumber` of the first occurrence of `value` in the source file at `filePath`. This is useful for error reporting.
 *
 * @static
 * @memberOf dantil
 * @category File System
 * @param {string} filePath The path of the source file to search.
 * @param {*} value The value to search for.
 * @param {boolean} [stringify] Specify converting `value` to a string representation before searching.
 * @returns {string|undefined} Returns the file path and line number of the matched line, else `undefined`.
 * @example
 *
 * // The contents of 'foo.js':
 *
 * var list = [
 *   { name: 'lorem', value: 2 },
 *   { name: 'lorem ipsum', value: 5 },
 *   { name: 'ipsum', value: 3 }
 * ]
 * ```
 *
 * ```js
 * // The contents of 'bar.js':
 *
 * dantil.firstPathAndLineNumberOf('./foo.js', 'ipsum')
 * // => '/Users/Danny/foo.js:3',
 *
 * dantil.firstPathAndLineNumberOf('./foo.js', 'ipsum', true)
 * // => '/Users/Danny/foo.js:4'
 */
exports.firstPathAndLineNumberOf = function (filePath, string, stringify) {
	var match

	basePathAndLineNumbersOf(filePath, string, stringify, function (pathAndLineNumber) {
		match = pathAndLineNumber

		return true
	})

	return match
}

/**
 * The base implementation of `dantil.pathAndLineNumbersOf()` and `dantil.firstPathAndLineNumberOf()` which finds occurrences of `value` in the source file at `filePath`. Invokes `iteratee` per matched line, with the path and line number in the format `filePath:lineNumber` as the only argument, until `iteratee` returns `true`.
 *
 * @private
 * @static
 * @param {string} filePath The path of the source file to search.
 * @param {*} value The value to search for.
 * @param {boolean} [stringify] Specify converting `value` to a string representation before searching.
 * @param {Function} iteratee The function invoked per matched line until it returns `true`.
 */
function basePathAndLineNumbersOf(filePath, value, stringify, iteratee) {
	// Resolve `filePath` if relative.
	filePath = exports.realpathSync(filePath)

	if (stringify) {
		// Convert `value` to a string representation.
		value = exports.stylize(value, { colors: false })
	}

	var fileLines = fs.readFileSync(filePath, 'utf8').split('\n')
	var fileLinesLen = fileLines.length

	for (var l = 0; l < fileLinesLen; ++l) {
		if (fileLines[l].indexOf(value) !== -1) {
			// Add 1 to line index because line numbers begin at 0.
			var pathAndLineNumber = filePath + ':' + (l + 1)

			if (iteratee(pathAndLineNumber)) {
				break
			}
		}
	}
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
 * Synchronously resolves `path` to an absolute path. Similar to Node's `fs.realpathSync()`, but also expands `'~'` if found in `path` (using `dantil.expandHomeDir()`).
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
	prettyPrint('stdout', prettify(arguments))
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
	prettyPrint('stdout', prettify(arguments, { depth: null }))
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
	prettyPrint('stdout', prettify([ object ], { depth: depth }))
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
	exports.log(exports.colors.grey(exports.getPathAndLineNumber()))
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
	exports.log(exports.colors.grey(exports.getPathAndLineNumber()))
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
	prettyPrint('stderr', prettify(arguments))
}

/**
 * Writes `string` with a newline to `processStreamName`.
 *
 * @private
 * @static
 * @param {string} processStreamName The name of the writable process stream (i.e., `stout` or `stderr`).
 * @param {string} string The string to print.
 */
function prettyPrint(processStreamName, string) {
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
 * Formats plain `Object`s and `Array`s with multi-line string representations on separate lines. Concatenates and formats all other consecutive values on the same line.
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
		// Do not stylize strings passed as arguments (i.e., not `Object` properties). This also preserves any already-stylized arguments.
		var argIsString = typeof arg === 'string'
		var formattedArg = !options.stylizeStings && argIsString ? arg : exports.stylize(arg, stylizeOptions)

		if (i === 0) {
			// Extend indent for remaining arguments with the first argument's leading whitespace, if any.
			if (argIsString) {
				// Get the substring of leading whitespace characters from the start of the string, up to the first non-whitespace character, if any.
				var firstNonWhitespaceIndex = arg.search(/[^\s]/)
				arg = arg.substring(0, firstNonWhitespaceIndex === -1 ? arg.length : firstNonWhitespaceIndex)

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
 * Formats `object` in color for pretty-printing, recursing `options.depth` times while formatting. This is similar to Node's `util.inspect()`, but prints in color by default if the terminal supports color.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {*} object The object or value to stylize.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.colors=true] Specify coloring the string for pretty-printing.
 * @param {number} [options.depth=2] The number of times to recurse while formating `object`. Pass `null` to recurse indefinitely.
 * @returns {string} Returns a stylized string representation of `object`.
 */
exports.stylize = function (object, options) {
	if (!options) {
		options = {}
	}

	// Print in color if the terminal supports color.
	if (options.colors !== false) {
		options.colors = exports.colors.supportsColor
	}

	return util.inspect(object, options)
}

/**
 * Prints the provided values to `stdout` like `dantil.log()`, prepended with red-colored "Error: ".
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
exports.logError = function () {
	var args = prependColoredLabel('Error', 'red', arguments)
	exports.log.apply(null, args)
}

/**
 * Prints the provided values to `stdout` like `dantil.log()` prepended with yellow-colored "Warning: ".
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
exports.logWarning = function () {
	var args = prependColoredLabel('Warning', 'yellow', arguments)
	exports.log.apply(null, args)
}

/**
 * Prints the provided values to `stdout` like `dantil.log()` prepended with green-colored "Success: ".
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
exports.logSuccess = function () {
	var args = prependColoredLabel('Success', 'green', arguments)
	exports.log.apply(null, args)
}

/**
 * Prepends `label` (e.g., "Error") colored `color` (e.g., "Error: ") to `args`. If the first character of the first value in `args` is '\n', moves the character to before `label`.
 *
 * @private
 * @static
 * @param {string} label The label to prepend to `args` (e.g., "Error").
 * @param {string} color The color to stylize `label`.
 * @param {Array} args The values to follow `label`.
 * @returns {Array} Returns the array of `label` followed by the contents of `args`.
 */
function prependColoredLabel(label, color, args) {
	// Temporarily remove ':' to avoid coloring it.
	if (label[label.length - 1] === ':') {
		label = label.slice(0, -1)
	}

	var argsArray = Array.prototype.slice.call(args)

	// If the first character of the first value in `args` is '\n', move the character to before `label`.
	var firstArg = argsArray[0]
	if (firstArg) {
		if (firstArg === '\n' && argsArray.length !== 1) {
			// First argument is '\n' and is not the only argument.
			argsArray.shift()
			label = '\n' + label
		} else if (firstArg[0] === '\n') {
			// First argument begins with '\n'.
			argsArray[0] = firstArg.slice(1)
			label = '\n' + label
		}
	}

	// Color `label` and append `args`.
	return [ exports.colors[color](label) + ':' ].concat(argsArray)
}

/**
 * Prints an error message like `dantil.logError()` followed by the file path and line number of the function call that invoked the currently executing module.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {boolean} [logThisLine] Specify logging the line where this method is called instead of the line which invoked the currently executing module.
 * @param {...*} [values] The optional values and objects to print following "Error: ".
 * @example
 *
 * // The contents of 'foo.js':
 *
 * dantil.logErrorAndPath('Property undefined:', obj)
 * // => Prints: Error: Value undefined: { property: undefined }
 * //              /Users/Danny/foo.js:1
 */
exports.logErrorAndPath = function (logThisLine) {
	var args = Array.prototype.slice.call(arguments, typeof logThisLine === 'boolean' ? 1 : 0)
	var stackLine

	if (logThisLine === true) {
		stackLine = exports.getPathAndLineNumber()
	} else {
		stackLine = exports.getModuleCallerPathAndLineNumber()
	}

	if (args.length > 0) {
		exports.logError.apply(null, args)
		exports.log('  ' + stackLine)
	} else {
		exports.logError(stackLine)
	}

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
 * // The contents of 'foo.js':
 *
 * var obj = {
 *   values: [1, 2, 3],
 *   name: 'danny'
 * }
 *
 * dantil.logPathAndObject(obj)
 * // => Prints: /Users/Danny/foo.js:6
 * //              { values: [ 1, 2, 3 ], name: 'danny' }
 */
exports.logPathAndObject = function (object, logThisLine) {
	var pathAndLineNumber = logThisLine ? exports.getPathAndLineNumber() : exports.getModuleCallerPathAndLineNumber()

	// Print a leading newline, path and line number, `object`, and a trailing newline.
	exports.log('\n' + pathAndLineNumber, object)
	exports.log()
}

/**
 * Prints the stack trace to the current position. Removes parentheses surrounding file paths for iTerm's open-file-path shortcut.
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

	// Remove parentheses surrounding file paths for iTerm's open-file-path shortcut.
	var origPrepareStackTrace = Error.prepareStackTrace
	exports.prettifyStackTrace()

	// Get stack without lines for `Error` and this file.
	exports.log(Error().stack.split('\n').slice(3).join('\n'))

	// Restore original stack trace formatter after collecting stack trace.
	Error.prepareStackTrace = origPrepareStackTrace
}

/**
 * Prints the calling file path and line number, prepended by optional `message`. This is useful for marking reaching a section of code.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {string} [message] The optional message to prepend to the path and line number.
 * @example
 *
 * // The contents of 'foo.js':
 *
 * if (rareConditionIsTrue) {
 *   dantil.logLine('Condition met')
 *   // => Prints "Condition met: /Users/Danny/foo.js:2"
 * }
 */
exports.logLine = function (message) {
	exports.log(exports.colors.red(message || 'Reached') + ':', exports.getPathAndLineNumber())
}

/**
 * If `value` is truthy, prints the calling file path and line number, prepended by optional `message`. This is useful for marking reaching a section of code.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {*} value The value to check if truthy.
 * @param {string} [message] The optional message to prepend to the path and line number.
 * @example
 *
 * // The contents of 'foo.js':
 *
 * var myCondition = true
 * dantil.logLineIf(myCondition, 'Condition met')
 * // => Prints "Condition met: /Users/Danny/foo.js:1"
 */
exports.logLineIf = function (value, message) {
	if (value) {
		exports.logLine(message)
	}
}

/**
 * Modifies V8's default stack trace format (when printing) to color function names and not surround file paths with parentheses. The latter is useful for iTerm's open-file-path shortcut (which the parentheses would otherwise break).
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @example
 *
 * dantil.prettifyStackTrace()
 * // => Prettifies all subsequent stack traces
 * ```
 * Before:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-prettifyStackTrace-example-before.jpg" alt="Before invoking dantil.prettifyStackTrace()"/>
 * After:
 * <br><img src="https://raw.githubusercontent.com/DannyNemer/dantil/master/doc/img/dantil-prettifyStackTrace-example-after.jpg" alt="After invoking dantil.prettifyStackTrace()"/>
 * ```
 */
exports.prettifyStackTrace = function () {
	Error.prepareStackTrace = function (error, structuredStackTrace) {
		var stack = structuredStackTrace.map(function (frame) {
			var string = frame.toString()

			// Remove parentheses surrounding file path, if any.
			if (/\//.test(frame.getFileName())) {
				string = string.replace(/[()]/g, '')
			}

			// Color function name.
			var funcNameEndIdx = string.indexOf(' ')
			if (funcNameEndIdx !== -1) {
				string = exports.colors.cyan(string.slice(0, funcNameEndIdx)) + string.slice(funcNameEndIdx)
			}

			// Replicate default stack trace indentation.
			return '    at ' + string
		})

		// Prepend stack with error message (as is the default behavior).
		stack.unshift(error)

		return stack.join('\n')
	}
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
 * // The contents of 'foo.js':
 *
 * dantil.assertEqual(false, 0)
 * // => true
 *
 * dantil.assertEqual(20, 21)
 * // => false
 * // => Prints: AssertionError: 20 == 21
 * //              /Users/Danny/foo.js:5
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

		prettyPrint('stderr', label + (message ? message + ': ' : '') + comparisonStr)
		prettyPrint('stderr', '  ' + exports.getPathAndLineNumber())

		return false
	}

	return true
}

/**
 * Imports functions for `dantil.time()` and `dantil.timeEnd()`.
 *
 * @private
 * @type Object
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
 * @type Object
 */
var _counter = require('./counter')

/**
 * Counts the number of times a section of code is reached, identified by `label`. Use `dantil.countEnd(label)` to print the counter's value. This is useful for profiling complex programs.
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
 * Prints (and resets the value of) the number of calls of `dantil.count(label)`.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {string} label The counter identifier.
 */
exports.countEnd = _counter.end

/**
 * Prints (and resets) the values of all counters used on `dantil.count()`. Does not print counters that are never reached (and never have their keys initialized).
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @example
 *
 * for (var i = 0; i < 100; ++i) {
 *   if (i % 2 === 0) dantil.count('even')
 *   if (i % 2 === 1) dantil.count('odd')
 *   if (i > 100) dantil.count('never reached')
 * }
 *
 * dantil.countEndAll()
 * // => Resets all counts to 0
 * // => Prints "even: 50
 * //            odd: 50"
 */
exports.countEndAll = _counter.endAll

/**
 * Creates a shallow clone of `value`.
 *
 * Note: This method uses the `for...in` statement, which has poor performance relative to other implementations. I.e., do not use this method if performance is a concern.
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
	var type = typeof value
	if (type !== 'object' && type !== 'function') {
		return value
	}

	var clone = {}

	for (var prop in value) {
		clone[prop] = value[prop]
	}

	return clone
}

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
 * @returns {Array} Returns the new two-dimensional array.
 * @example
 *
 * dantil.new2DArray(5)
 * // => [ [], [], [], [], [] ]
 */
exports.new2DArray = function (length) {
	var array = new Array(length)

	for (var i = 0; i < length; ++i) {
		array[i] = []
	}

	return array
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
 * Recursively deletes all properties of `object` defined as `undefined`. This is useful for object comparisons and pretty-printing.
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