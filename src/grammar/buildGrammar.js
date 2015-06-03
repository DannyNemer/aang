var g = require('./grammar')

require('./rules/user')
require('./rules/follow')
require('./rules/github/github')

var outputFilePath = __dirname + '/../aang.json'

g.checkForUnusedSymbols()
g.checkForUnusedEntityCategories()
g.checkForUnusedSemantics()
g.createEditRules()
g.sortGrammar()
g.printRuleCount(outputFilePath)
g.writeGrammarToFile(outputFilePath)


/*
Do the absolute minimum, perfect it, then build up

Any additional complexity will rely on same foundation

Foolish to implement multiple things at once
*/