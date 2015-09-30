/**
 * @license
 * dantil 0.0.1 - A Node.js utility library.
 * Copyright 2015 Danny Nemer
 * Available under MIT license <http://opensource.org/licenses/MIT>
 */

var fs = require('fs')
var util = require('util')

/**
 * Checks if options object `options` adheres to `schema`. Simulates static function arguments (i.e., type checking and parameter count). Prints descriptive, helpful errors messages when `options` is ill-formed.
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
 *   // Must be of type `Number`.
 *   num: Number,
 *
 *   // Must be of type `Number` (identical to previous parameter).
 *   otherNum: { type: Number },
 *
 *   // Must be of type `Array` or `Object`.
 *   args: [ Array, Object ],
 *
 *   // Must be of type `Array` or `Object` (identical to previous parameter).
 *   otherArgs: { type: [ Array, Object ] },
 *
 *   // Must be `Array` containing only strings.
 *   strings: { type: Array, arrayType: String },
 *
 *   // Parameter can be omitted.
 *   str: { type: String, optional: true },
 *
 *   // Must be one of predefined values.
 *   val: { values: [ 'red', 'yellow', 'blue' ] }
 * }
 *
 * function myFunc(options) {
 *   if (dantil.illFormedOpts(schema, options)) {
 *     // => Prints descriptive, helpful error messages
 *
 *     // Handle ill-formed `options` how you choose
 *     throw new Error('ill-formed options')
 *   }
 *
 *   // ...stuff...
 * }
 */
exports.illFormedOpts = function (schema, options) {
	// Check if missing an options parameter required by schema.
	for (var paramName in schema) {
		var paramSchema = schema[paramName]

		if (!paramSchema.optional && (!options || !options.hasOwnProperty(paramName))) {
			exports.logError('Missing \'' + paramName + '\' property:')
			exports.logPathAndObject(options, true)
			return true
		}
	}

	// Check if passed parameters conform to schema.
	for (var paramName in options) {
		// Check for unrecognized properties.
		if (!schema.hasOwnProperty(paramName)) {
			exports.logError('Unrecognized property:', exports.stylize(paramName))
			exports.logPathAndObject(options, true)
			exports.log('\nAccepted properties:', schema)
			return true
		}

		var optsVal = options[paramName]
		var paramSchema = schema[paramName]
		var paramSchemaType = paramSchema.type || paramSchema
		var paramSchemaVals = paramSchema.values

		// Check for an accidentally passed `undefined` object; e.g., `undefined`, `[]`, `[ 1, undefined ]`.
		if (optsVal === undefined || (Array.isArray(optsVal) && (optsVal.length === 0 || optsVal.indexOf(undefined) !== -1))) {
			exports.logError('undefined \'' + paramName + '\':', optsVal)
			exports.logPathAndObject(options, true)
			return true
		}

		if (paramSchemaVals) {
			// Check if passed value is not an acceptable value.
			if (paramSchemaVals.indexOf(optsVal) === -1) {
				exports.logError('Unrecognized value for \'' + paramName + '\':', exports.stylize(optsVal))
				exports.log('       Acceptable values for \'' + paramName + '\':', paramSchemaVals)
				exports.logPathAndObject(options, true)
				return true
			}
		} else if (Array.isArray(paramSchemaType)) {
			// Check if passed value is not of an acceptable type.
			if (paramSchemaType.indexOf(optsVal.constructor) === -1) {
				exports.logError('Incorrect type for \'' + paramName + '\':', exports.stylize(optsVal))
				exports.log('       Acceptable types for \'' + paramName + '\':', paramSchemaType.map(function (constructor) {
					return constructor.name
				}))
				exports.logPathAndObject(options, true)
				return true
			}
		} else {
			// Check if passed value is not of correct type.
			if (optsVal.constructor !== paramSchemaType) {
				exports.logError('\'' + paramName + '\' not of type ' + paramSchemaType.name + ':', exports.stylize(optsVal))
				exports.logPathAndObject(options, true)
				return true
			}

			// Check if passed Array contains elements not of `arrayType` (if `arrayType` is defined).
			if (Array.isArray(optsVal) && paramSchema.arrayType && optsVal.some(function (el) { return el.constructor !== paramSchema.arrayType })) {
				exports.logError('\'' + paramName + '\' array contains elements other than of type ' + paramSchema.arrayType.name + ':', optsVal)
				exports.logPathAndObject(options, true)
				return true
			}
		}
	}

	// No errors
	return false
}

