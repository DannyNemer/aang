/**
 * Usage: node printStateTable [options]
 *
 * Description: Prints the state table generated from the grammar.
 *
 * Options:
 *   -h, --help  Display this screen.                                     [boolean]
 */

var argv = require('yargs')
	.usage(
		'Usage: node $0 [options]\n\n' +
		'Description: Prints the state table generated from the grammar.'
	)
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var stateTable = require('./buildStateTable.js')

// Use the `StateTable` returned by `buildStateTable()`, even though the semantic mapping is unneeded for printing, to handle functionality we might add in the future that affects printing.
stateTable.print()