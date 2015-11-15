/**
 * @license
 * readline-async 0.0.1 - An asynchronous readline interface for Node.js.
 * Copyright 2015 Danny Nemer
 * Available under MIT license <http://opensource.org/licenses/MIT>
 */

var readline = require('readline')
var childProcess = require('child_process')
var util = require('../util/util')

// Instantiate a readline `Interface`.
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	completer: function (line) {
		// Find all command names that can follow input.
		var matches = rl.commandNames.filter(function (commandName) {
			return commandName.indexOf(line) === 0
		})

		// Show nothing if no completions found.
		return [ matches, line ]
	},
})

// Used by 'line' event listener to execute commands when invoked via input.
rl.commands = {}

// Used by `rl.completer` for `<tab>` autocompletion of the names of `rl.commands`.
rl.commandNames = []

// Used to map command names to strings of the command name and associated argument names, if any, for display in the usage screen.
rl.commandDisplayNames = {}

// Used for display in the usage screen.
rl.commandDescriptions = {}

// The usage screen used by `rl._printUsage()`.
this.usage = ''

// Used by 'SIGINT' event listener to prompt the user to confirm before closing the RLI instance.
rl.sawSIGINT = false

/**
 * Spawns a new process within the readline `Interface` (RLI) to asynchronously run `command` with `args`.
 *
 * Executes `command` as an asynchronous child process, leaving the event loop unblocked, but with the appearance of running synchronously. I.e., the user cannot enter input (e.g., commands) during the process, but can terminate the process with `^C` and return to the RLI. In contrast, Node's default RLI blocks the event loop, requiring processes to complete before accepting any input; i.e., the user must externally kill the entire RLI process.
 *
 * Temporarily disables the RLI's `stdio` (input and output) while the child is processing, except for `^C` (`SIGINT`) to terminate the child. Restores the RLI `stdio` when the child exits or terminates.
 *
 * @static
 * @memberOf rl
 * @param {string} command The command to run as a child process.
 * @param {string[]} args The command line arguments for `command`.
 * @param {string|Array} [stdio=[ 'ignore', process.stdout, process.stderr ]] The optional child process's `stdio` configuration.
 * @param {Function} [callback] The optional function to execute after the child process exits and before returning control to the RLI.
 * @returns {ChildProcess} Returns the spawned `ChildProcess`.
 * @example
 *
 * rl.addCommands({
 *   name: 'test',
 *   description: 'Run \'myTest.js\' as terminable asynchronous child process.',
 *   func: function () {
 *     rl.spawnAsyncProcess('node', [ './myTest.js' ])
 *   }
 * })
 * ```
 * ```
 * ❯ .test
 * ...executing stuff in 'myTest.js'...
 * ...
 * → user sends `^C` from command line
 * Error: Child process terminated due to receipt of signal SIGINT
 * ❯
 */
rl.spawnAsyncProcess = function (command, args, stdio, callback) {
	// Check arity.
	if (typeof stdio === 'function') {
		callback = stdio
		stdio = null
	}

	// Prevent printing prompt when executing child process, but continue processing input such as `^C` for `SIGINT` (which `rl.pause()` would prevent).
	this.paused = true

	// Launches a new process with `command` and the command line arguments in `args`. This child process avoids blocking the event loop. Unless `stdio` is provided as an argument, the child process ignores input and inherits `stdout` and `stderr`.
	var child = childProcess.spawn(command, args, {
		stdio: stdio || [ 'ignore', process.stdout, process.stderr ]
	})

	// Disable output from RLI while child is processing.
	var origStdoutWrite = this.output.write
	this.output.write = function () {}

	// Temporarily remove RLI `line` event listener(s) (when the user hits `enter`).
	var lineListeners = this.listeners('line')
	this.removeAllListeners('line')

	// Send `SIGINT` to child process when received by the RLI.
	function killChild() {
		child.kill('SIGINT')
	}

	// Temporarily replace existing RLI `SIGINT` event listener(s).
	var SIGINTListeners = this.listeners('SIGINT')
	this.removeAllListeners('SIGINT')
	this.on('SIGINT', killChild)

	child.on('error', function (err) {
		util.log()
		util.logError('Failed to start child process:', err.code)
	})

	var self = this

	// The 'exit' event is emitted when the child process ends.
	child.on('exit', function (code, signal) {
		// Restore `stdout`.
		self.output.write = origStdoutWrite

		// Restore `SIGINT` event listeners(s).
		self.removeListener('SIGINT', killChild)
		SIGINTListeners.forEach(function (listener) {
			self.on('SIGINT', listener)
		})

		if (signal) {
			// `child` was killed (most often is due to `SIGINT` sent by the RLI).
			util.log()
			util.logError('Child process terminated due to receipt of signal', signal)
		} else if (code !== 0) {
			// `child` exited with a 'failure' code (most often after an exception is thrown).
			util.log()
			util.logError('Child process exited with code', code)
		} else if (callback) {
			// `child` exited normally. Execute `callback` before returning control to the RLI.
			callback()
		}

		// Restore `line` event listener(s).
		lineListeners.forEach(function (listener) {
			self.on('line', listener)
		})

		// Resume RLI.
		self.prompt()
	})

	return child
}

