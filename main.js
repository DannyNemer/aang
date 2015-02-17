var g = require('./src/grammar')

require('./src/grammar/user')

var grammarPath = './grammar.json'
g.printRuleCount(grammarPath)
g.writeGrammarToFile(grammarPath)