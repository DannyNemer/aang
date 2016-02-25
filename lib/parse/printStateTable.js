/**
 * Usage
 *   node printStateTable <grammar-path> [options]
 *
 * Description
 *   Prints an equational representation of the state table generated from the
 *   grammar at <grammar-path>.
 *
 * Options
 *   -x, --suppress-state-indexes  Suppress state indexes from output. This is
 *                                 useful for comparing output for different
 *                                 grammar builds.                        [boolean]
 *   -h, --help                    Display this screen.                   [boolean]
 */

var util = require('../util/util')
var yargs = require('yargs')

var argv = yargs
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
	.options({
		'x': {
			alias: 'suppress-state-indexes',
			description: 'Suppress state indexes from output. This is useful for comparing output for different grammar builds.',
			type: 'boolean',
		},
	})
	.help('h', 'Display this screen.').alias('h', 'help')
	// Fail on unrecognized arguments.
	.strict()
	.argv

var StateTable = require('./StateTable')

// Generate a `StateTable` from the grammar and print its equational representation.
var stateTable = new StateTable(require(argv._[0]))
stateTable.print(argv.suppressStateIndexes)