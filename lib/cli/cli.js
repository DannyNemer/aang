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

require('yargs')
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

var readline = require('readline')
var childProcess = require('child_process')
var fs = require('fs')

// Instantiates a readline `Interface`.
var rl = require('./readlineAsync')

// Parse settings.
var config = {
	k: 7,
	quiet: false,
	benchmark: false,
	printCosts: false,
	printAmbiguity: false,
	printTrees: false,
	printTreeNodeCosts: false,
	printTreeTokenRanges: false,
	printObjectSemantics: false,
	printParseStack: false,
	printForest: false,
	printForestGraph: false,
}

// Send input not recognized as a command to `parse`.
rl.onLine(function (query) {
	this.spawnAsyncProcess('node', [
		'../parse/parse.js',
		'--k=' + config.k,
		'--quiet=' + config.quiet,
		'--benchmark=' + config.benchmark,
		'--print-costs=' + config.printCosts,
		'--print-ambiguity=' + config.printAmbiguity,
		'--print-trees=' + config.printTrees,
		'--print-tree-node-costs=' + config.printTreeNodeCosts,
		'--print-tree-token-ranges=' + config.printTreeTokenRanges,
		'--print-object-semantics=' + config.printObjectSemantics,
		'--print-parse-stack=' + config.printParseStack,
		'--print-forest=' + config.printForest,
		'--print-forest-graph=' + config.printForestGraph,
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
	argNames: [ '[<k>]' ],
	description: 'Parse the suite of test queries [where k=<k>].',
	func: function test(k) {
		rl.spawnAsyncProcess('node', [
			paths.test,
			isNaN(k) ? '' : '--k=' + k,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)))
	},
}, {
	name: 'copyTest',
	argNames: [ '[<k>]' ],
	description: 'Copy test output [where k=<k>] to the pasteboard.',
	func: function copyTest(k) {
		var pbcopy = childProcess.spawn('pbcopy')

		// Pipe process `stdout` to `pbcopy` (excludes `stderr`).
		rl.spawnAsyncProcess('node', [
			paths.test,
			isNaN(k) ? '' : '--k=' + k,
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
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)), [ 'ignore', outFD, process.stderr ], function () {
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
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)), [ 'ignore', outFD, process.stderr ], function () {
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
	argNames: [ '[<n>]' ],
	description: 'Benchmark the duration of parsing the test suite [<n> times].',
	func: function benchmark(numRuns) {
		rl.spawnAsyncProcess('node', [
			'../benchmark/benchmark.js',
			isNaN(numRuns) ? '' : '--num-runs=' + numRuns,
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
			if (callback) callback()
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
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)), callback)
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
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)), [ 'ignore', outFD, process.stderr ], function () {
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
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)), [ 'ignore', outFD, process.stderr ], function () {
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
		rl.commands['.archiveGrammar'](function () {
			util.log()
			rl.commands['.buildGrammar'](function () {
				util.log()
				rl.commands['.archiveTest'](function () {
					util.log()
					rl.commands['.archiveTestQuiet'](function () {
						util.log()
						rl.commands['.archiveAmbigCheck'](function () {
							util.log()
							rl.commands['.archiveStateTable']()
						})
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
		if (!isNaN(k)) config.k = Number(k)
		util.log('k:', config.k)
	},
}, {
	name: 'quiet',
	description: 'Toggle suppressing parse results from output',
	func: function quiet() {
		config.quiet = !config.quiet
		util.log('Suppress parse results:', config.quiet)
	},
}, {
	name: 'time',
	description: 'Toggle benchmarking duration of parse and parse forest search.',
	func: function time() {
		config.benchmark = !config.benchmark
		util.log('Print parse time:', config.benchmark)
	},
}, {
	name: 'costs',
	description: 'Toggle printing parse costs.',
	func: function costs() {
		config.printCosts = !config.printCosts
		util.log('Print parse costs:', config.printCosts)
	},
}, {
	name: 'ambiguity',
	description: 'Toggle printing instances of semantic ambiguity.',
	func: function ambiguity() {
		config.printAmbiguity = !config.printAmbiguity
		util.log('Print ambiguity:', config.printAmbiguity)
	},
}, {
	name: 'trees',
	description: 'Toggle constructing and printing parse trees.',
	func: function time() {
		config.printTrees = !config.printTrees
	util.log('Construct and print parse trees:', config.printTrees)
	},
}, {
	name: 'nodeCosts',
	description: 'Toggle including in parse trees each node\'s path cost.',
	func: function nodeCosts() {
		config.printTreeNodeCosts = !config.printTreeNodeCosts
		util.log('Include in parse trees each node\'s path cost:', config.printTreeNodeCosts)
	},
}, {
	name: 'tokenRanges',
	description: 'Toggle including in parse trees each node\'s token range.',
	func: function tokenRanges() {
		config.printTreeTokenRanges = !config.printTreeTokenRanges
		util.log('Include in parse trees each node\'s token range:', config.printTreeTokenRanges)
	},
}, {
	name: 'objectSemantics',
	description: 'Toggle printing object representations of semantics.',
	func: function objectSemantics() {
		config.printObjectSemantics = !config.printObjectSemantics
		util.log('Print object representations of semantics:', config.printObjectSemantics)
	},
}, {
	name: 'stack',
	description: 'Toggle printing the parse stack.',
	func: function stack() {
		config.printParseStack = !config.printParseStack
		util.log('Print parse stack:', config.printParseStack)
	},
}, {
	name: 'forest',
	description: 'Toggle printing an equational representation of the parse forest.',
	func: function forest() {
		config.printForest = !config.printForest
		util.log('Print parse forest:', config.printForest)
	},
}, {
	name: 'graph',
	description: 'Toggle printing a graph representation of the parse forest.',
	func: function graph() {
		config.printForestGraph = !config.printForestGraph
		util.log('Print parse forest graph:', config.printForestGraph)
	},
})