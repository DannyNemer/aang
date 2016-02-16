/**
 * Usage
 *   node cli [options]
 *
 * Description
 *   The command line interface for aang.
 *
 *   Contains the following built-in programs:
 *    • parse - Parses the provided query and outputs the k-best parse trees.
 *
 *    • test - Parses the suite of test queries and checks output conforms to the
 *    test's specifications.
 *
 *    • benchmark - Benchmarks the duration of parsing the queries in the test
 *    suite.
 *
 *    • buildGrammar - Generates and outputs the grammar containing the grammar
 *    rules, semantics, entities, and deletables.
 *
 *    • ambiguityCheck - Finds and prints instances of ambiguity in the grammar.
 *
 *    • printStateTable - Prints the state table generated from the grammar.
 *
 *    • archive* - Saves output of program *. Includes: archiveTest,
 *    archiveTestQuiet, archiveGrammar, archiveAmbigCheck, archiveStateTable,
 *    archiveAll.
 *
 *    • diff* - Compares last archived output of program * to current output of the
 *    same program. Includes: diffTest, diffTestQuiet, diffGrammar, diffAmbigCheck,
 *    diffStateTable, diffAll.
 *
 *   Enables configuration of CLI environment variables which are passed as options
 *   when executing the above programs.
 *
 *   Each program is spawn as a child process. This automatically enables any
 *   changes to modules outside the CLI, allows the user to kill any process (with
 *   `^C`) without exiting the CLI, and improves benchmark result consistency by
 *   mitigating the impact of process caches.
 *
 * Options
 *   -h, --help  Display this screen.                                     [boolean]
 */

var util = require('../util/util')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]',
		'',
		util.colors.bold('Description'),
		'  The command line interface for aang.',
		'',
		'  Contains the following built-in programs:',
		'   • parse - Parses the provided query and outputs the k-best parse trees.',
		'',
		'   • test - Parses the suite of test queries and checks output conforms to the test\'s specifications.',
		'',
		'   • benchmark - Benchmarks the duration of parsing the queries in the test suite.',
		'',
		'   • buildGrammar - Generates and outputs the grammar containing the grammar rules, semantics, entities, and deletables.',
		'',
		'   • ambiguityCheck - Finds and prints instances of ambiguity in the grammar.',
		'',
		'   • printStateTable - Prints the state table generated from the grammar.',
		'',
		'   • archive* - Saves output of program *. Includes: archiveTest, archiveTestQuiet, archiveGrammar, archiveAmbigCheck, archiveStateTable, archiveAll.',
		'',
		'   • diff* - Compares last archived output of program * to current output of the same program. Includes: diffTest, diffTestQuiet, diffGrammar, diffAmbigCheck, diffStateTable, diffAll.',
		'',
		'  Enables configuration of CLI environment variables which are passed as options when executing the above programs.',
		'',
		'  Each program is spawn as a child process. This automatically enables any changes to modules outside the CLI, allows the user to kill any process (with `^C`) without exiting the CLI, and improves benchmark result consistency by mitigating the impact of process caches.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var childProcess = require('child_process')
var fs = require('fs')
var path = require('path')

// Instantiates a readline `Interface`.
var rl = require('./readlineAsync')

// Parse settings.
var parseOpts = {
	k: 7,
	quiet: false,
	benchmark: false,
	costs: false,
	ambiguity: false,
	trees: false,
	treeNodeCosts: false,
	treeTokenRanges: false,
	semantics: true,
	objectSemantics: false,
	parseStack: false,
	forest: false,
	forestGraph: false,
}