/**
 * Executes `func` within a `try` block. If an exception is thrown, removes parentheses surrounding file paths in its stack trace for iTerm's open-file-path shortcut, and colors the error type name (e.g., `TypeError`) red.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @param {Function} func The function to execute within a `try` block.
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
	try {
		return func()
	} catch (e) {
		// Print leading blank line.
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
	}
}

/**
 * Deletes the modules identified by the provided paths from cache, forcing them to be reloaded at next `require()` call. Without removing a module from cache, subsequent `require()` calls to the same module will not enable changes to its file(s). This is useful for enabling changes on a server without restarting the server.
 *
 * @static
 * @memberOf dantil
 * @category Utility
 * @param {...string} paths The paths of modules to remove from cache.
 * @example
 *
 * // Load module
 * var myModule = require('./myModule.js')
 *
 * // Remove module from cache
 * dantil.deleteModuleCache('./myModule.js')
 *
 * // Load module again, enabling changes to './myModule.js'
 * myModule = require('./myModule.js')
 */
exports.deleteModuleCache = function () {
	Array.prototype.slice.call(arguments).forEach(function (path) {
		delete require.cache[fs.realpathSync(path)]
	})
}

/**
 * Gets the file path and line number in the format `filePath:lineNumber` of where this function is invoked.
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
		// Get the frame for where this function is invoked.
		return stack[0]
	})
}

/**
 * Gets the file path and line number of the function call that invoked the currently executing module. Returns the path and line number in the format `filePath:lineNumber`.
 *
 * This is not necessarily the caller of the currently executing function, which can be another function within the same module. Nor is it necessarily this module's parent which instantiated the module. Rather, it is the most recent function call in the stack outside the currently executing module.
 *
 * Returns `undefined` if there is no other module in the stack below where this function was called.
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
 * // Try to get the frame of the nonexistant function call that invoked this module.
 * dantil.getModuleCallerPathAndLineNumber()
 * // => undefined
 * ```
 *
 * ```javascript
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
 * ```javascript
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

			// Get the module name of where this function was called.
			if (!thisModuleName) {
				thisModuleName = frame.getFileName()
				continue
			}

			// Stop when finding the frame of the most recent module after where this function was called.
			if (thisModuleName !== frame.getFileName()) {
				return frame
			}
		}

		// Return `undefined` if there is no other module in the stack below where this function was called.
		return undefined
	})
}

/**
 * Passes a structured stack trace as an `Array` of `CallSite` objects, without frames for native Node functions and this file, to the provided `getFrameFunc(stack)`, which returns a single frame from the `Array`. Returns the file path and line number of the returned frame in the format `filePath:lineNumber`.
 *
 * @private
 * @param {Function} getFrameFunc The function passed the structured stack trace and returns a single stack frame.
 * @returns {String} Returns the file path and line number of the frame returned by `getFrameFunc` in the format `filePath:lineNumber`.
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

			// Avoid frames from within this file (i.e., 'dantil.js').
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
 * Stylizes strings for printing to the console using the [chalk](https://github.com/chalk/chalk) module.
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
 * Synchronously writes the process's `stdout` to a file at `path` instead of the console while processing `func`. Creates the file if it does not exist or truncates the file to zero length if it does exist. Restores `stdout` to the console when `func` completes or if an exception is thrown.
 *
 * @static
 * @memberOf dantil
 * @category File System
 * @param {string} path The path where to write `stdout`.
 * @param {Function} func The function to process while writing output to `path`.
 * @returns {*} Returns the value returned by `func`, if any.
 * @example
 *
 * // Print to console
 * console.log('Begin output to file')
 *
 * // Redirect `stdout` from console to '~/Desktop/out.txt'
 * dantil.stdoutToFile('~/Desktop/out.txt', function () {
 *   console.log('Numbers:')
 *   for (var i = 0; i < 100; ++i) {
 *     console.log(i)
 *   }
 * })
 * // => Restores `stdout` to console and prints "Output saved: ~/Desktop/out.txt"
 *
 * // Print to console (after restoring `stdout`)
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
 * Writes `obj` to a JSON file at `path`.
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
 * @param {boolean} stringify Specify converting `value` to a string representation before searching.
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
 * ```javascript
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
 * Gets the file path and line number in the format `filePath:lineNumber` at which the first occurrence of `value` is found in the source file at `filePath`. This is useful for error reporting.
 *
 * @static
 * @memberOf dantil
 * @category File System
 * @param {string} filePath The path of the source file to search.
 * @param {*} value The value to search for.
 * @param {boolean} stringify Specify converting `value` to a string representation before searching.
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
 * ```javascript
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
 * @param {string} filePath The path of the source file to search.
 * @param {*} value The value to search for.
 * @param {boolean} stringify Specify converting `value` to a string representation before searching.
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
 * Synchronously resolves `path` to an absolute path. Similar to Node's `fs.realpathSync()`, but also expands '~' if found in `path` (using `dantil.expandHomeDir()`).
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
 * Formats plain `Object`s and `Array`s with multi-line string representations on separate lines. Concatenates and formats all other successive values on the same line.
 *
 * If the first argument is of a complex type (e.g., `Object`, `Array`), left-aligns all remaining lines. Otherwise, equally indents each line after the first line, if any. If the first argument has leading whitespace, prepends all remaining arguments with the same whitespace excluding line breaks.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} values The values and objects to print.
 */
