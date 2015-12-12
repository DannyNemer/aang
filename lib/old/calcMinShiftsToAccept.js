var util = require('../util/util')
var Parser = require('./Parser')

/**
 * A modified implementation of `Parser`, used during `StateTable` generation, that calculates the minimum number of additional shifts needed at each shift and reduction to reach the state table's accepting state.
 *
 * This enables discarding nodes in `Parser` we know fail because too few input tokens remain. Also helps identify when a sequence of terminal nodes is impossible and requires a deletion.
 *
 * Requires that shifts to not be a map to each next state, but rather an object to which to assign `minShiftsToAccept`.
 *
 * @param {Object[]} states The `StateTable` states with the shifts and reductions to assign `minShiftsToAccept`.
 * @param {Boolean} loadCache Specify loading the `minShiftsToAccept` values from a cache file, otherwise use 3.5 s to calculate the values.
 */
module.exports = function (states, loadCache) {
	var cachePath = '/Users/Danny/Dropbox/Projects/aang/lib/parse/states.json'

	if (loadCache) {
		loadFromFile(states, cachePath)
	} else {
		util.time('Calculate minShiftsToAccept')

		var parser = new MinShiftsParser
		parser.calcMinShiftsToAccept(states)

		writeToFile(states, cachePath)

		util.timeEnd('Calculate minShiftsToAccept')
	}
}

function MinShiftsParser() {}

/**
 * Performs every shift and reduce operation in the state table. Determines the minimum number of additional shifts needed at each shift and reduction to reach the accepting state. Exits when no new minimum values are found.
 */
MinShiftsParser.prototype.calcMinShiftsToAccept = function (states) {
	this.position = 0

	this.reds = []
	var redsIdx = 0

	var nodeTabs = []

	var vertTabs = []
	this.vertTab = vertTabs[this.position] = []

	this.addVertex(states[0])

	// Loop until no longer finding new values for `minShiftsToAccept`.
	while (true) {
		var oldVertTab = vertTabs[this.position]

		this.nodeTab = nodeTabs[this.position] = []
		this.position++
		this.vertTab = vertTabs[this.position] = []

		for (var v = 0, oldVertTabLen = oldVertTab.length; v < oldVertTabLen; ++v) {
			var vertex = oldVertTab[v]
			var shifts = vertex.state.shifts

			var symIndexes = Object.keys(shifts)
			for (var i = 0, symIndexesLen = symIndexes.length; i < symIndexesLen; ++i) {
				var symIndex = Number(symIndexes[i])

				var sub = {
					start: this.position,
					size: 1,
					shifts: [ shifts[symIndex] ],
					shiftSymIndex: symIndex,
					stateIndex: states.indexOf(vertex.state),
				}

				var node = this.addSub(symIndex, sub)

				this.addNode(node, vertex)
			}
		}

		while (redsIdx < this.reds.length) {
			var redObj = this.reds[redsIdx++]
			var zNode = redObj.zNode
			var stateReds = redObj.reds
			for (var r = 0, redsLens = stateReds.length; r < redsLens; ++r) {
				this.reduce(zNode, stateReds[r])
			}
		}

		// Determine the minimum number of additional shifts needed at each shift and reduction to reach the accepting state. Exit when no new minimum values are found.
		for (var v = this.vertTab.length - 1; v > -1; --v) {
			var vertex = this.vertTab[v]
			if (vertex.state.isFinal) {
				var startNode = vertex.zNodes[0].node
				if (!assignSize(startNode, startNode.size)) {
					return
				}

				break
			}
		}
	}
}

/**
 * Determines the minimum number of additional shifts needed at each shift and reduction to reach the accepting state.
 *
 * @returns {Boolean} Returns `true` if assigned a new `minShiftsToAccept`, else `false` and `calcMinShiftsToAccept` is complete.
 */
function assignSize(node, size) {
	var foundNew = false

	var subs = node.subs
	for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
		var sub = subs[s]

		var shiftsToAccept = size - sub.start

		do {
			var red = sub.red
			if (red && (red.minShiftsToAccept === undefined || shiftsToAccept < red.minShiftsToAccept)) {
				red.minShiftsToAccept = shiftsToAccept
				foundNew = true
			}

			var shifts = sub.shifts
			for (var i = 0, shiftsLen = shifts.length; i < shiftsLen; ++i) {
				var shift = shifts[i]
				if (shift.minShiftsToAccept === undefined || shiftsToAccept < shift.minShiftsToAccept) {
					shift.minShiftsToAccept = shiftsToAccept

					foundNew = true
				}
			}

			if (sub.node && !sub.visited) {
				sub.visited = true

				if (assignSize(sub.node, size)) {
					foundNew = true
				}
			}
		} while (sub = sub.next)
	}

	return foundNew
}