// Send input not recognized as a command to `parse`.
rl.onLine(function (query) {
	this.spawnAsyncProcess('node', [
		'../parse/parse.js',
		query,
		'--k=' + parseOpts.k,
		'--quiet=' + parseOpts.quiet,
		'--benchmark=' + parseOpts.benchmark,
		'--costs=' + parseOpts.costs,
		'--ambiguity=' + parseOpts.ambiguity,
		'--trees=' + parseOpts.trees,
		'--tree-node-costs=' + parseOpts.treeNodeCosts,
		'--tree-token-ranges=' + parseOpts.treeTokenRanges,
		'--semantics=' + parseOpts.semantics,
		'--object-semantics=' + parseOpts.objectSemantics,
		'--parse-stack=' + parseOpts.parseStack,
		'--parse-forest=' + parseOpts.forest,
		'--parse-forest-graph=' + parseOpts.forestGraph,
	])
})

// Output file paths.
var paths = (function () {
	var outDir = '../../out/'

	return {
		outDir: outDir,
		test: '../test/test.js',
		testOut: outDir + 'test',
		testQuietOut: outDir + 'test_quiet',
		buildGrammar: '../grammar/buildGrammar.js',
		grammar: '../grammar.json',
		grammarOld: outDir + 'grammar_old.json',
		ambigCheck: '../ambig/ambiguityCheck.js',
		ambigCheckOut: outDir + 'ambig',
		printStateTable: '../parse/printStateTable.js',
		stateTableOut: outDir + 'st',
	}
}())

// Color RLI prompt character green if there are unarchived grammar changes.
updateRLIPrompt(rl)

