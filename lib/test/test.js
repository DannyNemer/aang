/**
 * Usage
 *   node test [options]
 *
 * Description
 *   Parses the suite of test queries and checks output conforms to the test's expected values.
 *
 *   The test suite contains an array of `Object`s with a `query` to parse and additional properties
 *   defining expected parse results.
 *
 * Options
 *   -k                             The maximum number of parse trees to find per test.   [default: 50]
 *   -q, --quiet                    Suppress parse results from output.                       [boolean]
 *   -b, --benchmark                Benchmark the duration of each test.                      [boolean]
 *   -c, --print-costs              Print the parse costs.                                    [boolean]
 *   -t, --print-trees              Construct and print the parse trees.                      [boolean]
 *   -n, --print-tree-node-costs    Include in parse trees each node's path cost.             [boolean]
 *   -r, --print-tree-token-ranges  Include in parse trees each node's token range.           [boolean]
 *   -s, --print-stack              Print the parse stacks.                                   [boolean]
 *   -f, --print-forest             Print equational representations of the parse forests.    [boolean]
 *   -g, --print-forest-graph       Print graph representations of the parse forests.         [boolean]
 *   -h, --help                     Display this screen.                                      [boolean]
 *
 * Examples:
 *   node test -k=30 -cb  Finds the 30-best parse trees of each query in the test suite, prints the
 *                        duration of each parse, and includes the parse tree costs in the parse
 *                        results.
 *   node test -q         Finds the 50-best parse trees of each query in the test suite, but does not
 *                        print the parse results.
 */

