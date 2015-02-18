var g = require('./src/grammar')

require('./src/grammar/user')

var grammarPath = './grammar.json'
g.printRuleCount(grammarPath)
g.writeGrammarToFile(grammarPath)


/*
TODO:
1) Move aang to seperate project
		- Transfer git
		- Rewrite commit statements: short, imperative, capitalized first letter
2) Make grammar with blank rules removed

Do the absolute minimum, then build up
- Any additional complexity will rely on same foundation - foolish to try to capture multiple things at once
- No display text correction, no edit rules
*/