// Assign commands to the RLI, executed via `.command`.
// All arguments after `.command` are passed to the corresponding functions and programs as options.
rl.addCommands({
	name: 'test',
	description: 'Parse the suite of test queries.',
	func: function test() {
		// Pass all arguments to the command line program.
		rl.spawnAsyncProcess('node', [ paths.test, ...arguments ])
	},
}, {
	name: 'copyTest',
	description: 'Copy test output to the pasteboard.',
	func: function copyTest() {
		// Pass all arguments to the command line program.
		copyOutput([ paths.test, ...arguments ])
	},
}, {
	name: 'archiveTest',
	argNames: [ '[<filename>]' ],
	description: 'Archive test output to \'out\' directory [with <filename>].',
	func: function archiveTest(filename, callback) {
		// Check arity.
		if (typeof filename === 'function') {
			callback = filename
			filename = undefined
		} else if (typeof callback !== 'function') {
			callback = undefined
		}

		var outputPath = util.expandHomeDir(filename ? paths.outDir + filename : paths.testOut)
		archiveOuput([ paths.test ], outputPath, callback)
	},
}, {
	name: 'diffTest',
	description: 'Compare last archived test output to current test output.',
	func: function diffTest() {
		diffOutput([ paths.test ], paths.testOut)
	},
}, {
	name: 'archiveTestQuiet',
	argNames: [ '[<filename>]' ],
	description: 'Archive test-quiet output to \'out\' directory [with <filename>].',
	func: function archiveTestQuiet(filename, callback) {
		// Check arity.
		if (typeof filename === 'function') {
			callback = filename
			filename = undefined
		} else if (typeof callback !== 'function') {
			callback = undefined
		}

		var outputPath = util.expandHomeDir(filename ? paths.outDir + filename : paths.testQuietOut)
		archiveOuput([ paths.test, '--quiet', '-k=1' ], outputPath, callback)
	},
}, {
	name: 'diffTestQuiet',
	description: 'Compare last archived test-quiet output to current test-quiet output.',
	func: function diffTestQuiet() {
		diffOutput([ paths.test, '--quiet', '-k=1' ], paths.testQuietOut)
	},
}, {
	name: 'benchmark',
	description: 'Benchmark the duration of parsing the test suite.',
	func: function benchmark() {
		// Pass all arguments to the command line program.
		rl.spawnAsyncProcess('node', [ '../benchmark/benchmark.js', ...arguments ])
	},
}, {
	name: 'buildGrammar',
	description: 'Rebuild the grammar.',
	func: function buildGrammar(callback) {
		rl.spawnAsyncProcess('node', [
			paths.buildGrammar,
			'--output=' + paths.grammar,
			// Pass all arguments to the command line program.
			...arguments,
		], function () {
			// Color RLI prompt character green if there are unarchived grammar changes.
			updateRLIPrompt(rl)

			// Check arity.
			if (typeof callback === 'function') callback()
		})
	},
}, {
	name: 'archiveGrammar',
	argNames: [ '[<filename>]' ],
	description: 'Rebuild and archive grammar to \'out\' directory [with <filename>].',
	func: function archiveGrammar(filename, callback) {
		// Check arity.
		if (typeof filename === 'function') {
			callback = filename
			filename = undefined
		} else if (typeof callback !== 'function') {
			callback = undefined
		}

		rl.spawnAsyncProcess('node', [
			paths.buildGrammar,
			'--output=' + (filename ? paths.outDir + filename : paths.grammarOld),
			'--quiet',
		], function () {
			// Color RLI prompt character green if the archived grammar does not match the last grammar `.buildGrammar` generated.
			updateRLIPrompt(rl)

			if (callback) callback()
		})
	},
}, {
	name: 'diffGrammar',
	description: 'Compare last archived grammar to current grammar.',
	func: function diffGrammar() {
		// Invoke `vimdiff` to compare the last archived grammar to the current grammar.
		diffFiles(paths.grammarOld, paths.grammar)
	},
}, {
	name: 'ambigCheck',
	description: 'Check for ambiguity in the grammar.',
	func: function ambigCheck() {
		// Pass all arguments to the command line program.
		rl.spawnAsyncProcess('node', [ paths.ambigCheck, ...arguments ])
	},
}, {
	name: 'archiveAmbigCheck',
	argNames: [ '[<filename>]' ],
	description: 'Archive output of the ambiguity check to \'out\' directory [with <filename>].',
	func: function archiveAmbigCheck(filename, callback) {
		// Check arity.
		if (typeof filename === 'function') {
			callback = filename
			filename = undefined
		} else if (typeof callback !== 'function') {
			callback = undefined
		}

		var outputPath = util.expandHomeDir(filename ? paths.outDir + filename : paths.ambigCheckOut)
		archiveOuput([ paths.ambigCheck ], outputPath, callback)
	},
}, {
	name: 'diffAmbigCheck',
	description: 'Compare last archived ambiguity check output to current ambiguity check output.',
	func: function diffAmbigCheck() {
		diffOutput([ paths.ambigCheck ], paths.ambigCheckOut)
	},
}, {
	name: 'stateTable',
	description: 'Print the state table.',
	func: function stateTable() {
		// Pass all arguments to the command line program.
		rl.spawnAsyncProcess('node', [ paths.printStateTable, paths.grammar, ...arguments ])
	},
}, {
	name: 'archiveStateTable',
	argNames: [ '[<filename>]' ],
	description: 'Archive state table equational representation to \'out\' directory [with <filename>].',
	func: function archiveStateTable(filename, callback) {
		// Check arity.
		if (typeof filename === 'function') {
			callback = filename
			filename = undefined
		} else if (typeof callback !== 'function') {
			callback = undefined
		}

		var outputPath = util.expandHomeDir(filename ? paths.outDir + filename : paths.stateTableOut)
		archiveOuput([ paths.printStateTable, paths.grammar ], outputPath, callback)
	},
}, {
	name: 'diffStateTable',
	description: 'Compare last archived state table to current state table.',
	func: function diffStateTable() {
		diffOutput([ paths.printStateTable, paths.grammar ], paths.stateTableOut)
	},
}, {
	name: 'archiveAll',
	description: 'Invokes all \'.archive*\' commands.',
	func: function archiveAll() {
		// Do not bother rewriting as asynchronous because the change barely shortens processing time, such that the user backgrounds the process either way.
		rl.commands['.archiveGrammar'](function () {
			util.log()
			rl.commands['.buildGrammar'](function () {
				util.log()
				rl.commands['.archiveTest'](function () {
					util.log()
					rl.commands['.archiveTestQuiet'](function () {
						util.log()
						rl.commands['.archiveStateTable']()
					})
				})
			}, '--quiet')
		})
	},
}, {
	name: 'k',
	argNames: [ '<n>' ],
	description: 'Set the maximum number of parse trees to find to <n>.',
	func: function k(k) {
		if (!isNaN(k)) parseOpts.k = Number(k)
		util.log('k:', parseOpts.k)
	},
}, {
	name: 'quiet',
	description: 'Toggle suppressing parse results from output',
	func: function quiet() {
		util.log('Suppress parse results:', parseOpts.quiet = !parseOpts.quiet)
	},
}, {
	name: 'time',
	description: 'Toggle benchmarking duration of parse and parse forest search.',
	func: function time() {
		util.log('Print parse time:', parseOpts.benchmark = !parseOpts.benchmark)
	},
}, {
	name: 'costs',
	description: 'Toggle printing parse costs.',
	func: function costs() {
		util.log('Print parse costs:', parseOpts.costs = !parseOpts.costs)
	},
}, {
	name: 'ambiguity',
	description: 'Toggle printing instances of semantic ambiguity.',
	func: function ambiguity() {
		util.log('Print ambiguity:', parseOpts.ambiguity = !parseOpts.ambiguity)
	},
}, {
	name: 'trees',
	description: 'Toggle printing parse trees.',
	func: function trees() {
		util.log('Print parse trees:', parseOpts.trees = !parseOpts.trees)
	},
}, {
	name: 'nodeCosts',
	description: 'Toggle including in parse trees each node\'s path cost.',
	func: function nodeCosts() {
		util.log('Include in parse trees each node\'s path cost:', parseOpts.treeNodeCosts = !parseOpts.treeNodeCosts)
	},
}, {
	name: 'tokenRanges',
	description: 'Toggle including in parse trees each node\'s token range.',
	func: function tokenRanges() {
		util.log('Include in parse trees each node\'s token range:', parseOpts.treeTokenRanges = !parseOpts.treeTokenRanges)
	},
}, {
	name: 'semantics',
	description: 'Toggle printing semantics.',
	func: function semantics() {
		util.log('Print semantics:', parseOpts.semantics = !parseOpts.semantics)
	},
}, {
	name: 'objectSemantics',
	description: 'Toggle printing object representations of semantics.',
	func: function objectSemantics() {
		util.log('Print object representations of semantics:', parseOpts.objectSemantics = !parseOpts.objectSemantics)
	},
}, {
	name: 'stack',
	description: 'Toggle printing the parse stack.',
	func: function stack() {
		util.log('Print parse stack:', parseOpts.parseStack = !parseOpts.parseStack)
	},
}, {
	name: 'forest',
	description: 'Toggle printing an equational representation of the parse forest.',
	func: function forest() {
		util.log('Print parse forest:', parseOpts.forest = !parseOpts.forest)
	},
}, {
	name: 'graph',
	description: 'Toggle printing a graph representation of the parse forest.',
	func: function graph() {
		util.log('Print parse forest graph:', parseOpts.forestGraph = !parseOpts.forestGraph)
	},
})

