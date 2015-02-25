var StateTable = require('./stateTable')

// If node-debug, pause for 1 second to attach debugger
// Option --debug-brk (or -b) does this, but broken in node v0.12
// Relies on breakpoints being set in inspector on previous run
while (/bin/.test(process.argv[0]) && process.uptime() < 1) {}

var grammar = require('../../grammar.json')
var stateTable = new StateTable(grammar, '[start]')

var readline = require('readline')
var rl = readline.createInterface(process.stdin, process.stdout)

rl.prompt()

rl.on('line', function (line) {
	var query = line.trim()
	console.log('query:', query)

	try {
		require('./aang').parse(query, stateTable)
	} catch (e) {
		// Remove portion of stack trace specific to Node
		console.log()
		console.log(e.stack)
	}

	delete require.cache[require.resolve('./aang')]
	delete require.cache[require.resolve('./parser')]
	delete require.cache[require.resolve('./matchTermSymbols')]

	rl.prompt()
})