exports.log = function () {
	process.stdout.write(prettify(arguments) + '\n')
}

/**
 * A version of `dantil.log()` that recurses indefinitely while formatting the object. This is useful for inspecting large, complicated objects.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} values The values and objects to print.
 */
exports.dir = function () {
	process.stdout.write(prettify(arguments, { depth: null }) + '\n')

	// Print trailing blank line
	exports.log()
}

/**
 * Formats the provided values and objects in color for pretty-printing, recursing `options.depth` times while formatting objects.
 *
 * Formats plain `Object`s and `Array`s with multi-line string representations on separate lines. Concatenates and formats all other successive values on the same line.
 *
 * If the first argument is of a complex type (e.g., `Object`, `Array`), left-aligns all remaining lines. Otherwise, equally indents each line after the first line, if any. If the first argument has leading whitespace, prepends all remaining arguments with the same whitespace excluding line breaks.
 *
 * @private
 * @param {Array} args The values and objects to format.
 * @param {Object} [options] The options object.
 * @param {number} [options.depth=2] The number of times to recurse while formating `args`. Pass `null` to recurse indefinitely.
 * @param {number} [options.stylizeStings=false] Specify stylizing strings in `args`. This does not apply to `Object` properties.
 * @returns {string} The formatted string.
 */
function prettify(args, options) {
	if (!options) options = {}

	var inspectOptions = {
		// Number of times to recurse while formatting; defaults to 2.
		depth: options.depth,
		// Format in color if the terminal supports color.
		colors: exports.colors.supportsColor,
	}

	// Use `RegExp()` to get correct `reMultiLined.source`.
	var reMultiLined = RegExp(',\n', 'g')
	var reWhitespaceOnly = /^\s+$/
	var indent = '  '

	return Array.prototype.slice.call(args).reduce(function (formattedArgs, arg, i, args) {
		// Do not stylize strings passed as arguments (i.e., not `Object` properties).
		// - This also preserves any already-stylized arguments.
		var argIsString = typeof arg === 'string'
		var formattedArg = !options.stylizeStings && argIsString ? arg : util.inspect(arg, inspectOptions)
		var lastFormattedArgIdx = formattedArgs.length - 1

		if (i === 0) {
			// Extend indent for successive lines with the first argument's leading whitespace, if any.
			if (argIsString) {
				// Get the substring of leading whitespace characters from the start of the string, up to the first non-whitespace character, if any.
				arg = arg.substring(0, arg.search(/[^\s]/))

				// Get the substring after the last line break before the first first non-whitespace character, if any.
				arg = arg.substring(arg.lastIndexOf('\n') + 1)

				// JavaScript will not properly indent if '\t' is appended to spaces (i.e., reverse order as here).
				indent = arg + indent
			} else if (arg instanceof Object) {
				// Do not indent successive lines if the first argument is of a complex type.
				indent = ''
			}

			formattedArgs.push(formattedArg)
		} else if (reWhitespaceOnly.test(formattedArgs[lastFormattedArgIdx])) {
			// Concatenate with the previous formatted argument if the previous formatted argument is only whitespace.
			formattedArgs[lastFormattedArgIdx] += ' ' + formattedArg.replace(reMultiLined, reMultiLined.source + indent)
		} else if (arg instanceof Object && (!Array.isArray(arg) || reMultiLined.test(formattedArg) || args[0] instanceof Object)) {
			// Format plain `Object`s,  `Array`s with multi-line string representations, and `Array`s when the first argument is of a complex type on separate lines.
			formattedArgs.push(indent + formattedArg.replace(reMultiLined, reMultiLined.source + indent))
		} else {
			// Concatenate all successive primitive data types.
			formattedArgs[lastFormattedArgIdx] += ' ' + formattedArg
		}

		return formattedArgs
	}, []).join('\n')
}

