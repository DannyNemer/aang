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
	// Pass all arguments to the command line program.
	].concat(query.split(' ')))
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

// Assign commands to the RLI, executed via `.command`.
// All arguments after `.command` are passed to the corresponding functions and programs as options.
rl.addCommands({
	name: 'test',
	description: 'Parse the suite of test queries.',
	func: function test() {
		rl.spawnAsyncProcess('node', [
			paths.test,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)))
	},
}, {
	name: 'copyTest',
	description: 'Copy test output to the pasteboard.',
	func: function copyTest() {
		var pbcopy = childProcess.spawn('pbcopy')

		// Pipe process `stdout` to `pbcopy` (excludes `stderr`).
		rl.spawnAsyncProcess('node', [
			paths.test,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)), [ 'ignore', pbcopy.stdin, process.stderr ], function () {
			// Close `pbcopy` write stream.
			pbcopy.stdin.end()
			util.log('Test output copied to the pasteboard.')
		})
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

		util.log('Processing test...')

		// Create file if does not exist, truncate file to zero length if it does exist, or throw an exception if `outPath` is a directory.
		var outPath = util.expandHomeDir(filename ? paths.outDir + filename : paths.testOut)
		var outFD = fs.openSync(outPath, 'w')

		// Spawn test as a child process, outputting to a file at `outPath`.
		rl.spawnAsyncProcess('node', [
			paths.test,
		], [ 'ignore', outFD, process.stderr ], function () {
			util.log('Test output saved:', fs.realpathSync(outPath))
			if (callback) callback()
		})
	},
}, {
	name: 'diffTest',
	description: 'Compare last archived test output to current test output.',
	func: function diffTest() {
		util.log('Processing test...')

		// Run test and temporarily save output.
		var tempPath = paths.testOut + '_temp'

		var outPath = util.expandHomeDir(tempPath)
		var outFD = fs.openSync(outPath, 'w')

		rl.spawnAsyncProcess('node', [ paths.test ], [ 'ignore', outFD, outFD ], function () {
			// Invoke `vimdiff` to compare the current test output to the last saved output.
			childProcess.spawnSync('vimdiff', [ paths.testOut, tempPath ], { stdio: 'inherit' })

			// Remove temporary file.
			fs.unlinkSync(tempPath)
		})
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

		util.log('Processing test --quiet...')

		// Create file if does not exist, truncate file to zero length if it does exist, or throw an exception if `outPath` is a directory.
		var outPath = util.expandHomeDir(filename ? paths.outDir + filename : paths.testQuietOut)
		var outFD = fs.openSync(outPath, 'w')

		// Spawn test as a child process, outputting to a file at `outPath`.
		rl.spawnAsyncProcess('node', [
			paths.test,
			'--quiet',
		], [ 'ignore', outFD, process.stderr ], function () {
			util.log('Test output saved:', fs.realpathSync(outPath))
			if (callback) callback()
		})
	},
}, {
	name: 'diffTestQuiet',
	description: 'Compare last archived test-quiet output to current test-quiet output.',
	func: function diffTestQuiet() {
		util.log('Processing test --quiet...')

		// Run test and temporarily save output.
		var tempPath = paths.testQuietOut + '_temp'

		var outPath = util.expandHomeDir(tempPath)
		var outFD = fs.openSync(outPath, 'w')

		rl.spawnAsyncProcess('node', [ paths.test, '--quiet' ], [ 'ignore', outFD, outFD ], function () {
			// Invoke `vimdiff` to compare the current test output to the last saved output.
			childProcess.spawnSync('vimdiff', [ paths.testQuietOut, tempPath ], { stdio: 'inherit' })

			// Remove temporary file.
			fs.unlinkSync(tempPath)
		})
	},
}, {
	name: 'benchmark',
	description: 'Benchmark the duration of parsing the test suite.',
	func: function benchmark(numRuns) {
		rl.spawnAsyncProcess('node', [
			'../benchmark/benchmark.js',
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)))
	},
}, {
	name: 'buildGrammar',
	description: 'Rebuild the grammar.',
	func: function buildGrammar(callback) {
		rl.spawnAsyncProcess('node', [
			paths.buildGrammar,
			'--output=' + paths.grammar,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)), function () {
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
		], callback)
	},
}, {
	name: 'diffGrammar',
	description: 'Compare last archived grammar to current grammar.',
	func: function diffGrammar() {
		// Invoke `vimdiff` to compare the last archived grammar to the current grammar.
		childProcess.spawnSync('vimdiff', [ paths.grammarOld, paths.grammar ], { stdio: 'inherit' })
	},
}, {
	name: 'ambigCheck',
	argNames: [ '[<n>]' ],
	description: 'Find ambiguity in the grammar [with tree-symbol limit <n>].',
	func: function ambigCheck(treeSymLimit) {
		rl.spawnAsyncProcess('node', [
			paths.ambigCheck,
			isNaN(treeSymLimit) ? '' : '--tree-sym-limit=' + treeSymLimit,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)))
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

		util.log('Processing ambiguity check...')

		// Create file if does not exist, truncate file to zero length if it does exist, or throw an exception if `outPath` is a directory.
		var outPath = util.expandHomeDir(filename ? paths.outDir + filename : paths.ambigCheckOut)
		var outFD = fs.openSync(outPath, 'w')

		// Spawn test as a child process, outputting to a file at `outPath`.
		rl.spawnAsyncProcess('node', [
			paths.ambigCheck,
		], [ 'ignore', outFD, process.stderr ], function () {
			util.log('Ambiguity check output saved:', fs.realpathSync(outPath))
			if (callback) callback()
		})
	},
}, {
	name: 'diffAmbigCheck',
	description: 'Compare last archived ambiguity check output to current ambiguity check output.',
	func: function diffAmbigCheck() {
		util.log('Processing ambiguity check...')

		// Temporarily save output.
		var tempPath = paths.ambigCheckOut + '_temp'

		var outPath = util.expandHomeDir(tempPath)
		var outFD = fs.openSync(outPath, 'w')

		rl.spawnAsyncProcess('node', [ paths.ambigCheck ], [ 'ignore', outFD, outFD ], function () {
			// Invoke `vimdiff` to compare the current output to the last saved output.
			childProcess.spawnSync('vimdiff', [ paths.ambigCheckOut, tempPath ], { stdio: 'inherit' })

			// Remove temporary file.
			fs.unlinkSync(tempPath)
		})
	},
}, {
	name: 'stateTable',
	description: 'Print the state table.',
	func: function stateTable() {
		rl.spawnAsyncProcess('node', [
			paths.printStateTable,
			paths.grammar,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)))
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

		util.log('Generating state table...')

		// Create file if does not exist, truncate file to zero length if it does exist, or throw an exception if `outPath` is a directory.
		var outPath = util.expandHomeDir(filename ? paths.outDir + filename : paths.stateTableOut)
		var outFD = fs.openSync(outPath, 'w')

		// Spawn test as a child process, outputting to a file at `outPath`.
		rl.spawnAsyncProcess('node', [
			paths.printStateTable,
			paths.grammar,
		], [ 'ignore', outFD, process.stderr ], function () {
			util.log('State table representation saved:', fs.realpathSync(outPath))
			if (callback) callback()
		})
	},
}, {
	name: 'diffStateTable',
	description: 'Compare last archived state table to current state table.',
	func: function diffStateTable() {
		util.log('Generating state table...')

		// Temporarily save output.
		var tempPath = paths.stateTableOut + '_temp'

		var outPath = util.expandHomeDir(tempPath)
		var outFD = fs.openSync(outPath, 'w')

		rl.spawnAsyncProcess('node', [
			paths.printStateTable,
			paths.grammar,
		], [ 'ignore', outFD, outFD ], function () {
			// Invoke `vimdiff` to compare the current output to the last saved output.
			childProcess.spawnSync('vimdiff', [ paths.stateTableOut, tempPath ], { stdio: 'inherit' })

			// Remove temporary file.
			fs.unlinkSync(tempPath)
		})
	},
}, {
	name: 'archiveAll',
	description: 'Invokes all \'.archive*\' commands.',
	func: function archiveAll() {
		// Do not bother rewriting this operation as asynchronous because the change merely shortens the time from 42 s -> 24 s, which remains long enough that you background it either way.
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