MinShiftsParser.prototype.addSub = function (symIndex, sub) {
	var size = sub.size

	var lastIdx = this.nodeTab.length - 1
	for (var n = lastIdx; n > -1; --n) {
		var node = this.nodeTab[n]

		if (node.symIndex === symIndex && node.size === size) {
			if (n !== lastIdx) {
				this.nodeTab[n] = this.nodeTab[lastIdx]
				this.nodeTab[lastIdx] = node
			}

			node.subs.push(sub)

			return node
		}
	}

	var newNode = {
		symIndex: symIndex,
		size: size,
		subs: [ sub ],
	}

	this.nodeTab.push(newNode)

	return newNode
}

MinShiftsParser.prototype.addNode = function (node, oldVertex) {
	var state = oldVertex.state.shifts[node.symIndex].state

	var vertex = this.addVertex(state)
	var vertexZNodes = vertex.zNodes

	var lastIdx = vertexZNodes.length - 1
	for (var v = lastIdx; v > -1; --v) {
		var zNode = vertexZNodes[v]

		if (zNode.node === node) {
			if (v !== lastIdx) {
				vertexZNodes[v] = vertexZNodes[lastIdx]
				vertexZNodes[lastIdx] = zNode
			}

			var zNodeVertices = zNode.vertices
			if (zNodeVertices.indexOf(oldVertex) === -1) {
				zNodeVertices.push(oldVertex)
			}

			return
		}
	}

	var newZNode = { node: node, vertices: [ oldVertex ] }
	vertexZNodes.push(newZNode)

	if (state.reds.length > 0) {
		this.reds.push({
			zNode: newZNode,
			reds: state.reds,
		})
	}
}

// Inherit default implementation.
MinShiftsParser.prototype.addVertex = Parser.prototype.addVertex

MinShiftsParser.prototype.reduce = function (redZNode, red) {
	var vertices = redZNode.vertices
	var sub = {
		start: this.position,
		red: red,
		shifts: [],
		node: redZNode.node,
		size: redZNode.node.size,
	}

	if (red.isBinary) {
		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			var vertexZNodes = vertices[v].zNodes

			for (var z = 0, vertexZNodesLen = vertexZNodes.length; z < vertexZNodesLen; ++z) {
				var zNode = vertexZNodes[z]
				var zNodeNode = zNode.node
				var subNew = {
					// Even though reduction is two symbols, use the position at the second symbol, because that is when you will see the reduction. Might change if we perform this check earlier.
					start: this.position,
					shifts: [],
					node: zNodeNode,
					size: zNodeNode.size + sub.size,
					next: sub,
				}

				var node = this.addSub(red.lhs.index, subNew)

				var zNodeVertices = zNode.vertices
				for (var v2 = 0, zNodeVerticesLen = zNodeVertices.length; v2 < zNodeVerticesLen; ++v2) {
					var vertex = zNodeVertices[v2]
					subNew.shifts.push(vertex.state.shifts[node.symIndex])
					this.addNode(node, vertex)
				}
			}
		}
	} else {
		var node = this.addSub(red.lhs.index, sub)

		for (var v = 0, verticesLen = vertices.length; v < verticesLen; ++v) {
			var vertex = vertices[v]
			sub.shifts.push(vertex.state.shifts[node.symIndex])
			this.addNode(node, vertex)
		}
	}
}

/**
 * Load the states' `minShiftsToAccept` from a cache file.
 */
function loadFromFile(states, cachePath) {
	var statesCache = require(cachePath)

	for (var s = 0, statesLen = states.length; s < statesLen; ++s) {
		var state = states[s]
		var stateCache = statesCache[s]

		var shifts = state.shifts
		var shiftsCache = stateCache.shifts

		var symIndexes = Object.keys(shifts)
		for (var i = 0, symIndexesLen = symIndexes.length; i < symIndexesLen; ++i) {
			var symIndex = Number(symIndexes[i])
			shifts[symIndex].minShiftsToAccept = shiftsCache[symIndex]
		}

		var reds = state.reds
		var redsCache = stateCache.reds
		for (var r = 0, redsLen = reds.length; r < redsLen; ++r) {
			reds[r].minShiftsToAccept = redsCache[r]
		}
	}
}

/**
 * Write the states' `minShiftsToAccept` values to a cache file.
 */
function writeToFile(states, cachePath) {
	var cache = []

	// Remove circular references to enable writing to file.
	for (var s = 0, statesLen = states.length; s < statesLen; ++s) {
		var state = states[s]
		var cacheState = cache[s] = {
			shifts: [],
			reds: [],
		}

		var shifts = state.shifts
		var symIndexes = Object.keys(shifts)
		for (var i = 0, symIndexesLen = symIndexes.length; i < symIndexesLen; ++i) {
			var symIndex = Number(symIndexes[i])
			cacheState.shifts[symIndex] = shifts[symIndex].minShiftsToAccept
		}

		var reds = state.reds
		for (var r = 0, redsLen = reds.length; r < redsLen; ++r) {
			cacheState.reds[r] = reds[r].minShiftsToAccept
		}
	}

	util.writeJSONFile(cachePath, cache)
}