/**
 * Registers `commands` for the RLI to parse and execute. Automatically implements `<tab>` autocompletion for the command names.
 *
 * Commands are executed in the RLI with a leading period followed by the command name: `.command`. Commands are passed all arguments that follow the command name.
 *
 * @static
 * @memberOf rl
 * @param {...Object} [commands] The commands the RLI will parse and execute.
 * @param {string} command.name The name that invokes `command.func` when input to RLI in the form `.name`.
 * @param {string[]} [command.argNames] The optional argument names displayed in the RLI usage screen.
 * @param {string} command.description The description displayed in the RLI usage screen.
 * @param {Function} command.func The function the RLI will execute.
 * @example
 *
 * rl.addCommands({
 *   name: 'echo',
 *   argNames: [ '<string>' ],
 *   description: 'Write <string> to the standard output.',
 *   func: function (string) {
 *     console.log(string || '')
 *   }
 * }, {
 *   name: 'exit',
 *   description: 'Terminate RLI.',
 *   func: function () {
 *     rl.close()
 *   }
 * })
 * ```
 * RLI ran from command line (with autocompletion and auto-implemented built-in commands):
 * ```
 * ❯ <tab>
 * .echo     .exit     .history  .help
 * ❯ . → .ec<tab> → .echo → .echo hello
 * hello
 * ❯ .foo
 * Commands
 *   .echo <string>  Write <string> to the standard output.
 *   .exit           Terminate RLI.
 *   .history        Print the RLI history.
 *   .help           Print this screen.
 *
 * Unrecognized command: .foo
 */
rl.addCommands = (function () {
	var commandSchema = {
		// The name that, when prepended with a period in the form `.name`, executes `command.func`.
		name: { type: String, required: true },
		// The optional argument names displayed in the RLI usage screen.
		argNames: { type: Array, arrayType: String },
		// The description displayed in the RLI usage screen.
		description: { type: String, required: true },
		// The function the RLI will execute.
		func: { type: Function, required: true },
	}

	return function () {
		for (var a = 0, argumentsLen = arguments.length; a < argumentsLen; ++a) {
			var command = arguments[a]

			if (util.illFormedOpts(commandSchema, command)) {
				throw new Error('Ill-formed command')
			}

			var commandName = '.' + command.name

			if (this.commands.hasOwnProperty(commandName)) {
				throw new Error('Command already exists: \'' + command.name + '\'')
			}

			// Save command name for `rl.completer` `<tab>` autocompletion.
			// Add command after built-in commands to ensure the built-in commands are last in the usage screen and `rl.completer` suggestions.
			this.commandNames.splice(-this.builtInCommandCount, 0, commandName)

			// Generate a string of the command name and associated argument names, if any, for display in the usage screen.
			var commandDisplayNames = command.argNames ? [ commandName ].concat(command.argNames).join(' ') : commandName
			this.commandDisplayNames[commandName] = commandDisplayNames

			// Determine greatest command name length for text alignment in the usage screen.
			if (commandDisplayNames.length > this.greatestCommandDisplayNameLength) {
				this.greatestCommandDisplayNameLength = commandDisplayNames.length
			}

			// Save command description for display in the usage screen.
			this.commandDescriptions[commandName] = command.description

			// Save command function.
			this.commands[commandName] = command.func
		}

		// Update usage screen with new command(s) (and proper alignment).
		this._generateUsage()
	}
}())

/**
 * Generates and saves the usage screen, used by `rl_printUsage(), containing the RLI instance's commands and their descriptions.
 *
 * @private
 * @memberOf rl
 */
rl._generateUsage = function () {
	// Determine greatest command name length for text alignment in the usage screen.
	var greatestCommandDisplayNameLength = 0
	for (var commandName in this.commandDisplayNames) {
		var commandDisplayName = this.commandDisplayNames[commandName]

		if (commandDisplayName.length > greatestCommandDisplayNameLength) {
			greatestCommandDisplayNameLength = commandDisplayName.length
		}
	}

	var usage = [ util.colors.bold('Commands') ]

	// Use `commandNames` to ensure built-in commands are last.
	for (var c = 0, commandsLen = this.commandNames.length; c < commandsLen; ++c) {
		var commandName = this.commandNames[c]
		var commandDisplayName = this.commandDisplayNames[commandName]

		// Align command descriptions.
		var padding = Array(greatestCommandDisplayNameLength - commandDisplayName.length + 1).join(' ') + '  '

		usage.push('  ' + commandDisplayName + padding + this.commandDescriptions[commandName])
	}

	// Print trailing newline.
	usage.push('')

	// Save the usage screen.
	this.usage = usage.join('\n')
}

