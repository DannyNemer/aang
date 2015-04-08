// If node-debug, pause for 1 second to attach debugger
// Option --debug-brk (or -b) does this, but broken in node v0.12
// Relies on breakpoints being set in inspector on previous run
while (/bin/.test(process.argv[0]) && process.uptime() < 1) {}
var util = require('../util.js')

var grammarPath = '../grammar.json'
var stateTablePath = './StateTable.js'
var parserNewPath = './Parser.js'
var parserOldPath = './util/ParserBestFirst.js'
var searchPath = './search.js'

var stateTable = buildStateTable()

var rl = require('readline').createInterface(process.stdin, process.stdout)

rl.prompt()
rl.on('line', function (line) {
	var query = line.trim()

	if (query && !runCommand(query)) {
		parse(query, K)
	}

	deleteModuleCache()

	rl.prompt()
})


function parse(query, K) {
	try {
		if (printQuery) console.log('\nquery:', query)
		var parser = new (require(parserPath))(stateTable)

		if (printTime) console.time('parse')
		parser.parse(query)
		if (printTime) console.timeEnd('parse')

		if (parser.startNode) {
			var search = require(searchPath)
			var trees = search.search(parser.startNode, K, printTrees)
			if (printTime) console.timeEnd('parse')
			if (printOutput) search.print(trees, printTrees, printCost)
		} else {
			console.log('Failed to reach start node')
		}

		if (printForest) parser.printForest()
		if (printStack) parser.printStack()
		// if (printTrees && parser.startNode) parser.printNodeGraph(parser.startNode)
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


var testQueries = [
	'repos I have liked',
	'people who like my repos liked by people who follow people I follow',
	'people who like repos',
	'repos been followers',
	'repos been followers people who like repos that I have',
	'repos people who like and created',
	'repos that have been created by people and like and I contributed-to',
	'repos that are repos',
	'my followers who are my followers',
	'my followers who are followers of followers of mine',
	'my followers who are followers of followers of mine who liked that repos contributed-to of mine',
	'repos',
	'people',
	'people who created my repos and my pull-requests',
	'people pull-requests like repos I like',
	'repos liked by followers of followers of mine',
	// 'followers of my followers who are followers of mine my followers who created repositories of my followers followers of mine who I follow like that are repos I contributed-to follow',
	// 'my followers who created pull-requests of mine created by my followers who created repositories of my followers followers of mine who I follow like that are repos I contributed-to I am mentioned-in'
	// 'my repos me people who follow my followers have been and', - BROKEN
]

var K = 10
var printTime = false
var printQuery = false
var printOutput = true
var printStack = false
var printForest = false
var printTrees = false
var printCost = false
var parserPath = parserNewPath

function runCommand(query) {
	var args = query.split(' ')
	if (args[0] === '-k') {
		if (!isNaN(args[1])) K = Number(args[1])
		console.log('K:', K)
	} else if (query === '-r') {
		if (!printOutput) console.time('test')

		testQueries.forEach(function (testQuery) {
			parse(testQuery, 100)
		})

		if (!printOutput) console.timeEnd('test')
	} else if (query === '-rb') {
		console.log('Rebuild grammar and state table:')
		// Rebuild grammar
		require('child_process').execFileSync('node', [ '../grammar/buildGrammar.js' ], { stdio: 'inherit' })
		// Remove previous grammar from cache
		deleteCache(grammarPath, '../semantics.json')
		// Rebuild state table
		stateTable = buildStateTable()
	} else if (query === '-d') {
		deleteModuleCache()
		console.log('Deleted cache of modules')
	} else if (query === '-st') {
		stateTable.print()
	} else if (query === '-t') {
		printTime = !printTime
		console.log('print time:', printTime)
	} else if (query === '-q') {
		printQuery = !printQuery
		console.log('print query:', printQuery)
	} else if (query === '-o') {
		printOutput = !printOutput
		console.log('print output:', printOutput)
	} else if (query === '-s') {
		printStack = !printStack
		console.log('print stack:', printStack)
	} else if (query === '-f') {
		printForest = !printForest
		console.log('print forest:', printForest)
	} else if (query === '-tr') {
		printTrees = !printTrees
		console.log('print trees:', printTrees)
	} else if (query === '-c') {
		printCost = !printCost
		console.log('print cost:', printCost)
	} else if (query === '-p') {
		parserPath = parserPath === parserNewPath ? parserOldPath : parserNewPath
		console.log('parser path:', parserPath)
	} else if (query === '-h') {
		console.log('Commands:')
		console.log('-k  K:', K)
		console.log('-r  run test queries')
		console.log('-rb rebuild grammar and state table')
		console.log('-st print state table')
		console.log('-d  delete module cache')
		console.log('-t  print time:', printTime)
		console.log('-q  print query:', printQuery)
		console.log('-o  print output:', printOutput)
		console.log('-s  print stack:', printStack)
		console.log('-f  print forest:', printForest)
		console.log('-tr print trees:', printTrees)
		console.log('-c  print cost:', printCost)
		console.log('-p  parser path:', parserPath)
	} else {
		return false
	}

	return true
}

function buildStateTable() {
	// Build state table
	var stateTable = new (require(stateTablePath))(require(grammarPath), '[start]')
	// Remove grammar from cache
	deleteCache(grammarPath)

	return stateTable
}

// Delete the cache of these modules, such that they are reloaded and their changes applied for the next parse
function deleteModuleCache() {
	deleteCache(parserNewPath, parserOldPath, searchPath, './BinaryHeap.js', '../grammar/Semantic.js')
}

function deleteCache() {
	Array.prototype.slice.call(arguments).forEach(function (filePath) {
		delete require.cache[require.resolve(filePath)]
	})
}