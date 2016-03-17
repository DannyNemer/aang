/**
 * Usage
 *   node test [options]|[command] [<tag> ...]
 *
 * Description
 *   Parses the suite of test queries and checks output conforms to the test's expected values.
 *
 *   The test suite contains an array of objects with a query to parse and additional properties
 *   defining expected parse results.
 *
 *   For each provided <tag>, only runs tests or the provided command with that tag. If none, uses the
 *   entire test suite.
 *
 * Commands
 *   tests  List the input queries in the test suite.
 *   tags   List the tags in the test suite.
 *   count  Print the number of tests in the test suite.
 *
 * Options
 *   -k                        The maximum number of parse trees to find per test.        [default: 50]
 *   -q, --quiet               Suppress parse results from output.                            [boolean]
 *   -m, --mute                Suppress test results from output.                             [boolean]
 *   -z, --check-semantics     Compare all semantic results to each test's expected semantics.[boolean]
 *   -b, --benchmark           Benchmark each test's parse duration.                          [boolean]
 *   -c, --costs               Print the parse costs.                                         [boolean]
 *   -a, --ambiguity           Print instances of semantic ambiguity.                         [boolean]
 *   -t, --trees               Print the parse trees.                                         [boolean]
 *   -n, --tree-node-costs     Include in parse trees each node's path cost.                  [boolean]
 *   -r, --tree-token-ranges   Include in parse trees each node's token range.                [boolean]
 *   -s, --semantics           Print the semantic representation of each parse tree.
 *                                                                            [boolean] [default: true]
 *   -o, --object-semantics    Print object representations of the semantics.                 [boolean]
 *   -p, --parse-stack         Print the parse stack.                                         [boolean]
 *   -f, --parse-forest        Print an equational representation of the parse forest.        [boolean]
 *   -g, --parse-forest-graph  Print a graph representation of the parse forest.              [boolean]
 *   -h, --help                Display this screen.                                           [boolean]
 *
 * Examples
 *   node test -k=30 -cb  Finds the 30-best parse trees of each query in the test suite, prints the
 *                        duration of each parse, and includes the parse tree costs in the parse
 *                        results.
 *   node test -q         Finds the 50-best parse trees of each query in the test suite, but does not
 *                        print the parse results.
 */

var util = require('../util/util')

// Modify stack trace format (when printing) to color function names and not surround file paths with parentheses.
util.prettifyStackTrace()

// The collection of tests, each with a query and expected values for parse results.
var testsFilePath = require.resolve('./tests.json')
var tests = require(testsFilePath)
var testTagsUtil = require('./testTagsUtil')

