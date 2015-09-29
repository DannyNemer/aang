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
 *   -o, --output              Print the parse results.                   [boolean] [default: true]
 *   -c, --print-costs         Print the parse costs.                                     [boolean]
 *   -t, --print-trees         Construct and print the parse trees.                       [boolean]
 *   -s, --print-stack         Print the parse stacks.                                    [boolean]
 *   -f, --print-forest        Print equational representations of the parse forests.     [boolean]
 *   -g, --print-forest-graph  Print graph representations of the parse forests.          [boolean]
 *   -h, --help                Display this screen.                                       [boolean]
 *
 * Examples:
 *   node test -k=30 -cb    Finds the 30-best parse trees of each query in the test suite, prints
 *                          the duration of each parse, and includes the parse tree costs in the
 *                          parse results.
 *   node test --no-output  Finds the 50-best parse trees of each query in the test suite, but does
 *                          not print the parse results.
 */

var util = require('../util.js')
var yargs = require('yargs')

var argv = yargs
	.usage(
		util.colors.bold('Usage') + '\n' +
		'  node $0 [options]\n\n' +
		util.colors.bold('Description') + '\n' +
		'  Parses the suite of test queries and checks output conforms to the test\'s specifications.\n\n' +
		'  The test suite contains an array of `Object`s with a `query` to parse and the property `exactMatch` defining whether the parse\'s first result\'s display text should match `query`.'
	)
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
		'o': {
			alias: 'output',
			description: 'Print the parse results.',
			type: 'boolean',
			default: true,
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
	.example('node $0 --no-output', 'Finds the 50-best parse trees of each query in the test suite, but does not print the parse results.')
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
var willOutput = argv.b || argv.o || argv.t || argv.s || argv.f || argv.g

// Cycle through every test query.
for (var t = 0; t < testsLen; ++t) {
	var test = tests[t]
	var query = test.query

	// Print the query above its parse results.
	if (willOutput) util.log((t ? '\n' : '') + 'query:', util.colors.bold(query))

	var trees = parse(query)

	if (test.exactMatch) {
		if (trees && trees.length > 0) {
			var actual = trees[0].text

			// Parse incorrectly rejects input (i.e., contains edits).
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
		} else {
			util.logError('Expected:', query)
			util.log('         Actual:', null)
		}
	} else if (trees && trees.length > 0) {
		var actual = trees[0].text

		// Parse incorrectly accepts input (i.e., no edits).
		if (query === actual) {
			util.logError('Expected:', '--not-input--')
			util.log('         Actual:', query)
		}
	}
}

// Print values of any counters used during the test.
util.countEndAll()


/**
 * Constructs a parse forest for `query`, and if it reaches the start node, then finds the k-best parse trees as well as their semantics and display texts.
 *
 * @param {string} query The query to parse.
 * @returns {Object[]|undefined} Returns the parse trees if the parse reaches the start node, else `undefined`.
 */
function parse(query) {
	// Benchmark the duration of the parse and the parse forest search.
	if (argv.benchmark) util.time('parse')

	// Construct the parse forest for `query`.
	var startNode = parser.parse(query)

	if (argv.benchmark) util.timeEnd('parse')

	if (startNode) {
		// Search the parse forest for the k-best parse trees.
		var trees = forestSearch.search(startNode, argv.k, argv.printTrees, argv.output)

		if (argv.benchmark) util.timeEnd('parse')

		// Include stack and forest printing in both `if...else` blocks to avoid printing before the second `util.timeEnd()` invocation.
		if (argv.printForest) parser.printForest(startNode)
		if (argv.printStack) parser.printStack()
		if (argv.printForestGraph) parser.printNodeGraph(startNode)

		if (argv.output) {
			if (trees.length > 0) {
				forestSearch.print(trees, argv.printCosts, argv.printTrees)
			} else {
				util.logError('Failed to find legal parse trees.')
			}
		}

		return trees
	} else {
		if (argv.printForest) parser.printForest()
		if (argv.printStack) parser.printStack()

		if (argv.output) util.logError('Failed to reach start node.')
	}
}