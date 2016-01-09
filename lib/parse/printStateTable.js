/**
 * Usage
 *   node printStateTable <grammar-path> [options]
 *
 * Description
 *   Prints an equational representation of the state table generated from the
 *   grammar at <grammar-path>.
 *
 * Options
 *   -h, --help  Display this screen.                                     [boolean]
 */

var util = require('../util/util')

var argv = require('yargs')
	.usage([
		util.colors.bold('Usage'),
		'  node $0 <grammar-path> [options]',
		'',
		util.colors.bold('Description'),
		'  Prints an equational representation of the state table generated from the grammar at <grammar-path>.',
	].join('\n'))
	.demand(1, 'Error: Missing grammar path')
	.updateStrings({
		'Options:': util.colors.bold('Options'),
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var StateTable = require('./StateTable')

// Generate a `StateTable` from the grammar and print its equational representation.
var stateTable = new StateTable(require(argv._[0]))
stateTable.print()