/**
 * Prints the usage screen containing the RLI instance's commands and their descriptions.
 *
 * @private
 * @memberOf rl
 */
rl._printUsage = function () {
	util.log(this.usage)
}

// Include `.history` command in RLI instance by default. Do not use `rl.addCommands()` here to ensure the built-in commands are the last commands in the usage screen and `rl.completer` suggestions.
var historyCommandName = '.history'
rl.commandNames.push(historyCommandName)
rl.commandDisplayNames[historyCommandName] = historyCommandName
rl.commandDescriptions[historyCommandName] = 'Print the RLI history.'
rl.commands[historyCommandName] = function () {
	var historyLen = rl.history.length
	for (var h = historyLen - 1; h > 0; --h) {
		var idx = historyLen - h
		util.log((historyLen > 10 && idx < 10 ? ' ' : '') + idx + '  ' + rl.history[h])
	}
}

// Include `.help` command in RLI instance by default.
var helpCommandName = '.help'
rl.commandNames.push(helpCommandName)
rl.commandDisplayNames[helpCommandName] = helpCommandName
rl.commandDescriptions[helpCommandName] = 'Print this screen.'
rl.commands[helpCommandName] = rl._printUsage.bind(rl)

// The number of built-in commands.
rl.builtInCommandCount = rl.commandNames.length

rl._generateUsage()

/**
 * Assigns an event handler to invoke when the user hits `return` or `enter` and the input is not a registered command (set by `rl.addCommands()`).
 *
 * @static
 * @memberOf rl
 * @param {Function} func The event handler invoked per RLI input that is not a registered command. Passed the input line as the only argument.
 * @example
 *
 * // Listen for when the user hits `return` and the input is not a registered command.
 * rl.onLine(function (line) {
 *   console.log('Thank you for your input:', line)
 * })
 */
rl.onLine = function (func) {
	rl.lineEvent = func
}

/**
 * Listens for `\n` in the input stream, usually received when the user hits `return`; parses and executes commands registered with `rl.addCommands()`; invokes the line listener set by `rl.onLine()` when the input is not a command; resets `rl.sawSIGINT`; and displays the prompt if there is no running child process.
 */
rl.on('line', function (line) {
	// Reset `SIGINT` confirmation.
	this.sawSIGINT = false

	line = line.trim()
	if (line) {
		if (line[0] === '.') {
			var args = line.split(' ')
			var commandName = args[0]

			// Execute command if found, else display usage screen.
			var commandFunc = this.commands[commandName]

			if (commandFunc) {
				// Invoke function with all arguments that follow the command name.
				commandFunc.apply(null, args.splice(1))
			} else {
				// Print usage screen and error for unrecognized command.
				this._printUsage()
				util.log(util.colors.red('Unrecognized command') + ':', commandName)
			}
		} else if (rl.lineEvent) {
			// Send input to line listener, if defined.
			rl.lineEvent(line)
		}
	}

	// Do not display prompt when a child is process.
	if (!this.paused) {
		this.prompt()
	}
})

/**
 * Adds a new input line to the RLI's history list. Overrides the default `Interface.prototype._addHistory` to automatically remove older history lines that duplicate new ones.
 *
 * @private
 * @returns {string} Returns the newly added input line.
 */
rl._addHistory = function () {
	if (this.line.length === 0) return ''

	if (this.history.length === 0 || this.history[0] !== this.line) {
		// Remove previous history index if duplicate.
		const existingIndex = this.history.indexOf(this.line)
		if (existingIndex !== -1) this.history.splice(existingIndex, 1)

		this.history.unshift(this.line)

		// Only store so many.
		if (this.history.length > this.historySize) this.history.pop()
	}

	this.historyIndex = -1
	return this.history[0]
}

/**
 * Listens for `^C` (`SIGINT`) in the input stream and prompts the user to confirm before closing the RLI instance.
 */
rl.on('SIGINT', function () {
	if (this.line.length > 0) {
		// Clear line and reset `sawSIGINT`.
		this.clearLine()
		this.sawSIGINT = false
	} else if (this.sawSIGINT) {
		// Exit RLI.
		this.close()
		return
	} else {
		// Confirm before exiting.
		this.output.write('\n(^C again to quit)\n')
		this.sawSIGINT = true
	}

	this.prompt()
})

// Set a better prompt character.
rl.setPrompt('❯ ')

// Ready RLI for input and display the prompt character.
rl.prompt()

// Export readline `Interface` instance.
module.exports = rl