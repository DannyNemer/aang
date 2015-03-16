// If node-debug, pause for 1 second to attach debugger
// Option --debug-brk (or -b) does this, but broken in node v0.12
// Relies on breakpoints being set in inspector on previous run
while (/bin/.test(process.argv[0]) && process.uptime() < 1) {}

var grammar = require('../grammar.json')
// var grammar = require('./original/gram0.json')

if (!grammar.startSymbol) {
	var nontermSyms = Object.keys(grammar)
	grammar.startSymbol = '[start]'
	grammar.terminals = []
	grammar.nonterminals = []

	nontermSyms.forEach(function (nontermSym) {
		grammar[nontermSym].forEach(function (rule) {
			var rules

			if (rule.terminal) {
				rules = grammar.terminals[nontermSym] || (grammar.terminals[nontermSym] = [])
			} else {
				rules = grammar.nonterminals[nontermSym] || (grammar.nonterminals[nontermSym] = [])
			}

			rules.push(rule)
		})
	})
}


var prevRSS = process.memoryUsage().rss
var stateTable = new (require('./StateTable'))(grammar)
console.log((process.memoryUsage().rss - prevRSS) / 1e6 + ' MB')
stateTable.print()

var readline = require('readline')
var rl = readline.createInterface(process.stdin, process.stdout)

rl.prompt()

rl.on('line', function (line) {
	var query = line.trim()
	console.log('query:', query)

	try {
		var parser = new (require('./Parser'))(stateTable)
		parser.parse(query)

		parser.printForest()
		parser.printStack()
		if (parser.startNode) parser.printGraph()
	} catch (e) {
		// Remove portion of stack trace specific to Node
		console.log()
		console.log(e.stack)
	}

	delete require.cache[require.resolve('./Parser')]

	rl.prompt()
})