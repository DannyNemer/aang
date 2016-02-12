/**
 * Usage
 *   node buildGrammar [options]
 *
 * Description
 *   Generates and outputs the grammar containing the grammar rules, semantics, entities, and
 *   deletables.
 *
 * Options
 *   -o, --output  Write output to a given path/filename.            [string] [default: "grammar.json"]
 *   -t, --trees   Include the insertion rules' parse trees in the grammar.                   [boolean]
 *   -q, --quiet   Suppress non-error messages from output.                                   [boolean]
 *   -h, --help    Display this screen.                                                       [boolean]
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
			description: 'Write output to a given path/filename.',
			requiresArg: true,
			type: 'string',
			default: 'grammar.json',
		},
		't': {
			alias: 'trees',
			description: 'Include the insertion rules\' parse trees in the grammar.',
			type: 'boolean',
		},
		'q': {
			alias: 'quiet',
			description: 'Suppress non-error messages from output.',
			type: 'boolean',
		},
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.wrap(Math.min(yargs.terminalWidth(), 100))
	.argv

// Start a CPU profile if run via `devtool`, which runs the program inside Chrome DevTools.
var isDevtool = !!console.profile
if (isDevtool) {
	console.profile('buildGrammar')
}

// Modify stack trace format (when printing) to color function names and not surround file paths with parentheses.
util.prettifyStackTrace()

util.log('Building grammar' + (argv.trees ? ' with trees' : '') + '...')

// Instantiate grammar.
var g = require('./grammar')

// Add rules to grammar.
require('./rules/user/user')
require('./rules/github/github')
require('./rules/company/company')

// Add deletables to grammar.
require('./deletables')

// Convert the grammar's regex-style terminal symbols into rules that yield only uni-token terminal symbols. This is necessary to enable partial matches and deletions within what would otherwise be regex-style terminal symbols. Invoke this module before `createEditRules` because it adds `<empty>` rules to the grammar.
g.splitRegexTerminalSymbols()

// Remove ill-formed and unused instances of nonterminal symbols, nonterminal rules, entity categories, integer symbols, and semantics from the grammar. Invoke this module before `createEditRules` to avoid creating edit-rules from these components.
g.removeUnusedComponents(argv.quiet)

// Create grammar edit-rules derived from insertion and transposition costs, and empty strings in existing rules. Invoke this module after invoking `removeIllFormedRulesAndSyms()` to remove ill-formed nonterminal rules and symbols.
g.createEditRules()

// Remove the temporary rules and rule properties used for grammar generation from `ruleSets` to exclude them from the output grammar. Invoke this module function at the conclusion of grammar generation.
g.removeTempRulesAndProps(argv.trees)

// Sort the grammar's components. Invoke this method at the conclusion of grammar generation.
g.sortGrammar()

if (!argv.quiet) {
	// Print the number of rules and entities in the grammar.
	g.printStats(argv.output)
}

// Print values of any counters used during grammar generation.
util.countEndAll()

// If run via `devtool`, complete CPU profile and print report to the Profiles panel (inside Chrome DevTools).
if (isDevtool) {
	console.profileEnd('buildGrammar')
} else {
	// Write the grammar to a file.
	g.writeGrammarToFile(argv.output)
}