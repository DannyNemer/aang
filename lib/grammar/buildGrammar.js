/**
 * Usage
 *   node buildGrammar [options]
 *
 * Description
 *   Generates and outputs the grammar containing the grammar rules, semantics, entities, and
 *   deletables.
 *
 * Options
 *   -o, --output         Specify a path/filename to write output.   [string] [default: "grammar.json"]
 *   -t, --include-trees  Specify including the insertion rules' parse trees in the grammar.  [boolean]
 *   -q, --quiet          Suppress non-error messages from output.                            [boolean]
 *   -h, --help           Display this screen.                                                [boolean]
 */

var util = require('../util/util')
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
		't': {
			alias: 'include-trees',
			description: 'Specify including the insertion rules\' parse trees in the grammar.',
			type: 'boolean',
		},
		'q': {
			alias: 'quiet',
			description: 'Suppress non-error messages from output.',
			type: 'boolean',
		}
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 100))
	.argv

// Modify stack trace format (when printing) to color function names and not surround file paths with parentheses.
util.prettifyStackTrace()

util.log('Building grammar' + (argv.includeTrees ? ' with trees' : '') + '...')

// Instantiate empty grammar.
var g = require('./grammar')

// Add rules to grammar.
require('./rules/user')
require('./rules/follow')
require('./rules/github/github')

// Add deletables to grammar.
require('./deletables')

// Find instances of unused grammar components, and remove any unused nonterminal symbols from the grammar.
g.checkForUnusedComponents(argv.quiet)

// Split the grammar's regex-style terminal symbols into rules that yield only uni-token terminal symbols. This must be invoked before `createEditRules` because it adds instances of `<empty>` to the grammar.
g.splitRegexTerminalSymbols()

// Add new rules to the grammar based on edit properties in existing rules, remove null nonterminal rules, and check for semantic errors in the grammars.
// FIXME: Temporarily ignore ambiguity errors when creating edit rules.
g.createEditRules(argv.includeTrees, true)

// Sorts the grammar's components.
g.sortGrammar()

if (!argv.quiet) {
	// Prints the number of rules in the grammar.
	g.printRuleCount(argv.output)
}

// Write the grammar to a file.
g.writeGrammarToFile(argv.output)