// If node-debug, pause for 1 second to attach debugger
// Option --debug-brk (or -b) does this, but broken in node v0.12
// Relies on breakpoints being set in inspector on previous run
while (/bin/.test(process.argv[0]) && process.uptime() < 1) {}
var util = require('../util.js')

var grammar = require('../grammar.json')
var prevRSS = process.memoryUsage().rss
var stateTable = new (require('./StateTable'))(grammar, '[start]')
// console.log((process.memoryUsage().rss - prevRSS) / 1e6 + ' MB')
// stateTable.print()

var rl = require('readline').createInterface(process.stdin, process.stdout)

rl.prompt()
rl.on('line', function (line) {
	var query = line.trim()

	if (query && !runCommand(query)) {
		parse(query)
	}

	deleteCache(parserNewPath, parserOldPath, searchPath, './BinaryHeap.js')

	rl.prompt()
})

function parse(query) {
	try {
		console.log('query:', query)
		var parser = new (require(parserPath))(stateTable)

		if (printTime) console.time('parse')
		parser.parse(query)
		if (printTime) console.timeEnd('parse')

		if (parser.startNode) {
			var search = require(searchPath)
			var trees = search.search(parser.startNode, K)
			if (printTime) console.timeEnd('parse')
			if (printOutput) search.print(trees, printGraph)
		} else {
			console.log('Failed to reach start node')
		}

		if (printForest) parser.printForest()
		if (printStack) parser.printStack()
		// if (printGraph && parser.startNode) parser.printNodeGraph(parser.startNode)
	} catch (e) {
		console.log()

		if (e.stack) {
			// Remove parentheses from stack for iTerm open-file shortcut
			e.stack.split('\n').forEach(function (stackLine) {
				console.log(stackLine.replace(/[()]/g, ''))
			})
		} else {
			console.log(e)
		}
	}
}


var parserNewPath = './Parser.js'
var parserOldPath = './util/ParserBestFirst.js'
var searchPath = './search.js'

var testQueries = [
	'people who like my repos liked by people who follow people I follow',
	'repos I have liked',
	'my repos me people who follow my followers have been and',
]

var K = 10
var printTime = false
var printOutput = true
var printStack = false
var printForest = false
var printGraph = false
var parserPath = parserNewPath

function runCommand(query) {
	var args = query.split(' ')
	if (args[0] === '-k') {
		if (!isNaN(args[1])) K = Number(args[1])
		console.log('K:', K)
	} else if (query === '-r') {
		var prevK = K
		K = 500
		testQueries.forEach(parse)
		K = prevK
	} else if (query === '-t') {
		printTime = !printTime
		console.log('print time:', printTime)
	} else if (query === '-o') {
		printOutput = !printOutput
		console.log('print output:', printOutput)
	} else if (query === '-s') {
		printStack = !printStack
		console.log('print stack:', printStack)
	} else if (query === '-f') {
		printForest = !printForest
		console.log('print forest:', printForest)
	} else if (query === '-g') {
		printGraph = !printGraph
		console.log('print graph:', printGraph)
	} else if (query === '-p') {
		parserPath = parserPath === parserNewPath ? parserOldPath : parserNewPath
		console.log('parser path:', parserPath)
	} else if (query === '-h') {
		console.log('Settings:')
		console.log('-k  K:', K)
		console.log('-r  run test queries')
		console.log('-t  print time:', printTime)
		console.log('-o  print output:', printOutput)
		console.log('-s  print stack:', printStack)
		console.log('-f  print forest:', printForest)
		console.log('-g  print graph:', printGraph)
		console.log('-p  parser path:', parserPath)
	} else {
		return false
	}

	return true
}

// Remove files from cache so may be reloaded with changes
function deleteCache() {
	Array.prototype.slice.call(arguments).forEach(function (filePath) {
		delete require.cache[require.resolve(filePath)]
	})
}