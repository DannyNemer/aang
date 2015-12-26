/**
 * Usage
 *   node test [options] [<tag> ...]
 *
 * Description
 *   Parses the suite of test queries and checks output conforms to the test's expected values.
 *
 *   The test suite contains an array of objects with a query to parse and additional properties
 *   defining expected parse results.
 *
 *   For each provided <tag>, only runs tests with that tag. If none, parses the entire test suite.
 *
 * Options
 *   -k                             The maximum number of parse trees to find per test.   [default: 50]
 *   -q, --quiet                    Suppress parse results from output.                       [boolean]
 *   -m, --mute                     Suppress test results from output.                        [boolean]
 *   -s, --check-semantics          Check all semantic results of each test.                  [boolean]
 *   -b, --benchmark                Benchmark the duration of each test.                      [boolean]
 *   -c, --print-costs              Print the parse costs.                                    [boolean]
 *   -a, --print-ambiguity          Print instances of semantic ambiguity.                    [boolean]
 *   -t, --print-trees              Construct and print the parse trees.                      [boolean]
 *   -n, --print-tree-node-costs    Include in parse trees each node's path cost.             [boolean]
 *   -r, --print-tree-token-ranges  Include in parse trees each node's token range.           [boolean]
 *   -o, --print-object-semantics   Print object representations of the semantics.            [boolean]
 *   -p, --print-parse-stack        Print the parse stacks.                                   [boolean]
 *   -f, --print-forest             Print equational representations of the parse forests.    [boolean]
 *   -g, --print-forest-graph       Print graph representations of the parse forests.         [boolean]
 *   -l, --list-tags                List the tags used in the test suite.                     [boolean]
 *   -h, --help                     Display this screen.                                      [boolean]
 *
 * Examples
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
		'  node $0 [options] [<tag>...]',
		'',
		util.colors.bold('Description'),
		'  Parses the suite of test queries and checks output conforms to the test\'s expected values.',
		'',
		'  The test suite contains an array of objects with a query to parse and additional properties defining expected parse results.',
		'',
		'  For each provided <tag>, only runs tests with that tag. If none, parses the entire test suite.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
		'Examples:': util.colors.bold('Examples'),
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
		's': {
			alias: 'check-semantics',
			description: 'Check all semantic results of each test.',
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
		'a': {
			alias: 'print-ambiguity',
			description: 'Print instances of semantic ambiguity.',
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
		'o': {
			alias: 'print-object-semantics',
			description: 'Print object representations of the semantics.',
			type: 'boolean',
		},
		'p': {
			alias: 'print-parse-stack',
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
		'l': {
			alias: 'list-tags',
			description: 'List the tags used in the test suite.',
			type: 'boolean',
		}
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
	.wrap(Math.min(yargs.terminalWidth(), 100))
	.argv

// Modify stack trace format (when printing) to color function names and not surround file paths with parentheses.
util.prettifyStackTrace()

// The collection of test cases, each with a query and expected values for parse results.
var testsFilePath = require.resolve('./tests.json')
var tests = require(testsFilePath)
var testTagsUtil = require('./testTagsUtil')

if (argv.listTags) {
	// Print a list of all tags found in the test suite.
	testTagsUtil.listTagsInTests(tests)
	process.exit()
}

// Check for ill-formed and duplicate tests in the test suite, and exit process if found.
validateTests(tests, testsFilePath)

var mapTreesToSemantics = require('./mapTreesToSemantics')
var Parser = require('../parse/Parser')
var pfsearch = require('../parse/pfsearch')
var printParseResults = require('../parse/printParseResults')

// Generate a `StateTable` from the grammar and instantiate a `Parser`.
var stateTable = require('../parse/buildStateTable')('../grammar.json')
var parser = new Parser(stateTable)

// For each provided <tag>, only runs tests with that tag. If none, parse the entire test suite.
var argTags = argv._
if (argTags.length > 0) {
	tests = testTagsUtil.filterTestsByTag(tests, argTags)
	util.log('Parsing tests with the following tags:', argTags.map(util.stylize).join(' '))
}

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
	var trees = parser.parse(test.query, argv.k, {
		buildTrees: argv.printTrees,
		printStats: !argv.quiet || argv.benchmark,
		printAmbiguity: argv.printAmbiguity,
	})

	if (argv.benchmark) util.timeEnd('parse')

	if (trees) {
		// Sum the number of paths created from parsing the entire test sutie.
		pathsCreated += trees.pathCount

		if (trees.length > 0) {
			// Check if parse results match the test's expected values.
			checkTestResults(test, trees)

			if (!argv.quiet) {
				// Print the display text and semantics for the k-best parse trees.
				printParseResults(trees, {
					stats: !argv.quiet || argv.benchmark,
					costs: argv.printCosts,
					trees: argv.printTrees,
					treeNodeCosts: argv.printTreeNodeCosts,
					treeTokenRanges: argv.printTreeTokenRanges,
					objectSemantics: argv.printObjectSemantics,
				})
			}
		} else {
			printTopResultTestFailure(test, 'Failed to find legal parse trees.')
			++testsFailed
		}

		// Print a graph representation of the parse forest.
		if (argv.printForestGraph) parser.printNodeGraph(parser.startNode)
	} else {
		printTopResultTestFailure(test, 'Failed to reach start node.')
		++testsFailed
	}

	// Print the parse stack.
	if (argv.printParseStack) parser.printStack()

	// Print an equational representation of the parse forest.
	if (argv.printForest) parser.printForest()
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
	if (!argv.mute) {
		// Compare the top parse result to `test`'s expected display text and semantic.
		var testPassed = checkTestTopResult(test, trees[0])
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
	var testPassed = true
	var expectedTopResult = test.topResult

	if (expectedTopResult) {
		// Check if the top parse's display text matches the expected value.
		if (expectedTopResult.text !== actualTopResult.text) {
			var diff = util.diffStrings(expectedTopResult.text, actualTopResult.text)
			printTopResultTestFailure(test, diff.expected, diff.actual)
			testPassed = false
		}

		// Check if the top parse's semantic matches the expected value.
		if (expectedTopResult.semantic !== actualTopResult.semanticStr) {
			// Temporarily convert strings from kebab case to camel case to prevent hyphens (which are word boundaries) from breaking up semantic function names when comparing.
			// Temporarily surround parentheses with spaces (treated as word boundaries) for comparing.
			var expected = util.kebabToCamelCase(expectedTopResult.semantic).replace(/[()]/g, ' $& ')
			var actual = util.kebabToCamelCase(actualTopResult.semanticStr).replace(/[()]/g, ' $& ')

			var diff = util.diffStrings(expected, actual)

			// Restore kebab case and parentheses.
			expected = util.camelToKebabCase(diff.expected).replace(/ /g, '')
			actual = util.camelToKebabCase(diff.actual).replace(/ /g, '')

			printTopResultTestFailure(test, expected, actual)
			testPassed = false
		}
	}

	// Check if parse incorrectly matches input (i.e., no edits).
	else if (test.query === actualTopResult.text) {
		printTopResultTestFailure(test, actualTopResult.text)
		testPassed = false
	}

	return testPassed
}

/**
 * Prints an error message for a test's failed match to the expected top parse result.
 *
 * @private
 * @static
 * @param {Object} test The test's input query.
 * @param {string} [expected] The test's expected value. If omitted, will be generated from `test`.
 * @param {string} actual The actual value.
 */
