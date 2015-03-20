// If node-debug, pause for 1 second to attach debugger
// Option --debug-brk (or -b) does this, but broken in node v0.12
// Relies on breakpoints being set in inspector on previous run
while (/bin/.test(process.argv[0]) && process.uptime() < 1) {}

var grammar = require('../grammar.json')

var prevRSS = process.memoryUsage().rss
var stateTable = new (require('./StateTable'))(grammar, '[start]')
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

		// console.time('parse')
		parser.parse(query)
		// console.timeEnd('parse')

		parser.printForest()
		parser.printStack()
		if (parser.startNode) parser.printNodeGraph(parser.startNode)
	} catch (e) {
		// Remove portion of stack trace specific to Node
		console.log()
		console.log(e.stack)
	}

	delete require.cache[require.resolve('./Parser')]

	rl.prompt()
})