var util = require('../util/util')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]',
		'',
		util.colors.bold('Description'),
		'  Parses the suite of test queries and checks output conforms to the test\'s expected values.',
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
		'q': {
			alias: 'quiet',
			description: 'Suppress parse results from output.',
			type: 'boolean',
		},
		'b': {
			alias: 'benchmark',
			description: 'Benchmark the duration of each test.',
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
		'n': {
			alias: 'print-tree-node-costs',
			description: 'Include in parse trees each node\'s path cost.',
			type: 'boolean',
		},
		'r': {
			alias: 'print-tree-token-ranges',
			description: 'Include in parse trees each node\'s token range.',
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
	.implies('print-tree-token-ranges', 'print-trees')
	.implies('print-tree-node-costs', 'print-trees')
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
	.wrap(Math.min(yargs.terminalWidth(), 100))
	.argv

// Prevent surrounding file paths with parentheses in stack traces.
util.excludeParenthesesInStackTrace()

// The collection of test cases, each with a query and expected values for parse results.
var testsFilePath = require.resolve('./tests.json')
var tests = require(testsFilePath)

// Check for ill-formed and duplicate tests in the test suite, and throw an exception if found.
validateTests(tests, testsFilePath)

var jsdiff = require('diff')
var mapTreesToSemantics = require('./mapTreesToSemantics')
var Parser = require('../parse/Parser')
var pfsearch = require('../parse/pfsearch')
var printParseResults = require('../parse/printParseResults')

// Generate a `StateTable` from the grammar and instantiate a `Parser`.
var stateTable = require('../parse/buildStateTable')
var parser = new Parser(stateTable)

// Will the parse output anything.
var willOutput = argv.b || !argv.q || argv.t || argv.s || argv.f || argv.g

var testsLen = tests.length
var testsFailed = 0

// Cycle through every test query.
for (var t = 0; t < testsLen; ++t) {
	parseTest(tests[t])
}

// Print test results.
util.log()
if (testsFailed) {
	util.logError('Failed', testsFailed, 'of', testsLen, 'tests')
} else {
	util.logSuccess('Passed', testsLen, 'tests')
}

// Print values of any counters used during the test.
util.countEndAll()


/**
 * Constructs a parse forest for `test.query`, and if it reaches the start node, then finds the k-best parse trees as well as their semantics and display texts. Checks if the parse results match `test`'s expected values.
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
		var trees = pfsearch(startNode, argv.k, argv.printTrees, !argv.quiet)

		if (argv.benchmark) util.timeEnd('parse')

		if (trees.length > 0) {
			// Check if parse results match the test's expected values.
			checkTestResults(test, trees)

			if (!argv.quiet) {
				// Print the display text and semantics for the k-best parse trees.
				printParseResults(trees, {
					costs: argv.printCosts,
					trees: argv.printTrees,
					treeNodeCosts: argv.printTreeNodeCosts,
					treeTokenRanges: argv.printTreeTokenRanges,
				})
			}
		} else {
			failTopResultTest(test, 'Failed to find legal parse trees.')
		}

		// Print a graph representation of the parse forest.
		if (argv.printForestGraph) parser.printNodeGraph(startNode)
	} else {
		failTopResultTest(test, 'Failed to reach start node.')
	}

	// Print the parse stack.
	if (argv.printStack) parser.printStack()

	// Print an equational representation of the parse forest.
	if (argv.printForest) parser.printForest(startNode)
}

/**
 * Checks if the parse results for `test.query` match `test`'s expected values.
 *
 * @param {Object} test The test to check.
 * @param {Object[]} trees The array of parse trees returned by the parse of `test.query`.
 */
function checkTestResults(test, trees) {
	// Compare the top parse result to `test`'s expected display text and semantic.
	checkTestTopResult(test, trees[0])

	// Compare `trees`'s semantic results to `test`'s expected semantics, ignoring order.
	checkTestSemantics(test, trees)
}

/**
 * Compares a test's top parse result, `actualTopResult`, to `test`'s expected display text and semantic, and prints an error if the two do not match.
 *
 * @param {Object} test The test to check.
 * @param {Object} actualTopResult The first parse tree returned by the parse of `test.query`.
 */
function checkTestTopResult(test, actualTopResult) {
	var expectedTopResult = test.topResult

	if (expectedTopResult) {
		// Check if the top parse's display text matches the expected value.
		if (expectedTopResult.text !== actualTopResult.text) {
			var diff = diffStrings(expectedTopResult.text, actualTopResult.text)
			failTopResultTest(test, diff.expected, diff.actual)
		}

		// Check if the top parse's semantic matches the expected value.
		if (expectedTopResult.semantic !== actualTopResult.semanticStr) {
			// Temporarily convert strings from kebab case to camel case to prevent hyphens (which are word boundaries) from breaking up semantic function names when comparing.
			// Temporarily surround parentheses with spaces (treated as word boundaries) for comparing.
			var expected = util.kebabToCamelCase(expectedTopResult.semantic).replace(/[()]/g, ' $& ')
			var actual = util.kebabToCamelCase(actualTopResult.semanticStr).replace(/[()]/g, ' $& ')

			var diff = diffStrings(expected, actual)

			// Restore kebab case and parentheses.
			expected = util.camelToKebabCase(diff.expected).replace(/ /g, '')
			actual = util.camelToKebabCase(diff.actual).replace(/ /g, '')

			failTopResultTest(test, expected, actual)
		}
	}

	// Check if parse incorrectly accepts input (i.e., no edits).
	else if (test.query === actualTopResult.text) {
		failTopResultTest(test, actualTopResult.text)
	}
}

/**
 * Prints an error message for a test's failed match to the expected top parse result.
 *
 * @param {Object} test The test's input query.
 * @param {string} [expected] The test's expected value. If omitted, will be generated from `test`.
 * @param {string} actual The actual value.
 */
function failTopResultTest(test, expected, actual) {
	// Check arity.
	if (actual === undefined) {
		// No parse results.
		actual = expected

		// Generate expected.
		if (!test.topResult) {
			expected = '--not-input--'
		} else {
			// Align semantic with display text.
			expected = test.topResult.text + '\n                 ' + test.topResult.semantic
		}
	}

	// Print query if no other output settings caused it to already print.
	if (!willOutput) printQuery(test.query)

	// Print expected and actual parse results.
	util.logError('Expected:', expected)
	util.log('         Actual:', actual)

	// Print test note, if any.
	if (test.note) util.log(util.colors.yellow('Note') + ':', test.note)

	++testsFailed
}

/**
 * Compares two strings word by word and stylizes the differences for printing.
 *
 * @param {string} expected The string to compare.
 * @param {string} actual The other string to compare.
 * @returns {Object} Returns an object with `expected` and `actual` as properties for the strings with their differences stylized for printing.
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

/**
 * Compares `trees`'s semantic results to `test`'s expected semantics, ignoring order, and prints an error if the two do not match.
 *
 * @param {Object} test The test to check.
 * @param {Object[]} trees The array of parse trees returned by the parse of `test.query`.
 */
function checkTestSemantics(test, trees) {
	// Get the semantic strings and disambiguated semantics of `trees`.
	var actualSemantics = mapTreesToSemantics(trees)

	// look for differences
	var diff = diffSemantics(test.semantics, actualSemantics)

	if (diff) {
		// Print query if no other output settings caused it to already print.
		if (!willOutput) printQuery(test.query)

		// Print differences in the expected and actual semantic results.
		util.logError('Semantic results differ:')
		util.log(diff)

		++testsFailed
	}
}

/**
 * Compares two sets of semantic strings line by line, ignoring order, and stylizes the differences for printing.
 *
 * @param {string[]} expected The set of semantics to compare.
 * @param {Object[]} actual The other set of semantics to compare.
 * @returns {string|undefined} Returns a stylized string of the differences, if any, else `undefined`.
 */
function diffSemantics(expected, actual) {
	var diff = []

	// Check if up to the first `COMPARE_MAX` results of one exists in all of the other set. This avoids reporting missing/new semantics because of slight result ordering changes where the last few similarly cost rules are cut off in one (i.e, > k-th result) and not the other and vice versa.
	var COMPARE_MAX = 35
	var expectedLen = Math.min(expected.length, COMPARE_MAX)
	var actualLen = Math.min(actual.length, COMPARE_MAX)

	// Check for missing semantics in test results.
	for (var e = 0; e < expectedLen; ++e) {
		var semantic = expected[e]

		if (actual.indexOf(semantic) === -1) {
			diff.push(util.colors.red(semantic))
		}
	}

	// Check for new semantics in test results.
	for (var a = 0; a < actualLen; ++a) {
		var semantic = actual[a]

		if (expected.indexOf(semantic) === -1) {
			diff.push(util.colors.green(semantic))
		}
	}

	// Format the differences as a stylized string for printing.
	if (diff.length > 0) {
		return '  ' + diff.join('\n  ')
	}
}

/**
 * Prints the query as a header for parse or error output.
 *
 * @param {string} query The query print.
 */
function printQuery(query) {
	util.log('\nQuery:', util.colors.bold(query))
}

/**
 * Checks for ill-formed and duplicate tests in the test suite, and throws an exception if found.
 *
 * @param {Object[]} tests The tests to inspect.
 * @param {string} test.query The query to parse.
 * @param {Object} [test.topResult] The optional expected top result of the parse.
 * @param {string} test.topResult.text The expected display text of the parse's top result.
 * @param {string} test.topResult.semantic The expected semantic of the parse's top result.
 * @param {string} [test.note] The optional note regarding the test, printed when the test fails.
 * @param {string[]} test.semantics The unsorted expected semantics to compare (irrespective of order) to test output.
 * @param {string} testsFilePath The file path of the test suite for error reporting.
 */
function validateTests(tests, testsFilePath) {
	var testSchema = {
		// The query to parse.
		query: String,
		// The optional expected top result.
		topResult: { type: Object, optional: true },
		// The optional note regarding the test, printed when the test fails.
		note: { type: String, optional: true },
		// The unsorted expected semantics to compare (irrespective of order) to test output.
		semantics: { type: Array, arrayType: String },
	}

	var testTopResultSchema = {
		// The expected display text of the parse's top result.
		text: String,
		// The expected semantic of the parse's top result.
		semantic: String,
	}

	// Check ill-formed and duplicate tests.
	for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
		var test = tests[t]
		var testQuery = test.query

		// Surround test query with quotation marks so that `test` can be found in `testsFilePath`.
		var testQueryQuoted = '"' + testQuery + '"'

		if (util.illFormedOpts(testSchema, test) || (test.topResult && util.illFormedOpts(testTopResultSchema, test.topResult))) {
			util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, testQueryQuoted))
			throw 'Ill-formed test'
		}

		// Check for duplicate tests.
		for (var a = t + 1; a < testsLen; ++a) {
			if (testQuery === tests[a].query) {
				util.logError('Duplicate test:', util.stylize(testQuery))
				util.pathAndLineNumbersOf(testsFilePath, testQueryQuoted).forEach(function (path) {
					util.log('  ' + path)
				})
				throw 'Duplicate test'
			}
		}
	}
}