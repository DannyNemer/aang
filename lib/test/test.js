/**
 * Usage
 *   node test [options]
 *
 * Description
 *   Parses the suite of test queries and checks output conforms to the test's specifications.
 *
 *   The test suite contains an array of `Object`s with a `query` to parse and additional
 *   properties defining expected parse results.
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
		'  The test suite contains an array of `Object`s with a `query` to parse and additional properties defining expected parse results.',
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
			util.pathAndLineNumbersOf(testsFilePath, testQuery, true).forEach(function (path) {
				util.log('  ' + path)
			})

			throw 'Duplicate test'
		}
	}

	// Check for missing `test.correction`.
	if (test.correction === undefined) {
		util.logError('Test missing property \'correction\':', test)
		util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, testQuery, true))

		throw 'Ill-formed test'
	}

	// Check if `test.semantic` exists when `test.correction` is `true`.
	if (test.semantic !== undefined && test.correction === true) {
		util.logError('Test defines \'semantic\' but \'correction: true\' accepts varying results:', test)
		util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, testQuery, true))

		throw 'Ill-formed test'
	}

	// Check if `test.correction` accepts a specific result when test.semantic` is missing.
	if (test.semantic === undefined && test.correction !== true) {
		util.logError('Test missing \'semantic\': but \'correction\' accepts a specific result', test)
		util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, testQuery, true))

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
	if (willOutput) printQuery(query)

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
		} else {
			if (!willOutput) printQuery(query)
			util.logError('Failed to find legal parse trees.')
		}

		// Print a graph representation of the parse forest.
		if (argv.printForestGraph) parser.printNodeGraph(startNode)
	} else {
		if (!willOutput) printQuery(query)
		util.logError('Failed to reach start node.')
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
	var correction = test.correction
	var firstResult = trees[0]
	var actual = firstResult.text

	if (correction) {
		// Parse incorrectly accepts input (i.e., no edits).
		if (correction === true && query === actual) {
			printTestFailure('--not-input--', actual, query)
		}

		// First result's display text does not match expected value.
		else if (typeof correction === 'string' && correction !== actual) {
			var diff = diffStrings(correction, actual)
			printTestFailure(diff.expected, diff.actual, query)
	}
		}

	// Parse incorrectly rejects input (i.e., contains edits).
	else if (query !== actual) {
			var diff = diffStrings(query, actual)
		printTestFailure(diff.expected, diff.actual, query)
	}

	// First result's semantic does not match expected value.
	if (test.semantic !== undefined && test.semantic !== firstResult.semanticStr) {
		// Temorarily convert strings from kebab case to camel case for diff-ing to prevent hyphens (which are word boundaries) from breeaking up semantic function names.
		var diff = diffStrings(util.kebabToCamelCase(test.semantic), util.kebabToCamelCase(firstResult.semanticStr))
		diff.expected = util.camelToKebabCase(diff.expected)
		diff.actual = util.camelToKebabCase(diff.actual)
		printTestFailure(diff.expected, diff.actual, query)
	}
}

/**
 * Prints an error message for a failed test.
 *
 * @param {string} expected The test's expected value.
 * @param {string} actual The actual value.
 * @param {string} query The test's parse query.
 */
function printTestFailure(expected, actual, query) {
			if (!willOutput) printQuery(query)
	util.logError('Expected:', expected)
	util.log('         Actual:', actual)
}

/**
 * Prints the query as a header for parse or error output.
 *
 * @param {string} query The query print.
 */
function printQuery(query) {
	util.log('\nquery:', util.colors.bold(query))
}

/**
 * Compares two strings word by word, ignores whitespace, and stylizes their differences for printing.
 *
 * @param {string} expected The string to compare.
 * @param {string} actual The other string to compare.
 * @returns {Object} Returns an object with the input strings as properties `expected` and `actual`, with their differences stylized for printing.
 */
function diffStrings(expected, actual) {
	return jsdiff.diffWords(expected, actual).reduce(function (diff, part) {
		if (part.removed) {
			return {
				expected: diff.expected += util.colors.red(part.value),
				actual: diff.actual,
			}
		} else if (part.added) {
			return {
				expected: diff.expected,
				actual: diff.actual += util.colors.green(part.value),
			}
		} else {
			return {
				expected: diff.expected += part.value,
				actual: diff.actual += part.value,
			}
		}
	}, { expected: '', actual: '' })
}