var yargs = require('yargs')
var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]|[command] [<tag> ...]',
		'',
		util.colors.bold('Description'),
		'  Parses the suite of test queries and checks output conforms to the test\'s expected values.',
		'',
		'  The test suite contains an array of objects with a query to parse and additional properties defining expected parse results.',
		'',
		'  For each provided <tag>, only runs tests or the provided command with that tag. If none, uses the entire test suite.',
	].join('\n'))
	.updateStrings({
		'Commands:': util.colors.bold('Commands'),
		'Options:': util.colors.bold('Options'),
		'Examples:': util.colors.bold('Examples'),
	})
	.command('tests', 'List the input queries in the test suite.', function (yargs) {
		// Filter tests by tags passed as command line arguments, if any, before printing.
		filterTestsByTagArgs(yargs.argv, tests).forEach(function (test) {
			util.log(test.query)
			if (test.description) {
				util.log('  ' + util.colors.grey(test.description))
			}
		})
		process.exit()
	})
	.command('tags', 'List the tags in the test suite.', function (yargs) {
		testTagsUtil.printTags(tests)
		process.exit()
	})
	.command('count', 'Print the number of tests in the test suite.', function (yargs) {
		// Filter tests by tags passed as command line arguments, if any, before getting count.
		tests = filterTestsByTagArgs(yargs.argv, tests)
		util.log('Test count:', tests.length)
		process.exit()
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
		'm': {
			alias: 'mute',
			description: 'Suppress test results from output.',
			type: 'boolean',
		},
		'z': {
			alias: 'check-semantics',
			description: 'Compare all semantic results to each test\'s expected semantics.',
			type: 'boolean',
		},
		'b': {
			alias: 'benchmark',
			description: 'Benchmark each test\'s parse duration.',
			type: 'boolean',
		},
		'c': {
			alias: 'costs',
			description: 'Print the parse costs.',
			type: 'boolean',
		},
		'a': {
			alias: 'ambiguity',
			description: 'Print instances of semantic ambiguity.',
			type: 'boolean',
		},
		't': {
			alias: 'trees',
			description: 'Print the parse trees.',
			type: 'boolean',
		},
		'n': {
			alias: 'tree-node-costs',
			description: 'Include in parse trees each node\'s path cost.',
			type: 'boolean',
		},
		'r': {
			alias: 'tree-token-ranges',
			description: 'Include in parse trees each node\'s token range.',
			type: 'boolean',
		},
		's': {
			alias: 'semantics',
			description: 'Print the semantic representation of each parse tree.',
			type: 'boolean',
			default: true,
		},
		'o': {
			alias: 'object-semantics',
			description: 'Print object representations of the semantics.',
			type: 'boolean',
		},
		'p': {
			alias: 'parse-stack',
			description: 'Print the parse stack.',
			type: 'boolean',
		},
		'f': {
			alias: 'parse-forest',
			description: 'Print an equational representation of the parse forest.',
			type: 'boolean',
		},
		'g': {
			alias: 'parse-forest-graph',
			description: 'Print a graph representation of the parse forest.',
			type: 'boolean',
		},
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	.example('node $0 -k=30 -cb', 'Finds the 30-best parse trees of each query in the test suite, prints the duration of each parse, and includes the parse tree costs in the parse results.')
	.example('node $0 -q', 'Finds the 50-best parse trees of each query in the test suite, but does not print the parse results.')
	.check(function (argv, options) {
		if (isNaN(argv.k)) {
			throw 'TypeError: \'-k\' is not a number: ' + argv.k
		}

		return true
	})
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 100))
	.argv

// Check for ill-formed and duplicate tests in the test suite, and exit process with error code if found.
require('./validateTests')

// For each `<tag>` passed as a command line argument, only runs tests with that tag. If none, parse the entire test suite.
tests = filterTestsByTagArgs(argv, tests)

var mapTreesToSemantics = require('./mapTreesToSemantics')
var StateTable = require('../parse/StateTable')
var Parser = require('../parse/Parser')
var printParseResults = require('../parse/printParseResults')

// Generate a `StateTable` from the grammar and instantiate a `Parser`.
var stateTable = new StateTable(require('../grammar.json'))
var parser = new Parser(stateTable)

// Specify every test produce output.
var printEveryQuery = !argv.q || argv.b || argv.a || argv.f || argv.g

var testsLen = tests.length
var testsFailed = 0
var pathsCreated = 0

// Cycle through every test query.
for (var t = 0; t < testsLen; ++t) {
	var test = tests[t]

	try {
		parseTest(test)
	} catch (e) {
		util.log('\nFailing query:', test.query)
		throw e
	}
}

// Print test results.
if (!argv.mute) {
	util.log()
	if (testsFailed) {
		util.logError('Failed', testsFailed, 'of', testsLen, 'tests')
	} else {
		util.logSuccess('Passed', testsLen, testsLen === 1 ? 'test' : 'tests')
	}
	util.log()
}

util.log('Paths created:', pathsCreated)

// Print values of any counters used during the test.
util.countEndAll()


/**
 * Constructs a parse forest for `test.query`, and if it reaches the start node, then finds the k-best parse trees as well as their semantics and display texts. Checks if the parse results match `test`'s expected values.
 *
 * @private
 * @static
 * @param {Object} test The test to parse and check.
 */
