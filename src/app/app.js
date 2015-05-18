var http = require('http')
var fs = require('fs')
var port = process.env.PORT || 5000

http.createServer(function (req, res) {
	if (req.method === 'GET' && req.url === '/') {
		fs.readFile(__dirname + '/index.html', function (err, file) {
			res.end(err ? err + '\n' : file)
		})
	} else if (req.method === 'POST' && req.url === '/query') {
		var data = ''
		req.on('data', function (chunk) {
			data += chunk
		})

		req.on('end', function () {
			data = JSON.parse(data)

			var startTime = Date.now()
			var startNode = parser.parse(data.query)
			var response

			if (startNode) {
				var trees = forestSearch.search(startNode, Number(data.k))

				response = {
					parseTime: Date.now() - startTime
				}

				if (trees.length) {
					response.trees = trees.map(function (tree) {
						return {
							text: tree.text,
							semantic: tree.semanticStr,
							disambiguation: tree.disambiguation,
							cost: tree.cost
						}
					})
				} else {
					response.message = 'Failed to find legal parse trees'
				}
			} else {
				response = {
					parseTime: Date.now() - startTime,
					message: 'Failed to reach start node'
				}
			}

			res.end(JSON.stringify(response))
		})
	}
}).listen(port, function () {
	var netInterfaces = require('os').networkInterfaces()

	// Local
	if (netInterfaces.en0) {
		console.log('Server listening at http://' + netInterfaces.en0[1].address + ':' + port)
	}

	// DigitalOcean
	else {
		console.log('Server listening at http://' + netInterfaces.eth0[0].address + ':' + port)
	}
})


var util = require('../util.js')
var stateTable = buildStateTable()
var parser = new (require('../parser/Parser.js'))(stateTable)
var forestSearch = require('../parser/forestSearch.js')
var K = 7

function buildStateTable() {
	var grammarPath = '../grammar.json'
	var semanticsPath = '../semantics.json'
	var grammar = require(grammarPath)
	var semantics = require(semanticsPath)

	Object.keys(grammar).forEach(function (sym) {
		grammar[sym].forEach(function (rule) {
			if (rule.semantic) mapSemantic(semantics, rule.semantic)
			if (rule.insertedSemantic) mapSemantic(semantics, rule.insertedSemantic)
		})
	})

	// Build state table
	var stateTable = new (require('../parser/StateTable.js'))(grammar, '[start]')
	// Remove grammar and semantics from cache
	util.deleteCache(grammarPath, semanticsPath)

	return stateTable
}

function mapSemantic(semantics, semanticArray) {
	semanticArray.forEach(function (semanticNode) {
		semanticNode.semantic = semantics[semanticNode.semantic.name]
		if (semanticNode.children) mapSemantic(semantics, semanticNode.children)
	})
}