var g = require('./grammar')

require('./rules/user')

var grammarPath = '../../grammar.json'
g.createEditRules()
g.sortGrammar()
g.printRuleCount(grammarPath)
g.writeGrammarToFile(grammarPath)


/*
Do the absolute minimum, then build up

Any additional complexity will rely on same foundation

Foolish to implement multiple things at once
*/