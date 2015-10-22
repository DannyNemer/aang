/**
 * Usage
 *   node addTest <query>
 *
 * Description
 *   Parses <query> and finds the 50-best parse trees, creates a new test from the
 *   parse trees, and then saves the new test to the test suite.
 *
 *   Aborts if a test for <query> already exists, else outputs the new test for the
 *   user to confirm before saving it.
 *
 * Options
 *   -h, --help  Display this screen.                                     [boolean]
 */

var util = require('../util/util')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 <query>',
		'',
		util.colors.bold('Description'),
		'  Parses <query> and finds the 50-best parse trees, creates a new test from the parse trees, and then saves the new test to the test suite.',
		'',
		'  Aborts if a test for <query> already exists, else outputs the new test for the user to confirm before saving it.'
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.demand(1, 'Error: Missing input query')
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var query = argv._.join(' ')

var testsFilePath = './tests.json'
var tests = require(testsFilePath)

// Check if test for `query` already exists.
for (var t = 0, testsLen = tests.length; t < testsLen; ++t) {
	var test = tests[t]
	if (test.query === query) {
		util.logError('Test already exists:', test)
		process.exit(1)
	}
}

var readline = require('readline')
var Parser = require('../parse/Parser')
var pfsearch = require('../parse/pfsearch')

var stateTable = require('../parse/buildStateTable')
var parser = new Parser(stateTable)

// Parse query.
var startNode = parser.parse(query)
if (startNode) {
	// Find 50-best parse trees.
	var trees = pfsearch(startNode, 50)

	if (trees.length === 0) {
		util.logError('Failed to find legal parse trees.')
		process.exit(1)
	}
} else {
	util.logError('Failed to reach start node.')
	process.exit(1)
}

// Accumulate parse tree semantics.
var semanticSuggestions = []
for (var t = 0, treesLen = trees.length; t < treesLen; ++t) {
	var tree = trees[t]

	semanticSuggestions.push(tree.semanticStr)

	if (tree.disambiguation) {
		Array.prototype.apply(semanticSuggestions, tree.disambiguation)
	}
}

var topResult = trees[0]

// Create a new test.
var newTest = {
	query: query,
	// `false` if the input query matches the top result's display text, else the top result's display text.
	correction: query === topResult.text ? false : topResult.text,
	semantic: topResult.semanticStr,
	suggestions: semanticSuggestions,
}

// Prompt the user to confirm saving this test.
util.log(newTest, '')
var rl = readline.createInterface(process.stdin, process.stdout)
rl.question('Save this test? (y|n) ', function (answer) {
	if (/^y(es)?$/i.test(answer)) {
		// Save test to test suite and overwrite existing file.
		tests.push(newTest)
		util.writeJSONFile(testsFilePath, tests)
	} else {
		util.log('Test not saved.')
	}

	rl.close()
})