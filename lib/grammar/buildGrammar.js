var util = require('../util')


/**
 * Generates the grammar and outputs to a file containing the grammar rules, semantics, entities, and deletables.
 */
util.tryCatchWrapper(function () {
	var g = require('./grammar')

	require('./rules/user')
	require('./rules/follow')
	require('./rules/github/github')

	var outputFilePath = '../aang.json'

	g.checkForUnusedComponents()
	g.createEditRules()
	// g.checkForAmbiguity({ treeSymsLimit: 14, findAll: false })
	g.sortGrammar()
	g.printRuleCount(outputFilePath)
	g.writeGrammarToFile(outputFilePath)
}, true)