/**
 * A command line application that prints the state table generated from the grammar.
 *
 * Usage: node printStateTable
 *
 * Description: Print the state table.
 *
 * Options:
 *   -h, --help  Display help.  [boolean]
 */

var argv = require('yargs')
	.usage(
		'Usage: node $0\n\n' +
		'Description: Print the state table.'
	)
	.help('h', 'Display help.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var stateTable = require('./buildStateTable.js')

// Use the `StateTable` returned by `buildStateTable()`, even though the semantic mapping is unneeded for printing, to handle functionality we might add in the future that affects printing.
stateTable.print()