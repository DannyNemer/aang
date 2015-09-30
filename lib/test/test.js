/**
 * Usage
 *   node test [options]
 *
 * Description
 *   Parses the suite of test queries and checks output conforms to the test's specifications.
 *
 *   The test suite contains an array of `Object`s with a `query` to parse and the property `
 *   exactMatch` defining whether the parse's first result's display text should match `query`.
 *
 * Options
 *   -k                        The maximum number of parse trees to find per test.    [default: 50]
 *   -b, --benchmark           Benchmark the duration of each test.                       [boolean]
 *   -q, --quiet               Suppress parse results from output.                        [boolean]
 *   -c, --print-costs         Print the parse costs.                                     [boolean]
 *   -t, --print-trees         Construct and print the parse trees.                       [boolean]
 *   -s, --print-stack         Print the parse stacks.                                    [boolean]
 *   -f, --print-forest        Print equational representations of the parse forests.     [boolean]
 *   -g, --print-forest-graph  Print graph representations of the parse forests.          [boolean]
 *   -h, --help                Display this screen.                                       [boolean]
 *
 * Examples:
 *   node test -k=30 -cb  Finds the 30-best parse trees of each query in the test suite, prints the
 *                        duration of each parse, and includes the parse tree costs in the parse
 *                        results.
 *   node test -q         Finds the 50-best parse trees of each query in the test suite, but does
 *                        not print the parse results.
 */

var util = require('../util.js')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]',
		'',
		util.colors.bold('Description'),
		'  Parses the suite of test queries and checks output conforms to the test\'s specifications.',
		'',
		'  The test suite contains an array of `Object`s with a `query` to parse and the property `exactMatch` defining whether the parse\'s first result\'s display text should match `query`.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.options({
		'k': {
			description: 'The maximum number of parse trees to find per test.',
			requiresArg: true,
			default: 50,
		},
		'b': {
			alias: 'benchmark',
			description: 'Benchmark the duration of each test.',
			type: 'boolean',
		},
		'q': {
			alias: 'quiet',
			description: 'Suppress parse results from output.',
			type: 'boolean',
		},
		'c': {
			alias: 'print-costs',
			description: 'Print the parse costs.',
			type: 'boolean',
		},
		't': {
			alias: 'print-trees',
			description: 'Construct and print the parse trees.',
			type: 'boolean',
		},
		's': {
			alias: 'print-stack',
			description: 'Print the parse stacks.',
			type: 'boolean',
		},
		'f': {
			alias: 'print-forest',
			description: 'Print equational representations of the parse forests.',
			type: 'boolean',
		},
		'g': {
			alias: 'print-forest-graph',
			description: 'Print graph representations of the parse forests.',
			type: 'boolean',
		},
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	.example('node $0 -k=30 -cb', 'Finds the 30-best parse trees of each query in the test suite, prints the duration of each parse, and includes the parse tree costs in the parse results.')
	.example('node $0 -q', 'Finds the 50-best parse trees of each query in the test suite, but does not print the parse results.')
	.check(function (argv, options) {
		if (isNaN(argv.k)) {
			throw 'TypeError: \'-k\' must be a number'
		}

		return true
	})
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 96))
	.argv

var testsFilePath = require.resolve('./tests.js')
var tests = require(testsFilePath)
var testsLen = tests.length

// Check for duplicate and ill-formed tests.
for (var t = 0; t < testsLen; ++t) {
	var test = tests[t]
	var testQuery = test.query

	// Check for duplicate tests.
	for (var a = t + 1; a < testsLen; ++a) {
		if (testQuery === tests[a].query) {
			util.logError('Duplicate test:', util.stylize(testQuery))
			util.pathAndLineNumbersOf(testsFilePath, '\'' + testQuery + '\'').forEach(function (path) {
				util.log('  ' + path)
			})

			throw 'Duplicate test'
		}
	}

	// Check for ill-formed tests.
	if (test.exactMatch === undefined) {
		util.logError('Test missing property \'exactMatch\':', test)
		util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, '\'' + testQuery + '\''))

		throw 'Ill-formed test'
	}
}


var jsdiff = require('diff')
var Parser = require('../parser/Parser.js')
var forestSearch = require('../parser/forestSearch.js')

// Generate a `StateTable` from the grammar and instantiate a `Parser`.
var stateTable = require('../parser/buildStateTable.js')
var parser = new Parser(stateTable)

// Will the parse output anything.
var willOutput = argv.b || !argv.q || argv.t || argv.s || argv.f || argv.g

// Cycle through every test query.
for (var t = 0; t < testsLen; ++t) {
	parseTest(tests[t])
}

// Print values of any counters used during the test.
util.countEndAll()


/**
 * Constructs a parse forest for `test.query`, and if it reaches the start node, then finds the k-best parse trees as well as their semantics and display texts. Checks if the parse results conform to `test`'s specifications.
 *
 * @param {Object} test The test to parse and check.
 */
function parseTest(test) {
	var query = test.query

	// Print the query above its parse results.
	if (willOutput) {
		util.log((t ? '\n' : '') + 'query:', util.colors.bold(query))
	}

	// Benchmark the duration of the parse and the parse forest search.
	if (argv.benchmark) util.time('parse')

	// Construct the parse forest for `test.query`.
	var startNode = parser.parse(query)

	if (argv.benchmark) util.timeEnd('parse')

	if (startNode) {
		// Search the parse forest for the k-best parse trees.
		var trees = forestSearch.search(startNode, argv.k, argv.printTrees, !argv.quiet)

		if (argv.benchmark) util.timeEnd('parse')

		if (trees.length > 0) {
			// Check if test conforms to test's specifications.
			checkTest(test, trees)

			// Print the display text and semantics for the k-best parse trees.
			if (!argv.quiet) {
				forestSearch.print(trees, argv.printCosts, argv.printTrees)
			}
		} else if (willOutput) {
			util.logError('Failed to find legal parse trees.')
		} else {
			util.logError('No legal parse trees:', util.colors.grey(query))
		}

		// Print a graph representation of the parse forest.
		if (argv.printForestGraph) parser.printNodeGraph(startNode)
	} else if (willOutput) {
		util.logError('Failed to reach start node.')
	} else {
		util.logError('No start node:', util.colors.grey(query))
	}

	// Print the parse stack.
	if (argv.printStack) parser.printStack()

	// Print an equational representation of the parse forest.
	if (argv.printForest) parser.printForest(startNode)
}

/**
 * Checks if the parse results for `test.query` conform to `test`'s specifications.
 *
 * @param {Object} test The test to check.
 * @param {Object[]} trees The array of parse trees returned by the parse of `test.query`.
 */
function checkTest(test, trees) {
	var query = test.query
	var actual = trees[0].text

	// Parse incorrectly rejects input (i.e., contains edits).
	if (test.exactMatch) {
		if (query !== actual) {
			var diff = jsdiff.diffWords(query, actual).reduce(function (acc, part) {
				if (part.removed) {
					return {
						expected: acc.expected += util.colors.red(part.value),
						actual: acc.actual,
					}
				} else if (part.added) {
					return {
						expected: acc.expected,
						actual: acc.actual += util.colors.green(part.value),
					}
				} else {
					return {
						expected: acc.expected += util.colors.grey(part.value),
						actual: acc.actual += util.colors.grey(part.value),
					}
				}
			}, { expected: '', actual: '' })

			util.logError('Expected:', diff.expected)
			util.log('         Actual:', diff.actual)
		}
	}

	// Parse incorrectly accepts input (i.e., no edits).
	else if (query === actual) {
		util.logError('Expected:', '--not-input--')
		util.log('         Actual:', query)
	}
}