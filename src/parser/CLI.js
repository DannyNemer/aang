// If node-debug, pause for 1 second to attach debugger
// Option --debug-brk (or -b) does this, but broken in node v0.12
// Relies on breakpoints being set in inspector on previous run
while (/bin/.test(process.argv[0]) && process.uptime() < 1) {}
var util = require('../util.js')

var grammarPath = '../grammar.json'
var semanticsPath = '../semantics.json'
var parserNewPath = './Parser.js'
var parserOldPath = './util/ParserBestFirst.js'
var searchPath = './search.js'

var semantics = null
var stateTable = buildStateTable()

var rl = require('readline').createInterface(process.stdin, process.stdout)

rl.prompt()
rl.on('line', function (line) {
	var query = line.trim()

	if (query && !runCommand(query)) {
		parse(query, K)
	}

	// If no '-t' arg (for 'time'), reload modules after for changes to take effect
	if (process.argv.indexOf('-t') === -1) {
		deleteModuleCache()
	}

	rl.prompt()
})


function parse(query, K) {
	util.tryCatchWrapper(function () {
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
	})
}


var testQueries = [
	'repos I have liked',
	'repos created by me and my followers',
	'repos I and my followers created',
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
	'repos liked by me and my followers',
	'repos liked by me and my followers and people who like repos liked by me and my followers',
	'my repos that are {language} repos',
	'my {language} repos',
	'repos that are written-in {language}',
	'my {language} repos that are written-in {language}',
	'issues assigned-to me I opened and am mentioned-in',
	'people who are assigned-to my issues and follow people who contributed-to repos I created and are mentioned-in pull-requests of mine',
	'people who are mentioned-in my issues and pull-requests',
	'people mentioned-in my issues and my pull-requests',
	'my {left-stop-words} repos',
	'my {left-stop-words} {language} repos',
	'my {language} {left-stop-words} repos',
	'my {left-stop-words} {language} {left-stop-words} repos',
	'my {left-stop-words} {left-stop-words} repos',
	'open issues',
	'issues that are open',
	'people assigned-to my closed issues'
	// 'followers of my followers who are followers of mine my followers who created repositories of my followers followers of mine who I follow like that are repos I contributed-to follow',
	// 'my followers who created pull-requests of mine created by my followers who created repositories of my followers followers of mine who I follow like that are repos I contributed-to I am mentioned-in'
	// 'my repos me people who follow my followers have been and', - BROKEN
]

var K = 7
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
		util.tryCatchWrapper(function () {
			require('child_process').execFileSync('node', [ '../grammar/buildGrammar.js' ], { stdio: 'inherit' })
		})
		// Rebuild state table
		stateTable = buildStateTable()
	} else if (query === '-d') {
		deleteModuleCache()
		console.log('Deleted cache of modules')
	} else if (query === '-st') {
		stateTable.print()
	} else if (query === '-ts') {
		console.log('test queries:')
		console.log(testQueries.join('\n'))
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
		console.log('-d  delete module cache')
		console.log('-st print state table')
		console.log('-ts print test queries')
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
	var grammar = require(grammarPath)
	semantics = require(semanticsPath)

	Object.keys(grammar).forEach(function (sym) {
		grammar[sym].forEach(function (rule) {
			if (rule.semantic) mapSemantic(rule.semantic)
			if (rule.insertedSemantic) mapSemantic(rule.insertedSemantic)
		})
	})

	// Build state table
	var stateTable = new (require('./StateTable.js'))(grammar, '[start]')
	// Remove grammar and semantics from cache
	util.deleteCache(grammarPath, semanticsPath)

	return stateTable
}

function mapSemantic(semanticArray) {
	semanticArray.forEach(function (semanticNode) {
		semanticNode.semantic = semantics[semanticNode.semantic.name]
		if (semanticNode.children) mapSemantic(semanticNode.children)
	})
}

// Delete the cache of these modules, such that they are reloaded and their changes applied for the next parse
function deleteModuleCache() {
	util.deleteCache(parserPath, searchPath, './BinaryHeap.js', '../grammar/Semantic.js')
}