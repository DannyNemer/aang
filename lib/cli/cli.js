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

// Send input not recognized as a command to `parse`.
rl.onLine(function (query) {
	this.spawnAsyncProcess('node', [
		'../parse/parse.js',
		'--k=' + config.k,
		'--quiet=' + config.quiet,
		'--benchmark=' + config.benchmark,
		'--print-costs=' + config.printCosts,
		'--print-trees=' + config.printTrees,
		'--print-tree-node-costs=' + config.printTreeNodeCosts,
		'--print-tree-token-ranges=' + config.printTreeTokenRanges,
		'--print-stack=' + config.printStack,
		'--print-forest=' + config.printForest,
		'--print-forest-graph=' + config.printForestGraph,
	// Pass all arguments to the command line program.
	].concat(query.split(' ')))
})

// Parser settings.
var config = {
	k: 7,
	quiet: false,
	benchmark: false,
	printCosts: false,
	printTrees: false,
	printTreeNodeCosts: false,
	printTreeTokenRanges: false,
	printStack: false,
	printForest: false,
	printForestGraph: false,
}

// Assign commands to the RLI, executed via `.command`.
// All arguments after `.command` are passed to the corresponding functions and programs as options.
rl.addCommands({
	name: 'test',
	argNames: [ '[<k>]' ],
	description: 'Parse the suite of test queries [where k=<k>].',
	func: function test(k) {
		rl.spawnAsyncProcess('node', [
			'../test/test.js',
			isNaN(k) ? '' : '--k=' + k,
			'--quiet=' + config.quiet,
			'--benchmark=' + config.benchmark,
			'--print-costs=' + config.printCosts,
			'--print-trees=' + config.printTrees,
			'--print-tree-node-costs=' + config.printTreeNodeCosts,
			'--print-tree-token-ranges=' + config.printTreeTokenRanges,
			'--print-stack=' + config.printStack,
			'--print-forest=' + config.printForest,
			'--print-forest-graph=' + config.printForestGraph,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)))
	},
}, {
	name: 'copyTest',
	argNames: [ '[<k>]' ],
	description: 'Copy parse output of the test suite [where k=<k>] to the pasteboard.',
	func: function copyTest(k) {
		var pbcopy = childProcess.spawn('pbcopy')

		// Pipe process stdout to `pbcopy` (excludes stderr).
		rl.spawnAsyncProcess('node', [
			'../test/test.js',
			isNaN(k) ? '' : '--k=' + k,
			'--quiet=' + config.quiet,
			'--benchmark=' + config.benchmark,
			'--print-costs=' + config.printCosts,
			'--print-trees=' + config.printTrees,
			'--print-tree-node-costs=' + config.printTreeNodeCosts,
			'--print-tree-token-ranges=' + config.printTreeTokenRanges,
			'--print-stack=' + config.printStack,
			'--print-forest=' + config.printForest,
			'--print-forest-graph=' + config.printForestGraph,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)), [ 'ignore', pbcopy.stdin, process.stderr ], function () {
			// Close `pbcopy` write stream.
			pbcopy.stdin.end()
			util.log('Test output copied to the pasteboard.')
		})
	},
}, {
	name: 'saveTest',
	argNames: [ '[<path>]' ],
	description: 'Write output of the test suite to a file [at <path>].',
	func: function saveTest(filepath) {
		// Create file if does not exist, truncates file to zero length if it does exist, or throw an exception if `outPath` is a directory.
		var outPath = util.expandHomeDir(filepath || '~/Desktop/out_test')
		var outFD = fs.openSync(outPath, 'w')

		// Spawn test as a child process, outputting to a file at `outPath`.
		rl.spawnAsyncProcess('node', [
			'../test/test.js',
			'--quiet=' + config.quiet,
			'--benchmark=' + config.benchmark,
			'--print-costs=' + config.printCosts,
			'--print-trees=' + config.printTrees,
			'--print-tree-node-costs=' + config.printTreeNodeCosts,
			'--print-tree-token-ranges=' + config.printTreeTokenRanges,
			'--print-stack=' + config.printStack,
			'--print-forest=' + config.printFrest,
			'--print-forest-graph=' + config.printForestGraph,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)), [ 'ignore', outFD, outFD ], function () {
			util.log('Test output saved:', fs.realpathSync(outPath))
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
	name: 'rebuild',
	description: 'Rebuild the grammar.',
	func: function rebuild() {
		rl.spawnAsyncProcess('node', [
			'../grammar/buildGrammar.js',
			'--output=../grammar.json',
			'--include-trees=' + config.printTrees,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)))
	},
}, {
	name: 'ambig',
	argNames: [ '[<n>]' ],
	description: 'Find ambiguity in the grammar [with tree-symbol limit <n>].',
	func: function ambig(treeSymsLimit) {
		rl.spawnAsyncProcess('node', [
			'../ambig/ambiguityCheck.js',
			isNaN(treeSymsLimit) ? '' : '--tree-syms-limit=' + treeSymsLimit,
			'--quiet=' + config.quiet,
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)))
	},
}, {
	name: 'stateTable',
	description: 'Print the state table.',
	func: function stateTable() {
		rl.spawnAsyncProcess('node', [
			'../parse/printStateTable.js',
		// Pass all arguments to the command line program.
		].concat(Array.prototype.slice.call(arguments)))
	},
}, {
	name: 'repl',
	description: 'Enter the Node.js REPL.',
	func: function repl() {
		childProcess.execSync('node', { stdio: 'inherit' })
	},
}, {
	name: 'history',
	description: 'Print the CLI history.',
	func: function history() {
		var historyLen = rl.history.length
		for (var i = historyLen - 1; i > 0; --i) {
			var idx = historyLen - i
			util.log((historyLen > 10 && idx < 10 ? ' ' : '') + idx + '  ' + rl.history[i])
		}
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
	name: 'stack',
	description: 'Toggle printing the parse stack.',
	func: function stack() {
		config.printStack = !config.printStack
		util.log('Print parse stack:', config.printStack)
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

// Ready RLI for input and display the prompt character.
rl.prompt()