/**
 * Formats `object` in color for pretty-printing, recursing `options.depth` times while formatting. This is similar to Node's `util.inspect()`, but disables colors if the terminal does not support color.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {*} object The object or value to stylize.
 * @param {Object} [options] The options object.
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
 * Prints the provided values like `dantil.log()`, but prints to `stderr`, prepended with red-colored "Error: ".
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} values The values to print following "Error: ".
 * @example
 *
 * dantil.logError('Property undefined:', obj)
 * // => Prints "Error: Value undefined: { property: undefined }"
 */
exports.logError = function () {
	// printWithColoredLabel('Error', 'red', arguments)
	var args = prependColoredLabel('Error', 'red', arguments)
	process.stderr.write(prettify(args) + '\n')
}

/**
 * Prints the provided values to `stdout` like `dantil.log()` prepended with yellow-colored "Warning: ".
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} values The values to print following "Warning: ".
 * @example
 *
 * dantil.logWarning('Values unused:', obj)
 * // => Prints "Warning: Value unused: { property: undefined }"
 */
exports.logWarning = function () {
	var args = prependColoredLabel('Warning', 'yellow', arguments)
	exports.log.apply(null, args)
}

/**
 * Prints the provided values to `stdout` like `dantil.log()` prepended with green-colored "Success: ".
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {...*} values The values to print following "Success: ".
 * @example
 *
 * dantil.logSuccess(tests.length, 'tests passed')
 * // => Prints "Success: 47 tests passed"
 */
exports.logSuccess = function () {
	var args = prependColoredLabel('Success', 'green', arguments)
	exports.log.apply(null, args)
}

/**
 * Prepends `label` (e.g., "Error") colored `color` (e.g., "Error: ") to `args`.
 *
 * @private
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

	// Color `label` and append with `args`.
	return [ exports.colors[color](label) + ':' ].concat(Array.prototype.slice.call(args))
}

/**
 * Prints an error message like `dantil.logError()` followed by the file path and line number of the function call that invoked the currently executing module.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {boolean} [logThisLine] Specify logging the line where this function is called instead of the line which invoked the currently executing module.
 * @param {...*} [values] The optional values and objects to print following "Error: ".
 * @example
 *
 * // The contents of 'foo.js':
 *
 * dantil.logErrorAndPath('Property undefined:', obj)
 * // => Prints "Error: Value undefined: { property: undefined }
 * //              /Users/Danny/foo.js:1"
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
}

/**
 * Prints `object` preceded by the file path and line number of the function call that invoked the currently executing module.
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @param {Object} object The object to print.
 * @param {boolean} printLeadingNewline Specify printing a leading newline.
 * @param {boolean} logThisLine Specify logging the line where this function is called instead of the line which invoked the currently executing module.
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
 * // => Prints "/Users/Danny/foo.js:6
 * //              { values: [ 1, 2, 3 ], name: 'danny' }"
 */
