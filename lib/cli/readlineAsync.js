/**
 * Instantiates a readline `Interface` (RLI) with the following additional features:
 *
 * - `rl.spawnAsyncProcess()` - Spawns a new process within the RLI to asynchronously run a given command. Leaves the event loop unblocked but with the appearance of running synchronously. I.e., the user cannot enter input (e.g., commands) during the process, but can terminate the process with `^C` and return to the RLI. In contrast, Node's default RLI blocks the event loop, requiring the user to externally kill the entire RLI process.
 *
 * - `rl.setCommands()` - Assigns commands for the RLI to parse and execute. Automatically implements `tab` autocompletion for the command names.
 *
 * - Automatically removes older history lines that duplicate new ones.
 *
 * - Listens for `^C` (`SIGINT`) in the input stream to confirm exiting the RLI.
 */

var readline = require('readline')
var childProcess = require('child_process')
var util = require('../util')

// Instantiates a readline `Interface`.
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})

/**
 * Spawns a new process within the readline `Interface` (RLI) to asynchronously run `command` with `args`.
 *
 * Executes `command` as an asynchronous child process, leaving the event loop unblocked, but with the appearance of running synchronously. I.e., the user cannot enter input (e.g., commands) during the process, but can terminate the process with `^C` and return to the RLI. In contrast, Node's default RLI blocks the event loop, requiring processes to complete before accepting any input (including `^C`). (Hence, the user must externally kill the entire RLI process.)
 *
 * Disables the RLI's `stdio` (input and output) while the child is processing, except for `^C` (`SIGINT`) to terminate the child. Restores the RLI `stdio` when the child exits or terminates.
 *
 * @param {string} command The command to run as a child process.
 * @param {string[]} args The command line arguments for `command`.
 * @param {string|Array} [stdio=[ 'ignore', process.stdout, process.stderr ]] The optional child process's `stdio` configuration.
 * @param {Function} [callback] The optional function to execute after the child process exits and before returning control to the RLI.
 * @example
 *
 * rl.setCommands({
 *   // Benchmark the duration of executing the test suite [<n> times].
 *   benchmark: function (numRuns) {
 *     rl.spawnAsyncProcess('node', [
 *       '../benchmark/benchmark.js',
 *       '--num-runs=' + (isNaN(numRuns) ? 1 : numRuns),
 *     ])
 *   }
 * })
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
		util.logError('Failed to start child process:', err.code)
	})

	var self = this
	child.on('close', function (code, signal) {
		// Restore `stdout`.
		self.output.write = origStdoutWrite

		// Restore `SIGINT` event listeners(s).
		self.removeListener('SIGINT', killChild)
		SIGINTListeners.forEach(function (listener) {
			self.on('SIGINT', listener)
		})

		if (signal) {
			// `child` was killed (most often is due to `SIGINT` sent by the RLI).
			util.logError('Child process terminated due to receipt of signal', signal)
		} else if (code !== 0) {
			// `child` exited with a 'failure' code (most often after an exception is thrown).
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
}

/**
 * Assigns `commands` for the RLI to parse and execute. Automatically implements `tab` autocompletion for the command names.
 *
 * Commands are executed in the RLI with a leading period followed by the command name: `.command`. Commands are passed all arguments that follow the command name.
 *
 * @param {Object} commands The functions the RLI will parse and execute.
 * @example
 *
 * rl.setCommands({
 *   echo: function (string) {
 *     console.log(string)
 *   }
 * })
 * ```
 * ```
 * > <tab>
 * => .echo
 * > .ec<tab> -> .echo -> .echo hello
 * => hello
 */
rl.setCommands = function (commands) {
	this.commands = commands

	// Command names used by `completer`.
	this.commandNames = Object.keys(commands).map(function (commandName) {
		return '.' + commandName
	})

	// `tab` autocompleter.
	var self = this
	var completer = function (line) {
		// Find all command names that can follow input.
		var matches = self.commandNames.filter(function (commandName) {
			return commandName.indexOf(line) === 0
		})

		// Show nothing if no completions found.
		return [ matches, line ]
	}

	// Run `completer` synchronously.
	this.completer = function (v, cb) {
		cb(null, completer(v))
	}
}

// Automatically remove older history lines that duplicate new ones.
rl.historyNoDups = true
rl._addHistory = function () {
	if (this.line.length === 0) return ''

	if (this.history.length === 0 || this.history[0] !== this.line) {
		if (this.historyNoDups) {
			// Remove previous history index if duplicate.
			const existingIndex = this.history.indexOf(this.line)
			if (existingIndex !== -1) this.history.splice(existingIndex, 1)
		}

		this.history.unshift(this.line)

		// Only store so many.
		if (this.history.length > this.historySize) this.history.pop()
	}

	this.historyIndex = -1
	return this.history[0]
}

// Listen for `^C` (`SIGINT`) in the input stream to confirm exiting the RLI.
rl.sawSIGINT = false
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

// Use a better prompt character.
rl.setPrompt('❯ ')

// Export readline `Interface` instance.
module.exports = rl