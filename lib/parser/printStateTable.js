/**
 * Usage
 *   node printStateTable [options]
 *
 * Description
 *   Prints the state table generated from the grammar.
 *
 * Options
 *   -h, --help  Display this screen.                                     [boolean]
 */

var util = require('../util')

require('yargs')
	.usage([
		util.colors.bold('Usage'),
		'  node $0 [options]',
		'',
		util.colors.bold('Description'),
		'  Prints the state table generated from the grammar.',
	].join('\n'))
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var stateTable = require('./buildStateTable.js')

// Use the `StateTable` returned by `buildStateTable()`, even though the semantic mapping is unneeded for printing, to handle functionality we might add in the future that affects printing.
stateTable.print()