function printTopResultTestFailure(test, expected, actual) {
	if (argv.mute) {
		// Print parse errors. (When `--mute` is provided, `printTopResultTestFailure()` is only called by failed parses.)
		if (!argv.quiet) util.logError(expected)
		return
	}

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
	if (!printEveryQuery) printQuery(test.query)

	// Print expected and actual parse results.
	util.logError('Expected:', expected)
	util.log('         Actual:', actual)

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
	var diff = diffSemantics(test.semantics, actualSemantics)

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
 * @private
 * @static
 * @param {string} query The query print.
 */
function printQuery(query) {
	util.log('\nQuery:', util.colors.bold(query))
}

/**
 * Checks for ill-formed and duplicate tests in the test suite, and exits process with an error code of `1` if found.
 *
 * @private
 * @static
 * @param {Object[]} tests The tests to inspect.
 * @param {string} test.query The query to parse.
 * @param {string} [test.description] The optional test description.
 * @param {string[]} [test.tags] The optional test tags.
 * @param {Object} [test.topResult] The optional expected top result of the parse. When omitted, specifies the top parse result should not match `query`.
 * @param {string} test.topResult.text The expected display text of the parse's top result.
 * @param {string} test.topResult.semantic The expected semantic of the parse's top result.
 * @param {string[]} test.semantics The unsorted expected semantics to compare (irrespective of order) to test output.
 * @param {string} testsFilePath The file path of the test suite for error reporting.
 */
function validateTests(tests, testsFilePath) {
	var testSchema = {
		// The query to parse.
		query: { type: String, required: true },
		// The optional test description.
		description: String,
		// The optional test tags.
		tags: { type: Array, arrayType: String, allowEmpty: true, required: true },
		// The optional expected top result.
		topResult: Object,
		// The unsorted expected semantics to compare (irrespective of order) to test output.
		semantics: { type: Array, arrayType: String, allowEmpty: true, required: true },
	}

	var testTopResultSchema = {
		// The expected display text of the parse's top result.
		text: { type: String, required: true },
		// The expected semantic of the parse's top result.
		semantic: { type: String, required: true },
	}

	// Check ill-formed and duplicate tests.
	for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
		var test = tests[t]
		var testQuery = test.query

		// Surround test query with quotation marks so that `test` can be found in `testsFilePath`.
		var testQueryQuoted = '"query": "' + testQuery + '"'

		if (util.illFormedOpts(testSchema, test) || (test.topResult && util.illFormedOpts(testTopResultSchema, test.topResult))) {
			util.log('  ' + util.firstPathAndLineNumberOf(testsFilePath, testQueryQuoted))
			process.exit(1)
		}

		// Check for duplicate tests.
		for (var a = t + 1; a < testsLen; ++a) {
			if (testQuery === tests[a].query) {
				util.logError('Duplicate test:', util.stylize(testQuery))
				util.pathAndLineNumbersOf(testsFilePath, testQueryQuoted).forEach(function (path) {
					util.log('  ' + path)
				})
				process.exit(1)
			}
		}
	}
}