/**
 * Invokes `node` with `nodeArgs` and saves output to `outputPath`. `diffOutput()` uses this output for comparisons.
 *
 * @private
 * @static
 * @param {string[]} nodeArgs The arguments `node` invokes to generate the output to archive.
 * @param {string} outputPath The file-path of where to write output.
 * @param {Function} [callback] The function to invoke after `nodeArgs` completes and its output has been saved.
 */
function archiveOuput(nodeArgs, outputPath, callback) {
	// Log program name and arguments to execute.
	var programName = path.basename(nodeArgs[0])
	util.log('Processing: node', programName, nodeArgs.slice(1).join(' '))

	// Create file if does not exist, truncate file to zero length if it does exist, or throw an exception if `outputPath` is a directory.
	var outFD = fs.openSync(outputPath, 'w')

	// Spawn program as a child process, outputting `outputPath`.
	rl.spawnAsyncProcess('node', nodeArgs, [ 'ignore', outFD, process.stderr ], function () {
		util.log(programName, 'output saved:', fs.realpathSync(outputPath))

		if (callback) {
			callback()
		}
	})
}

/**
 * Invokes `node` with `nodeArgs` and saves output to the system pasteboard.
 *
 * @private
 * @static
 * @param {string[]} nodeArgs The arguments `node` invokes to generate the output to archive.
 */
