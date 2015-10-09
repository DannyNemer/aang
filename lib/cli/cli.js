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
 *    • checkForAmbiguity - Finds and prints instances of ambiguity in the grammar.
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
		'   • checkForAmbiguity - Finds and prints instances of ambiguity in the grammar.',
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

rl.onLine(function (query) {
	this.spawnAsyncProcess('node', [
		'../parser/parse.js',
		query,
		'--k=' + config.k,
		'--benchmark=' + config.printTime,
		'--quiet=' + config.quiet,
		'--print-costs=' + config.printCosts,
		'--print-trees=' + config.printTrees,
		'--print-tree-node-costs=' + config.printTreeNodeCosts,
		'--print-tree-token-ranges=' + config.printTreeTokenRanges,
		'--print-stack=' + config.printStack,
		'--print-forest=' + config.printForest,
		'--print-forest-graph=' + config.printForestGraph,
	])
})

// Parser settings.
var config = {
	k: 7,
	quiet: false,
	printTrees: false,
	printCosts: false,
	printTime: false,
	printQuery: false,
	printTreeNodeCosts: false,
	printTreeTokenRanges: false,
	printStack: false,
	printForest: false,
	printForestGraph: false,
}

// Assign commands to the RLI, executed via `.command`.
// All arguments after `.command` are passed to the corresponding functions and programs as options.
rl.addCommands({
	// Parses the suite of test queries.
	test: function (k) {
		rl.spawnAsyncProcess('node', [
			'../test/test.js',
			'--k=' + (isNaN(k) ? 50 : k),
			'--benchmark=' + config.printTime,
			'--quiet=' + config.quiet,
			'--print-costs=' + config.printCosts,
			'--print-trees=' + config.printTrees,
			'--print-tree-node-costs=' + config.printTreeNodeCosts,
			'--print-tree-token-ranges=' + config.printTreeTokenRanges,
			'--print-stack=' + config.printStack,
			'--print-forest=' + config.printForest,
			'--print-forest-graph=' + config.printForestGraph,
			// Pass all arguments to the command line program.
			Array.prototype.join.call(arguments, ' '),
		])
	},

	// Benchmarks the duration of parsing the test suite.
	benchmark: function (numRuns) {
		rl.spawnAsyncProcess('node', [
			'../benchmark/benchmark.js',
			'--num-runs=' + (isNaN(numRuns) ? 1 : numRuns),
			// Pass all arguments to the command line program.
			Array.prototype.join.call(arguments, ' '),
		])
	},

	// Writes output of a parse of the test suite to file.
	logTest: function (filepath) {
		// Create file if does not exist, truncates file to zero length if it does exist, or throw an exception if `outPath` is a directory.
		var outPath = util.expandHomeDir(filepath || '~/Desktop/out')
		var outFD = fs.openSync(outPath, 'w')

		// Spawn test as a child process, outputting to a file at `outPath`.
		rl.spawnAsyncProcess('node', [
			'../test/test.js',
			'--k=' + 50,
			'--benchmark=' + config.printTime,
			'--quiet=' + config.quiet,
			'--print-costs=' + config.printCosts,
			'--print-trees=' + config.printTrees,
			'--print-stack=' + config.printStack,
			'--print-forest=' + config.printFrest,
			'--print-forest-graph=' + config.printForestGraph,
			// Pass all arguments to the command line program.
			Array.prototype.join.call(arguments, ' '),
		], [ 'ignore', outFD, outFD ], function () {
			util.log('Test output saved:', fs.realpathSync(outPath))
		})
	},

	// Rebuilds grammar.
	rebuild: function () {
		util.log('Rebuild grammar:')
		rl.spawnAsyncProcess('node', [
			'../grammar/buildGrammar.js',
			'--output=../grammar.json',
			// Pass all arguments to the command line program.
			Array.prototype.join.call(arguments, ' '),
		])
	},

	// Finds and prints instances of ambiguity in the grammar.
	ambig: function () {
		rl.spawnAsyncProcess('node', [
			'../ambig/checkForAmbiguity.js',
			'--quiet=' + config.quiet,
			// Pass all arguments to the command line program.
			Array.prototype.join.call(arguments, ' '),
		])
	},

	// Prints state table.
	stateTable: function () {
		rl.spawnAsyncProcess('node', [
			'../parser/printStateTable.js',
			// Pass all arguments to the command line program.
			Array.prototype.join.call(arguments, ' '),
		])
	},

	// Enters REPL.
	repl: function () {
		childProcess.execSync('node', { stdio: 'inherit' })
	},

	// Prints CLI history.
	history: function () {
		var historyLen = rl.history.length
		for (var i = historyLen - 1; i > 0; --i) {
			var idx = historyLen - i
			util.log((historyLen > 10 && idx < 10 ? ' ' : '') + idx + '  ' + rl.history[i])
		}
	},

	// Sets number of parse trees to search for.
	k: function (k) {
		if (!isNaN(k)) config.k = Number(k)
		util.log('k:', config.k)
	},

	// Toggles supressing parse results from output.
	quiet: function () {
		config.quiet = !config.quiet
		util.log('Suppress parse results:', config.quiet)
	},

	// Toggles constructing and printing parse trees.
	trees: function () {
		config.printTrees = !config.printTrees
		util.log('Construct and print parse trees:', config.printTrees)
	},

	// Toggles printing parse costs.
	costs: function () {
		config.printCosts = !config.printCosts
		util.log('Print parse costs:', config.printCosts)
	},

	// Toggles printing parse time.
	time: function () {
		config.printTime = !config.printTime
		util.log('Print parse time:', config.printTime)
	},

	// Toggles including in parse trees each node's path cost.
	nodeCosts: function () {
		config.printTrees = !config.printTrees
		util.log('Include in parse trees each node\'s path cost:', config.printTrees)
	},

	// Toggles including in parse trees each node's token range.
	tokenRanges: function () {
		config.printTrees = !config.printTrees
		util.log('Include in parse trees each node\'s token range:', config.printTrees)
	},

	// Toggles printing parse stack.
	stack: function () {
		config.printStack = !config.printStack
		util.log('Print parse stack:', config.printStack)
	},

	// Toggles printing parse forest.
	forest: function () {
		config.printForest = !config.printForest
		util.log('Print parse forest:', config.printForest)
	},

	// Toggles printing parse forest graph.
	graph: function () {
		config.printForestGraph = !config.printForestGraph
		util.log('Print parse forest graph:', config.printForestGraph)
	},

	// Prints help screen.
	help: function () {
		util.log([
			util.colors.bold('Commands'),
			'  .test [<k>]        parse the suite of test queries [where k=<k>]',
			'  .benchmark [<n>]   benchmark duration of parsing the test suite [<n> times]',
			'  .logTest [<path>]  write parse output of test suite to file [at <path>]',
			'  .rebuild           rebuild grammar',
			'  .ambig [options]   find ambiguity in the grammar',
			'  .stateTable        print state table',
			'  .repl              enter REPL',
			'  .history           print CLI history',
			'  .help              print this screen',
			'',
			util.colors.bold('Environment Variables'),
			'  .k            k: ' + util.colors.yellow(config.k),
			'  .quiet        suppress parse results: ' + util.colors.yellow(config.quiet),
			'  .time         benchmark parse duration: ' + util.colors.yellow(config.time),
			'  .costs        print parse costs: ' + util.colors.yellow(config.printCosts),
			'  .trees        print parse trees: ' + util.colors.yellow(config.printTrees),
			'  .nodeCosts    include node path costs in parse trees: ' + util.colors.yellow(config.printTreeNodeCosts),
			'  .tokenRanges  include token ranges in parse trees: ' + util.colors.yellow(config.printTreeTokenRanges),
			'  .stack        print parse stack: ' + util.colors.yellow(config.printStack),
			'  .forest       print parse forest: ' + util.colors.yellow(config.printForest),
			'  .graph        print parse forest graph: ' + util.colors.yellow(config.printForestGraph),
		].join('\n'))
	},
})

// Ready RLI for input and display the prompt character.
rl.prompt()