exports.logPathAndObject = function (object, printLeadingNewline, logThisLine) {
	var pathAndLineNumber = printLeadingNewline ? '\n' : ''
	pathAndLineNumber += logThisLine ? exports.getPathAndLineNumber() : exports.getModuleCallerPathAndLineNumber()
	exports.log(pathAndLineNumber, object)
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
 * if (obscureCondition) {
 *   dantil.logTrace('Reached obscure condition')
 *   // => Prints: "Trace: Reached obscure condition
 *   //                at Object.<anonymous> /Users/Danny/test.js:4:9
 *   //                at Module._compile (module.js:460:26)
 *   //                ..."
 * }
 */
exports.logTrace = function (message) {
	exports.log('Trace' + (message ? ': ' + message : ''))

	// Remove parentheses surrounding file paths for iTerm's open-file-path shortcut.
	var origPrepareStackTrace = Error.prepareStackTrace
	exports.excludeParenthesesInStackTrace()

	// Get stack without lines for `Error` and this file.
	exports.log(Error().stack.split('\n').slice(3).join('\n'))

	// Restore original stack trace formatter after collecting stack trace.
	Error.prepareStackTrace = origPrepareStackTrace
}

/**
 * Modifies V8's default stack trace format (when printing) to not surround script file paths with parentheses. This is useful to enable iTerm's open-file-path shortcut (which the parentheses would otherwise break).
 *
 * Before:
 * ```
 * ReferenceError: dantil is not defined
 *    at Object.<anonymous> (/Users/Danny/foo.js:7:1)
 *    ...
 * ```
 * After:
 * ```
 * ReferenceError: dantil is not defined
 *    at Object.<anonymous> /Users/Danny/foo.js:7:1
 *    ...
 * ```
 *
 * @static
 * @memberOf dantil
 * @category Console
 * @example
 *
 * dantil.excludeParenthesesInStackTrace()
 * // => All subsequent printed stack traces will not surround paths with parentheses.
 */
exports.excludeParenthesesInStackTrace = function () {
	Error.prepareStackTrace = function (error, structuredStackTrace) {
		var stack = structuredStackTrace.map(function (frame) {
			var string = frame.toString()

			// Remove parentheses surrounding file paths in the formatted stack trace for non-native Node functions.
			if (/\//.test(frame.getFileName())) {
				string = string.replace(/[()]/g, '')
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
 * Prints the calling file path and line number, prepended by `message`, to mark reaching a section of code.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {string} [message] The optional message to prepend to the path and line number.
 * @example
 *
 * // The contents of 'foo.js':
 *
 * if (rareConditionIsTrue) {
 *   dantil.assert('Condition met')
 *   // => Prints "Condition met: /Users/Danny/foo.js:2"
 * }
 */
exports.assert = function (message) {
	exports.log(exports.colors.red(message || 'Reached') + ':', exports.getPathAndLineNumber(true))
}

/**
 * Tests if `value` is truthy. If so, prints the calling file path and line number, prepended by `message`.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {boolean} value The value to check if truthy.
 * @param {string} [message] The optional message to prepend to the path and line number.
 * @returns {boolean} Returns `true` if `value` is truthy, else `false`.
 * @example
 *
 * // The contents of 'foo.js':
 *
 * dantil.assertTrue(100 < Infinity, 'Condition met')
 * // => true
 * // => Prints "Condition met: /Users/Danny/foo.js:1"
 *
 * if (dantil.assertTrue(rareConditionIsTrue)) {
 *   // => true
 *   // => Prints "Reached: /Users/Danny/foo.js:5"
 * }
 */
exports.assertTrue = function (value, message) {
	if (value) {
		exports.assert(message)
		return true
	}

	return false
}

/**
 * Tests shallow, coercive equality with the equal comparison operator (`==`). Prints an error message and the file path and line number if the test fails, unlike Node's `assert.equal()` which throws an exception.
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
 * // => Prints "AssertionError: 20 == 21
 * //              /Users/Danny/foo.js:5"
 *
 * dantil.assertEqual({ prop: 'value' }, { prop: 'value' })
 * // => false
 * // => Prints "AssertionError: { prop: 'value' } == { prop: 'value' }
 * //              /Users/Danny/foo.js:9"
 *
 * dantil.assertEqual([ 3, 1, 4 ], [ 1, 5, 9 ], 'Array test failed')
 * // => false
 * // => Prints "AssertionError: Array test failed
 * //              /Users/Danny/foo.js:14"
 *
 * if (dantil.assertEqual(myArray.length, 100)) {
 *   // => true
 *
 *   // ...stuff...
 * }
 */
exports.assertEqual = function (value, other, message) {
	if (value != other) {
		var label = exports.colors.red('AssertionError') + ':'

		if (message) {
			exports.log(label, message)
		} else {
			exports.log(label, exports.stylize(value), '==', exports.stylize(other))
		}

		exports.log('  ' + exports.getPathAndLineNumber())

		return false
	}

	return true
}

 /**
	* Used as a key-value map for `dantil.time()`.
	*
	* @private
	* @type Map
	*/
var _times = new Map()

/**
 * Starts a high-resolution timer (with precision in microseconds) identified by `label`. Use `dantil.timeEnd(label)` to print the timer's current value.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {string} label The identifier of the timer.
 * @example
 *
 * // Start timer
 * dantil.time('my test')
 *
 * // ...stuff...
 *
 * dantil.timeEnd('my test')
 * // => Prints "my test: 13.264ms"
 *
 * // ...more stuff...
 *
 * dantil.timeEnd('my test')
 * // => Prints "my test: 31.183ms"
 */
exports.time = function (label) {
	_times.set(label, process.hrtime())
}

/**
 * Prints the current high-resolution value of a timer initiated with `dantil.time(label)`.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {string} label The identifier of the timer.
 */
exports.timeEnd = function (label) {
	var startTime = _times.get(label)

	if (!startTime) {
		throw new Error('No such label: ' + label)
	}

	var durationTuple = process.hrtime(startTime)
	var duration = durationTuple[0] * 1e3 + durationTuple[1] / 1e6

	exports.log(label + ':', duration.toFixed(3) + 'ms')
}

/**
 * Used as a key-value map for `dantil.count()`.
 *
 * @private
 * @type Map
 */
var _counts = new Map()

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
 * // => Prints "even: 50"
 * // => Resets the count for 'even' to 0
 */
exports.count = function (label) {
	var val = _counts.get(label) || 0
	_counts.set(label, val + 1)
}

/**
 * Prints (and resets the value of) the number of calls of `dantil.count(label)`.
 *
 * @static
 * @memberOf dantil
 * @category Profiling
 * @param {string} label The counter identifier.
 */
exports.countEnd = function (label) {
	// Print even if count is 0 to acknowledge never being reached.
	var count = _counts.get(label) || 0

	exports.log(label + ':', count)

	// Reset count.
	_counts.delete(label)
}

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
exports.countEndAll = function () {
	_counts.forEach(function(count, label) {
		exports.log(label + ':', count)
	})

	// Reset all counts.
	_counts.clear()
}

/**
 * Performs a shallow comparison between two arrays to determine if they are equivalent.
 *
 * @static
 * @memberOf dantil
 * @category Array
 * @param {Array} a The array to compare.
 * @param {Array} b The other array to compare.
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
 * // A shallow comparison will not compare object properties
 * var objA = { prop: 'val' }
 * var objB = { prop: 'val' }
 * dantil.arraysEqual([ 1, 2, objA ], [ 1, 2, objB ])
 * // => false
 *
 * // Rather, objects are only equal if they are the same instance
 * dantil.arraysEqual([ objA, objB ], [ objA, objB ])
 * // => true
 */
exports.arraysEqual = function (a, b) {
	// Arrays are identical (or, both are `undefined`).
	if (a === b) return true

	// One of two is `undefined`.
	if (!a || !b) return false

	var aLength = a.length

	// Lengths are different.
	if (aLength !== b.length) return false

	for (var i = 0; i < aLength; ++i) {
		if (a[i] !== b[i]) return false
	}

	return true
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
 * number = dantil.cleanNumber(number)
 * // => 0.02
 */
exports.cleanNumber = function (number) {
	// JavaScript has floating point number precision of 13 digits after the decimal point.
	return Number(number.toFixed(13))
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