function parseTest(test) {
	// Print the query above the parse results.
	if (printEveryQuery) printQuery(test.query)

	// Benchmark the duration of the parse and the parse forest search.
	if (argv.benchmark) util.time('parse')

	// Parse `test.query` and generate the k-best parse trees.
	var parseResults = parser.parse(test.query, argv.k, {
		buildTrees: argv.trees,
		printAmbiguity: argv.ambiguity,
	})

	if (argv.benchmark) util.timeEnd('parse')

	if (parseResults.trees) {
		// Sum the number of paths created from parsing the entire test sutie.
		pathsCreated += parseResults.pathCount

		if (parseResults.trees.length > 0) {
			// Check if parse results match the test's expected values.
			checkTestResults(test, parseResults.trees)

			if (!argv.quiet) {
				// Print the display text and semantics for the k-best parse trees.
				printParseResults(parseResults, {
					costs: argv.costs,
					trees: argv.trees,
					treeNodeCosts: argv.treeNodeCosts,
					treeTokenRanges: argv.treeTokenRanges,
					objectSemantics: argv.objectSemantics,
					noSemantics: !argv.semantics,
				})
			}
		} else {
			printTestFailure(test, 'Failed to find legal parse trees.')
			++testsFailed
		}

		// Print a graph representation of the parse forest.
		if (argv.parseForestGraph) parser.printNodeGraph(parser.startNode)
	} else {
		printTestFailure(test, 'Failed to reach start node.')
		++testsFailed
	}

	// Print the parse stack.
	if (argv.parseStack) parser.printStack()

	// Print an equational representation of the parse forest.
	if (argv.parseForest) parser.printForest()
}

/**
 * Checks if the parse results for `test.query` match `test`'s expected values.
 *
 * @private
 * @static
 * @param {Object} test The test to check.
 * @param {Object[]} trees The array of parse trees returned by the parse of `test.query`.
 */
function checkTestResults(test, trees) {
	var testPassed = false

	if (!argv.mute) {
		// Compare the top parse result to `test`'s expected display text and semantic.
		testPassed = checkTestTopResult(test, trees[0])
	}

	// Compare `trees`'s semantic results to `test`'s expected semantics, ignoring order.
	if (argv.checkSemantics) {
		testPassed = checkTestSemantics(test, trees) && testPassed
	}

	// Count failrue to pass all checks.
	if (!testPassed) ++testsFailed
}

/**
 * Compares a test's top parse result, `actualTopResult`, to `test`'s expected display text and semantic, and prints an error if the two do not match.
 *
 * @private
 * @static
 * @param {Object} test The test to check.
 * @param {Object} actualTopResult The first parse tree returned by the parse of `test.query`.
 * @returns {boolean} Returns `true` if the test passes, else `false`.
 */
function checkTestTopResult(test, actualTopResult) {
	var expectedTopResult = test.topResult

	if (expectedTopResult) {
		var failedTestDiffs = []

		// Check if the top parse's display text matches the expected value.
		if (expectedTopResult.text !== actualTopResult.text) {
			failedTestDiffs.push(util.diffStrings(expectedTopResult.text, actualTopResult.text))
		}

		// Check if the top parse's semantic matches the expected value.
		if (expectedTopResult.semantic !== actualTopResult.semanticStr) {
			// Temporarily convert strings from kebab case to camel case to prevent hyphens (which are word boundaries) from breaking up semantic function names when comparing.
			// Temporarily surround parentheses with spaces (treated as word boundaries) for comparing.
			var expected = util.kebabToCamelCase(expectedTopResult.semantic).replace(/[()]/g, ' $& ')
			var actual = util.kebabToCamelCase(actualTopResult.semanticStr).replace(/[()]/g, ' $& ')

			var diff = util.diffStrings(expected, actual)

			// Restore kebab case and parentheses.
			diff.expected = util.camelToKebabCase(diff.expected).replace(/ /g, '')
			diff.actual = util.camelToKebabCase(diff.actual).replace(/ /g, '')

			failedTestDiffs.push(diff)
		}

		if (failedTestDiffs.length > 0) {
			printTopResultTestFailure.apply(null, [ test ].concat(failedTestDiffs))
			return false
		}
	}

	// Check if parse incorrectly matches input (i.e., no edits).
	else if (test.query === actualTopResult.text) {
		printTestFailure(test, actualTopResult.text)
		return false
	}

	return true
}

