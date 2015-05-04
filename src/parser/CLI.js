var util = require('../util.js')

var grammarPath = '../grammar.json'
var semanticsPath = '../semantics.json'
var parserNewPath = './Parser.js'
var parserOldPath = './util/ParserBestFirst.js'
var forestSearchPath = './forestSearch.js'

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

		if (printForest) parser.printForest()
		if (printStack) parser.printStack()

		if (parser.startNode) {
			var forestSearch = require(forestSearchPath)
			var trees = forestSearch.search(parser.startNode, K, printTrees)
			if (printTime) console.timeEnd('parse')
			if (printForestGraph) parser.printNodeGraph(parser.startNode)
			if (printOutput) forestSearch.print(trees, printCost, printTrees)
		} else {
			console.log('Failed to reach start node')
		}
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
	'repos that have been created by people and like and I contributed to',
	'repos that are repos',
	'my followers who are my followers', // intentionally fails
	'my followers who are followers of followers of mine',
	'my followers who are followers of followers of mine who liked that repos contributed to of mine',
	'repos',
	'people',
	'people who created my repos and my pull requests',
	'people pull requests like repos I like',
	'repos liked by followers of followers of mine',
	'repos liked by me and my followers',
	'repos liked by me and my followers and people who like {language} repos liked by me and my followers',
	'my repos that are {language} repos',
	'my {language} repos',
	'repos that are written in {language}',
	'my {language} repos that are written in {language}', // intentionally fails
	'issues assigned to me I opened and am mentioned in',
	'people who are assigned to my issues and follow people who contributed to repos I created and are mentioned in pull requests of mine',
	'people who are mentioned in my issues and pull requests',
	'people mentioned in my issues and my pull requests',
	'my {left-stop-words} repos',
	'my {left-stop-words} {language} repos',
	'my {language} {left-stop-words} repos',
	'my {left-stop-words} {language} {left-stop-words} repos',
	'my {left-stop-words} {left-stop-words} repos',
	'open issues',
	'issues that are open',
	'people assigned to my closed issues',
	'contributors to my repos and repos of mine',
	'likers of my repos',
	'creators of repos I like',
	'likers of repos I like and repos I contributed to',
	'creators of repos I like and repos I contributed to',
	'creators of repos I like and pull requests I am mentioned in', // unimplemented
	'openers of closed issues that mention people I and my followers follow',
	'people who are not followers of mine',
	'people who have not been followed by me',
	'issues that are not open',
	'people who are not followed by me',
	'people I do not follow', // unimplemented
	'people who follow me and do not follow {user}',
	'issues I am assigned to',
	'{left-stop-words} open issues that are never assigned to people who {pre-filter-stop-words} follow me',
	'repos of people who follow me',
	'followers of mine and people who follow me',
	'repos of mine and people who follow me',
	'repos I like or my followers likes',
	'repos I or my followers likes',
	'repos created by people I follow and {user} follows',
	'repos created by people I and {user} follow',
	'people who follow people',
	'people followed by myself',
	'people who follow I',
	'people me follows',
	'openers of my closed issues that mention me people who follow me and my followers follow follow',
	'repos people my followers follow like',
	'people people {user} follows follow',
	'repos people people {user} follows follow created {user} likes',
	'followers of my followers who are followers of mine my followers who created repositories of my followers followers of mine who I follow like that are repos I contributed to follow',
	'repos contributed to by me',
	'repos to by me', // intentionally wrong
	// 'repos danny by me', // intentionally wrong - requires implementation of deletions
	// 'repos danny by me danny', // intentionally wrong - requires implementation of deletions
	'repos liked contributed to by me', // intentionally wrong
	'repos by me', // should insert 'liked'
	'issues opened by me assigned to me', // transposition
	'issues with 22 comments',
	'issues assigned to me with 22 comments',
	'issues with 20 to 34 comments I opened',
	'issues that are with between 20 comments and 34 comments',
	'issues with 3 comments to 3 comments',
	'issues with 3 to 3 comments',
	'issues with less than 2 > 4 comments',
	'repos with between 22 and 23 likes',
	// 'pull requests of mine created by my followers' // reaches startNode but produces no legal trees
	// 'my followers who created pull requests of mine my followers who created repositories followers of mine mentioned in issues of my followers who I follow like that are repos created by me I contributed to am mentioned in that I am mentioned in'
	// 'my repos me people who follow my followers have been and', - BROKEN
]

var K = 7
var printTime = false
var printQuery = false
var printOutput = true
var printStack = false
var printForest = false
var printForestGraph = false
var printTrees = false
var printCost = false
var parserPath = parserNewPath

function runCommand(query) {
	var args = query.split(' ')
	if (args[0] === '-k') {
		if (!isNaN(args[1])) K = Number(args[1])
		console.log('K:', K)
	} else if (query === '-r') {
		if (printOutput) printQuery = true
		else console.time('test')

		testQueries.forEach(function (testQuery) {
			parse(testQuery, 50)
		})

		if (printOutput) printQuery = false
		else console.timeEnd('test')
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
	} else if (query === '-g') {
		printForestGraph = !printForestGraph
		console.log('print forest graph:', printForestGraph)
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
		console.log('-g  print forest graph:', printForestGraph)
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
	util.deleteCache(parserNewPath, parserOldPath, forestSearchPath, '../parser/StateTable.js', './BinaryHeap.js', '../grammar/semantic.js', './reduceForest.js')
}