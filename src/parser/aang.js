var Parser = require('./parser')
var BinaryHeap = require('./heap')
var matchTermSymbols = require('./matchTermSymbols')

// move to parser.js?
exports.parse = function (query, stateTable) {
	stateTable.print()
	var heap = new BinaryHeap()
	var bestTrees = []
	var matchedTermSymbols = matchTermSymbols(query)
	var queryLength = query.split(' ').length

	var parser = new Parser(stateTable.states)
	heap.push(parser)

	while (heap.size()) {
		parser = heap.pop()

		if (parser.startNode && parser.startNode.start === 0 && parser.startNode.end === queryLength) {
			bestTrees.push(parser.startNode)
			// if (bestTrees.length === K) break
		}

		if (parser.reds.length) {
			do {
				var startNode = parser.reduce()
			} while (!startNode && parser.reds.length && parser.reds[0].RHS.cost === 0)

			if (startNode) {
				parser.startNode = startNode
				parser.cost = startNode.totalCost
			} else {
				var cost = 0
				for (var vertTab = parser.vertTab, v = vertTab.length; v-- > 0;) {
					var vertex = vertTab[v]
					if (vertex.cost > cost) cost = vertex.cost
				}
				//remove loop

				parser.cost = cost
			}

			heap.push(parser)
		}

		else {
			var parserEndIdx = parser.inputTermMatch ? parser.inputTermMatch.end : 0

			for (var vertTab = parser.vertTab, v = vertTab.length; v-- > 0;) {
				var vertex = vertTab[v]

				// used to have seperate termshifts
				for (var shifts = vertex.state.termShifts, s = shifts.length; s-- > 0;) {
					var shift = shifts[s],
							termSymName = shift.sym.name,
							inputTermMatches = matchedTermSymbols[termSymName]

					if (inputTermMatches) {
						for (var t = inputTermMatches.length; t-- > 0;) {
							var inputTermMatch = inputTermMatches[t]
							if (parserEndIdx === inputTermMatch.start) {
								var newParser = new Parser(stateTable.states)

								var termSym = stateTable.symbolTable[termSymName]
								newParser.shift(shift, vertex, termSym, inputTermMatch.cost, inputTermMatch)

								newParser.cost = newParser.vertTab[0].cost

								heap.push(newParser)
							}
						}
					}
				}
			}
		}
	}

	bestTrees.forEach(parser.printString)
	bestTrees.forEach(parser.printTree)
}