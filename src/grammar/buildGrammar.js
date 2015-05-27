var g = require('./grammar')

require('./rules/user')
require('./rules/follow')
require('./rules/github/github')

var outputPath = __dirname + '/../'

g.checkForUnusedSymbols()
g.createEditRules()
g.sortGrammar()
g.printRuleCount(outputPath)
g.writeGrammarToFile(outputPath)


/*
Do the absolute minimum, perfect it, then build up

Any additional complexity will rely on same foundation

Foolish to implement multiple things at once
*/