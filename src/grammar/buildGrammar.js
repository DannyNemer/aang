var g = require('./grammar')

require('./rules/user')
require('./rules/follow')
require('./rules/github/github')

var grammarPath = '../grammar.json'
g.createEditRules()
g.sortGrammar()
g.printRuleCount(grammarPath)
g.writeGrammarToFile(grammarPath)


/*
Do the absolute minimum, perfect it, then build up

Any additional complexity will rely on same foundation

Foolish to implement multiple things at once
*/