// Execute within a `try` block
// Remove parentheses from error stack for iTerm open-file shortcut
require('../util').tryCatchWrapper(function () {
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

	/*
	Do the absolute minimum, perfect it, then build up

	Any additional complexity will rely on same foundation

	Foolish to implement multiple things at once
	*/
}, true)