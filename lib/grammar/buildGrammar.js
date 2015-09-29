/**
 * Usage
 *   node buildGrammar [options]
 *
 * Description
 *   Generates and outputs the grammar containing the grammar rules, semantics, entities, and
 *   deletables.
 *
 * Options
 *   -o, --output  Specify a path/filename to write output.  [string] [default: "grammar.json"]
 *   -h, --help    Display this screen.                                               [boolean]
 */

var util = require('../util')
var yargs = require('yargs')

var argv = yargs
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]',
		'',
		util.colors.bold('Description'),
		'  Generates and outputs the grammar containing the grammar rules, semantics, entities, and deletables.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.options({
		'o': {
			alias: 'output',
			description: 'Specify a path/filename to write output.',
			requiresArg: true,
			type: 'string',
			default: 'grammar.json',
		},
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 92))
	.argv

util.tryCatchWrapper(function () {
	var g = require('./grammar')

	require('./rules/user')
	require('./rules/follow')
	require('./rules/github/github')

	require('./deletables')

	g.checkForUnusedComponents()
	g.createEditRules()
	// g.checkForAmbiguity({ treeSymsLimit: 14, findAll: false })
	g.sortGrammar()
	g.printRuleCount(argv.output)
	g.writeGrammarToFile(argv.output)
}, true)