function copyOutput(nodeArgs) {
	// Log program name and arguments to execute.
	var programName = path.basename(nodeArgs[0])
	util.log('Processing: node', programName, nodeArgs.slice(1).join(' '))

	// Spawn `pbcopy` process to receive output.
	var pbcopy = childProcess.spawn('pbcopy')

	// Pipe process `stdout` to `pbcopy` (excludes `stderr`).
	rl.spawnAsyncProcess('node', nodeArgs, [ 'ignore', pbcopy.stdin, process.stderr ], function () {
		// Close `pbcopy` write stream.
		pbcopy.stdin.end()

		util.log(programName, 'output copied to pasteboard.')
	})
}

/**
 * Invokes `node` with `nodeArgs` to generate output, and opens `vimdiff` to compare the output to the previous output for the same program at `oldOutputPath`.
 *
 * @private
 * @static
 * @param {string[]} nodeArgs The arguments `node` invokes to generate the output to compare.
 * @param {string} oldOutputPath The file-path of previous `nodeArgs` output to compare.
 */
function diffOutput(nodeArgs, oldOutputPath) {
	// Log program name and arguments to execute.
	util.log('Processing: node', path.basename(nodeArgs[0]), nodeArgs.slice(1).join(' '))

	// Temporarily save output for `vimdiff`.
	var tempPath = oldOutputPath + '_temp'
	var outFD = fs.openSync(tempPath, 'w')

	// Execute program and save output to temporary file-path.
	rl.spawnAsyncProcess('node', nodeArgs, [ 'ignore', outFD, outFD ], function () {
		// Open `vimdiff` to compare current output to archived previous output.
		diffFiles(oldOutputPath, tempPath)

		// Remove temporary file.
		fs.unlinkSync(tempPath)
	})
}

/**
 * Opens `vimdiff` with the provided files to compare their differences.
 *
 * @private
 * @static
 * @param {string} fileA The file-path to compare.
 * @param {string} fileB The other file-path to compare.
 */
function diffFiles(fileA, fileB) {
	if (filesDiff(fileA, fileB)) {
		// Use `childProcess.spawnSync()` to enable user input (unlike `rl.spawnAsyncProcess()`).
		childProcess.spawnSync('vimdiff', [ fileA, fileB ], { stdio: 'inherit' })
	} else {
		util.log('No changes.')
	}
}

/**
 * Checks if `fileA` and `fileB` have different contents.
 *
 * @private
 * @static
 * @param {string} fileA The file-path to compare.
 * @param {string} fileB The other file-path to compare.
 * @returns {boolean} Returns `true` if the files differ, else `false`.
 */
function filesDiff(fileA, fileB) {
	return !!childProcess.spawnSync('cmp', [ '--quiet', fileA, fileB ], { stdio: 'ignore' }).status
}

/**
 * Colors the RLI prompt character green if there are unarchived grammar changes, otherwise removes its color.
 *
 * @private
 * @static
 * @param {Interface} rl The RLI of which to color the prompt character.
 */
function updateRLIPrompt(rl) {
	rl.setPrompt(util.colors[ filesDiff(paths.grammar, paths.grammarOld) ? 'green' : 'stripColor' ](rl._prompt))

	// Re-draw the current line and prompt character if `rl` is not currently running an asynchronous process (during which the prompt character is not displayed and will be updated upon process completion).
	if (!rl.paused) {
		rl._refreshLine()
	}
}