/**
 * Prints an error message for a failed test.
 *
 * Invoked for failed parses and parses whose top result matches the input query when the test specifies is should not.
 *
 * @private
 * @static
 * @param {Object} test The failed test.
 * @param {string} actual The parse's actual value.
 */
function printTestFailure(test, actual) {
	if (argv.mute) {
		// Print failed parse error. (When `--mute` is provided, `printTestFailure()` is only called by failed parses.)
		if (!argv.quiet) util.logError(actual)
		return
	}

	var expected
	if (test.topResult) {
		// Align semantic with display text.
		expected = test.topResult.text + '\n                 ' + test.topResult.semantic
	} else {
		expected = '--not-input--'
	}

	// Print error message with expected and actual values.
	printTopResultTestFailure(test, { expected: expected, actual: actual })
}

/**
 * Prints an error message for a failed test with specified expected values.
 *
 * @private
 * @static
 * @param {Object} test The failed test.
 * @param {...Object} [diffs] The diffs to print.
 * @param {string} [diff.expected] The test's expected value.
 * @param {string} [diff.actual] The parse's actual value.
 */
function printTopResultTestFailure(test) {
	// Print query if no other output settings caused it to already print.
	if (!printEveryQuery) printQuery(test.query)

	// Print expected and actual parse results.
	for (var a = 1, argumentsLen = arguments.length; a < argumentsLen; ++a) {
		var testDiff = arguments[a]
		util.logError('Expected:', testDiff.expected)
		util.log('         Actual:', testDiff.actual)
	}

	// Print test description, if any.
	if (test.description) util.log(util.colors.yellow('Description') + ':', test.description)
}

/**
 * Compares `trees`'s semantic results to `test`'s expected semantics, ignoring order, and prints an error if the two do not match.
 *
 * @private
 * @static
 * @param {Object} test The test to check.
 * @param {Object[]} trees The array of parse trees returned by the parse of `test.query`.
 * @returns {boolean} Returns `true` if the test passes, else `false`.
 */
function checkTestSemantics(test, trees) {
	// Get the semantic strings and disambiguated semantics of `trees`.
	var actualSemantics = mapTreesToSemantics(trees)

	// Compare semantic sets.
	var diff = diffSemanticSets(test.semantics, actualSemantics)

	if (diff) {
		// Print query if no other output settings caused it to already print.
		if (!printEveryQuery) printQuery(test.query)

		// Print differences in the expected and actual semantic results.
		util.logError('Semantic results differ:')
		util.log(diff)

		return false
	}

	return true
}

/**
 * Compares two sets of semantic strings line by line, ignoring order, and stylizes the differences for printing.
 *
 * @private
 * @static
 * @param {string[]} expected The set of semantics to compare.
 * @param {Object[]} actual The other set of semantics to compare.
 * @returns {string|undefined} Returns a stylized string of the differences, if any, else `undefined`.
 */
function diffSemanticSets(expected, actual) {
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
 * @private
 * @static
 * @param {string} query The query print.
 */
function printQuery(query) {
	util.log('\nQuery:', util.colors.bold(query))
}

/**
 * Iterates over tests in `tests`, returning an array of all tests that contain a tag passed as a command line argument, if any.
 *
 * @private
 * @static
 * @param {Object} argv The command line arguments object returned by `yargs.argv`.
 * @param {Object[]} tests The tests to filter.
 * @returns {Object[]} Returns the filtered tests.
 */
function filterTestsByTagArgs(argv, tests) {
	// Remove command line arguments that are program commands.
	var argTags = argv._.filter(function (arg) {
		return [ 'tests', 'tags', 'count' ].indexOf(arg) === -1
	})

	if (argTags.length > 0) {
		tests = testTagsUtil.filterTestsByTags(tests, argTags)
		util.log('Tests with tags:', argTags.map(util.unary(util.stylize)).join(', '))
	}

	return tests
}