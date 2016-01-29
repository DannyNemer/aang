var util = require('../util/util')
var pfsearch = require('./pfsearch')

/**
 * The `Parser` constructor.
 *
 * Accepts a `StateTable` instance instead of instantiating it itself because multiple `Parser` instances can be created for the same `StateTable` instance.
 *
 * @constructor
 * @param {StateTable} stateTable The `StateTable` instance generated from the grammar.
 */
function Parser(stateTable) {
	this.stateTable = stateTable
}

/**
 * The parse results containing the `k`-best parse trees output by `pfsearch` and the associated parse statistics.
 *
 * @typedef {Object} ParseResults
 * @property {Object[]|undefined} trees The `k`-best parse trees output by `pfsearch` if the parse reaches the start symbol, else `undefined`.
 * @property {boolean} failedInitStartSym Indicates the parse initially failed to reach the start symbol (which required marking all input tokens as deletable and re-parsing).
 * @property {boolean} failedInitLegalTrees Indicates the parse initially failed to generate any legal parse trees due to illegal semantics (which required marking all input tokens as deletable and re-parsing).
 * @property {number} pathCount The number of paths created in `pfsearch`. (If `failedInitLegalTrees` is `true`, includes the number of paths created in the first `pfsearch` invocation.)
 * @property {number} ambiguousTreeCount The number of ambiguous parse trees discarded in `pfsearch`.
 */

/**
 * Parses `query` using the state table generated for the grammar and returns the `k`-best parse trees, along with the trees' associated semantic trees and conjugated display texts.
 *
 * @memberOf Parser
 * @param {string} query The input query to parse.
 * @param {number} [k=7] The maximum number of parse trees to find.
 * @param {Object} [options] The `pfsearch` options object.
 * @param {boolean} [options.buildTrees=false] Specify constructing parse trees for printing.
 * @param {boolean} [options.printAmbiguity=false] Specify printing instances of ambiguity.
 * @returns {ParseResults} Returns the `k`-best parse trees and associated parse statistics.
 */
Parser.prototype.parse = function (query, k, options) {
	var parseResults = {
		trees: undefined,
		pathCount: 0,
		ambiguousTreeCount: 0,
		failedInitStartSym: false,
		failedInitLegalTrees: false,
	}

	// The array of arrays for each lexical token index, each of which holds nodes for terminal rules that produce matched terminal symbols in `query`.
	var termRuleMatchTab = this.matchTerminalRules(query)

	// Construct a parse forest from the terminal rule matches that spans the entire input query and reaches the grammar's start symbol.
	this.startNode = this.shiftReduce(termRuleMatchTab)

	if (this.startNode) {
		// Use A* path search to find the `k`-best parse trees in the parse forest, along with the trees' associated semantic trees and display texts.
		var pfsearchResults = pfsearch(this.startNode, k, options)
		// Save `pathCount` even if re-parsing to determine cumulative measurement.
		parseResults.pathCount = pfsearchResults.pathCount

		if (pfsearchResults.trees.length > 0) {
			parseResults.trees = pfsearchResults.trees
			parseResults.ambiguousTreeCount = pfsearchResults.ambiguousTreeCount

			// Return trees if `pfsearch` successfully generated legal parse trees (i.e., without illegal semantics).
			return parseResults
		} else {
			// Reset the `minCost` property of all nonterminal subnodes in `nodeTabs` to `undefined`. Most of the nodes will be reused in the second parse, and therefore require their `minCost` value be set to `undefined` to enable `calcHeuristicCosts` to re-calculate the heuristic costs of the new parse forest.
			this.resetMinCosts()
			parseResults.failedInitLegalTrees = true
		}
	} else {
		parseResults.failedInitStartSym = true
	}

	// Do not re-parse if `query` is only one token or all of `query` has already been marked deletable. (The second parse can not produce anything different.)
	if (this.tokensLen === 1 || (this.deletions[0] && this.deletions[0].length === this.tokensLen)) {
		return parseResults
	}

	// After failing to reach the start symbol or failing to generate legal parse trees (due to illegal semantics) on the initial parse, as a last resort (and a significant performance hit), mark all tokens as deletable (except those already added to `this.deletions`) and add new nodes with those deletions.
	termRuleMatchTab = this.addDeletablesForAllTokens()

	// With the same `nodeTabs` index (including both the existing and new terminal nodes, in addition the previously added nonterminal nodes), re-parse the terminal rule matches. As a temporary solution, reset all other data sets, including `vertices` and `reds`, slightly slowing performance.
	this.startNode = this.shiftReduce(termRuleMatchTab)

	if (this.startNode) {
		// After marking all tokens as deletable and generating the expanded parse forest, again search for the `k`-best parse trees.
		var pfsearchResults = pfsearch(this.startNode, k, options)
		parseResults.trees = pfsearchResults.trees

		// If re-parsing after initially failing to generate legal parse trees, include the `pathCount` from the first `pfsearch` invocation.
		parseResults.pathCount += pfsearchResults.pathCount
		parseResults.ambiguousTreeCount = pfsearchResults.ambiguousTreeCount

		return parseResults
	} else {
		// Return with `parseResults.trees` as `undefined` to indicate never reaching the start symbol.
		return parseResults
	}
}

/**
 * Constructs a parse forest from the terminal rule matches in `termRuleMatchTab` that spans the entire input query and reaches the grammar's start symbol.
 *
 * Using the state table generated from the grammar, steps through `termRuleMatchTab`, performing shift steps for an index's matched terminal nodes, followed by a series of reduce steps to apply completed grammar rules, and repeating for each successive index.
 *
 * @memberOf Parser
 * @param {Object[][]} termRuleMatchTab The array of arrays of terminal rule matches.
 * @returns {Object|undefined} Returns the start node of the parse forest if the parse succeeds, else `undefined`.
 */
Parser.prototype.shiftReduce = function (termRuleMatchTab) {
	// The current input query token parse index.
	this.curIdx = 0

	// The reductions to apply after each shift.
	this.reds = []
	var redsIdx = 0

	// The vertices for each state and associated nodes at each input query index. For accessing previous indexes for terminal rule shifting in `Parser.prototype.shiftTerminalRuleNodes()`.
	this.vertTab = util.new2DArray(termRuleMatchTab.length + 1)
	this.vertices = this.vertTab[this.curIdx]
	// The map of state indexes to sets of vertex zNodes (in `this.vertices`) for the current input query parse index. For vertex lookup in `Parser.prototype.addVertex()`.
	this.zNodeSets = []

	// Add the vertex for the first state.
	this.addVertex(this.stateTable.states[0])

	// Parse entire input and inserted `<blank>` symbol (at index `this.tokensLen`).
	while (this.curIdx <= this.tokensLen) {
		// Terminal rule matches whose span ends at this index.
		var termRuleMatches = termRuleMatchTab[this.curIdx]

		// Use a separate `nodeTabs` index for each token index, but share the same `nodeTabs` index for the last lexical token and the `<blank>` symbol which follows it. This allows the new nodes for insertions that use `<blank>` to merge with the trees that do not and would otherwise have a different span (i.e., size). It also enables multiple instances of insertions that use `<blank>` within a single tree.
		if (this.curIdx < this.tokensLen) {
			this.nodeSets = this.nodeTabs[this.curIdx]
		}

		// Set `vertices` for adding states for this index.
		this.vertices = this.vertTab[++this.curIdx]
		// Create new map of state indexes to (new) vertices at this index.
		this.zNodeSets = new Array(this.stateTable.states.length)

		// Add the terminal rule nodes for index `this.curIdx`, created by `matchTerminalRules`, that can follow the preceding vertices.
		this.shiftTerminalRuleNodes(termRuleMatches)

		// Reduce.
		while (redsIdx < this.reds.length) {
			var redObj = this.reds[redsIdx++]
			this.reduce(redObj.zNode, redObj.reds)
		}
	}

	// Get the start node for the accepting parse state.
	// When no start node is found for the last index search the second-to-last index which also spans the entire input query but excludes `[blank-inserted]`.
	return this.getStartNode()
}

/**
 * Adds the terminal rule nodes for index `this.curIdx`, created by `matchTerminalRules`, that can follow the preceding vertices. Discards nodes for which no state table shift exists from the preceding vertices to the node.
 *
 * @memberOf Parser
 * @param {Object[]} termRuleMatches The terminal rule matches to add for index `this.curIdx`.
 * @param {Object[]} termRuleMatches[].nodes The terminal rule nodes.
 * @param {number} termRuleMatches[].startIdx The start index of the span of `termRuleMatches[].nodes`.
 */
Parser.prototype.shiftTerminalRuleNodes = function (termRuleMatches) {
	for (var w = 0, termRuleMatchLen = termRuleMatches.length; w < termRuleMatchLen; ++w) {
		var termRuleMatch = termRuleMatches[w]

		// The preceding vertices at the start of this terminal symbol's span.
		var prevVertices = this.vertTab[termRuleMatch.startIdx]
		var prevVerticesLen = prevVertices.length

		// Loop through all terminal rules that produce the terminal symbol.
		var nodes = termRuleMatch.nodes
		for (var n = 0, nodesLen = nodes.length; n < nodesLen; ++n) {
			// The node for the LHS of the terminal rule.
			var node = nodes[n]
			var nodeSymId = node.sym.id

			// Add the terminal rule `node` for each shift that exists from a preceding vertex for this node's symbol, if any. Create a new vertex for each shift's (next) state with the preceding vertex pointing to it.
			for (var v = 0; v < prevVerticesLen; ++v) {
				var prevVertex = prevVertices[v]
				var nextState = prevVertex.shifts[nodeSymId]
				if (nextState) {
					this.addNode(node, prevVertex, nextState)
				}
			}
		}
	}
}

/**
 * Gets the node for `nontermSym` if it exists, else creates a new node. Adds `sub` to the node if unique.
 *
 * Stores nodes at this parsing index as a map of symbol id to an array of nodes for each size (i.e., its span of the input tokens, depending on the node's height within the tree). Most often, there are only 1 (50%) or 2 (20%) nodes (of different size) per symbol per index, enabling an array (to iterate for lookup) as the optimal data structure. An array map of size->node (for each symbol) is worse because allocating an array with a length of the largest node's span (i.e., the map's key) outweighs benefits of improved lookup.
 *
 * @memberOf Parser
 * @param {Object} nontermSym The new nonterminal symbol.
 * @param {Object} sub The subnode (i.e., RHS) produced by `nontermSym`.
 * @returns {Object|null} Returns the node to which `sub` was added if `sub` is nonterminal or the node is new, else `null`.
 */
Parser.prototype.addSub = function (nontermSym, sub) {
	var nodes = this.nodeSets[nontermSym.id]
	if (!nodes) {
		// Create new node.
		var newNode = {
			// The LHS of `sub`.
			sym: nontermSym,
			// The number of lexical tokens this node spans.
			size: sub.size,
			// The query token index where this node's span begins. Only for debugging.
			startIdx: sub.ruleProps.isTransposition ? sub.next.node.startIdx : sub.node.startIdx,
			// The child nodes produces by this node's rules (i.e., the RHS).
			subs: [ sub ],
		}

		// Save new node.
		this.nodeSets[nontermSym.id] = [ newNode ]

		return newNode
	}

	// Get the node of `nontermSym` and `size` if it exists.
	var size = sub.size
	for (var n = 0, nodesLen = nodes.length; n < nodesLen; ++n) {
		var node = nodes[n]

		if (node.size === size) {
			// Add `sub` to the existing node's subnodes if unique. Tests report 50% of sub-nodes for existing nodes are unique.
			if (subIsNew(node.subs, sub)) {
				node.subs.push(sub)
			}

			// Return `null` if `sub` produces a terminal node to indicate `node` already existed. This enables `Parser.prototype.addWordNodes()` to avoid adding duplicate instances of `node` to `termRuleMatches`.
			return sub.node.subs ? node : null
		}
	}

	// Create and save new node.
	return nodes[nodesLen] = {
		sym: nontermSym,
		size: size,
		startIdx: sub.ruleProps.isTransposition ? sub.next.node.startIdx : sub.node.startIdx,
		subs: [ sub ],
	}
}

/**
 * Checks if `newSub` already exists in `existingSubs`.
 *
 * @private
 * @static
 * @param {Object[]} existingSubs The subnodes of the parent node.
 * @param {Object} newSub The new subnode.
 * @returns {boolean} Returns `true` if `newSub` already exists, else `false`.
 */
function subIsNew(existingSubs, newSub) {
	var newSubNode = newSub.node
	var newSubSize = newSub.size
	var newSubNext = newSub.next

	// Tests report 1.15x more likely to find the subnode faster by iterating backward.
	for (var s = existingSubs.length - 1; s > -1; --s) {
		var oldSub = existingSubs[s]

		if (oldSub.node !== newSubNode || oldSub.size !== newSubSize) {
			continue
		}

		var oldSubNext = oldSub.next
		if (newSubNext && oldSubNext) {
			if (oldSubNext.node !== newSubNext.node || oldSubNext.size !== newSubNext.size) {
				continue
			}
		} else if (newSubNext || oldSubNext) {
			// This only occurs for the `<blank>` symbol, which has a `size` of 0 and can produce a binary reduction for a node with the same size as a non-binary reduction for the same node.
			continue
		}

		// Subnode exists.
		return false
	}

	return true
}

/**
 * Adds `node` for `nextState`, which is the shift from the preceding vertex `prevVertex`. Gets the vertex for `nextState` at the current parsing index (creates a new vertex if none exists). Gets that vertex's zNode for `node` (creates a new zNode if none exists). Adds `prevVertex` to that zNode if unique.
 *
 * @memberOf Parser
 * @param {Object} node The new node.
 * @param {Object} prevVertex The previous vertex that points to `node` (i.e., the previous state).
 * @param {Object} nextState The next state for the shift from `prevVertex` to `node`.
 */
Parser.prototype.addNode = function (node, prevVertex, nextState) {
	// Get the zNodes that point to the vertex for `nextState` at the current parsing index. (Creates the vertex if none exists.)
	var vertexZNodes = this.addVertex(nextState)

	// Get the zNode for `node` for `nextState`.
	var lastIdx = vertexZNodes.length - 1
	for (var z = lastIdx; z > -1; --z) {
		var zNode = vertexZNodes[z]

		if (zNode.node === node) {
			// Reorder to cache last call. Tests report a 97% hit rate (i.e., 97% of sought zNodes that already exist are in the last index).
			if (z !== lastIdx) {
				vertexZNodes[z] = vertexZNodes[lastIdx]
				vertexZNodes[lastIdx] = zNode
			}

			// Add `prevVertex` to the existing zNode's vertices if unique.
			var zNodeVertices = zNode.vertices
			if (zNodeVertices.indexOf(prevVertex) === -1) {
				// `prevVertex` points to `zNode`.
				zNodeVertices.push(prevVertex)
			}

			// Stop after finding existing zNode.
			return
		}
	}

	// Create a new zNode for `node` for `nextState`. `prevVertex` points to `newZNode`.
	var newZNode = { node: node, vertices: [ prevVertex ] }
	vertexZNodes.push(newZNode)

	// Save reductions for this `node` and its next state.
	if (nextState.reds.length > 0) {
		this.reds.push({
			zNode: newZNode,
			reds: nextState.reds,
		})
	}
}

/**
 * Adds a vertex for `state` if none exists for `this.curIdx`. Returns the vertex's `vertex.zNodes` for use by `Parser.prototype.addNode()`, whether or not the vertex is new.
 *
 * @memberOf Parser
 * @param {Object} state The new state.
 * @returns {Object[]} Returns `zNodes` for the vertex for `state`.
 */
Parser.prototype.addVertex = function (state) {
	// Get the vertex zNodes for `state` if it exists.
	var zNodes = this.zNodeSets[state.index]
	if (zNodes) return zNodes

	// Create new vertex and zNodes.
	var newZNodes = []

	// Save vertex for terminal rule shifting. Storing a second array for vertices, instead of storing them in the state-index map, is necessary to quickly iterate over preceding vertices in `Parser.prototype.shiftTerminalRuleNodes()`. (Iterating over a larger sparse array would be detrimental to performance.)
	this.vertices.push({
		// The shifts from this state to other states available for specific nonterminal symbols.
		shifts: state.shifts,
		// The zNodes that point to this vertex. For reducing binary rules in `Parser.prototype.reduce()`.
		zNodes: newZNodes,
	})

	// Save zNodes for lookup in `Parser.prototype.addNode()`.
	return this.zNodeSets[state.index] = newZNodes
}

/**
 * Applies reductions to `redZNode`.
 *
 * @memberOf Parser
 * @param {Object} redZNode The zNode from which to build subnodes using `reds`.
 * @param {Object[]} reds The reductions to execute on `redZNode`.
 */
Parser.prototype.reduce = function (redZNode, reds) {
	var vertices = redZNode.vertices
	var verticesLen = vertices.length

	for (var r = 0, redsLens = reds.length; r < redsLens; ++r) {
		var red = reds[r]
		var nodeSymId = red.lhs.id
		var sub = {
			node: redZNode.node,
			size: redZNode.node.size,
			ruleProps: undefined,
			minCost: undefined,
		}

		if (red.isBinary) {
			var ruleProps = red.ruleProps
			var isTransposition = ruleProps.isTransposition

			for (var v = 0; v < verticesLen; ++v) {
				// The zNodes that point to this vertex.
				var vertexZNodes = vertices[v].zNodes

				for (var z = 0, vertexZNodesLen = vertexZNodes.length; z < vertexZNodesLen; ++z) {
					var zNode = vertexZNodes[z]
					var zNodeNode = zNode.node
					var newSub

					if (isTransposition) {
						// Swap RHS symbols for transposition.
						newSub = {
							node: sub.node,
							size: zNodeNode.size + sub.size,
							next: {
								node: zNodeNode,
								size: zNodeNode.size,
								minCost: undefined,
							},
							ruleProps: ruleProps,
							minCost: undefined,
						}
					} else {
						newSub = {
							node: zNodeNode,
							size: zNodeNode.size + sub.size,
							next: sub,
							ruleProps: ruleProps,
							minCost: undefined,
						}
					}

					// The node for the LHS of the binary rule.
					var node = this.addSub(red.lhs, newSub)

					// Add `node` for the shift from each preceding vertex. Create a new vertex for each shift's (next) state with the preceding vertex pointing to it. (There will always be a shift for the reduction's LHS symbol.)
					var zNodeVertices = zNode.vertices
					for (var v2 = 0, zNodeVerticesLen = zNodeVertices.length; v2 < zNodeVerticesLen; ++v2) {
						var prevVertex = zNodeVertices[v2]
						this.addNode(node, prevVertex, prevVertex.shifts[nodeSymId])
					}
				}
			}
		} else {
			sub.ruleProps = red.ruleProps

			// The node for the LHS of the unary rule.
			var node = this.addSub(red.lhs, sub)

			// Add `node` for the shift from each preceding vertex. Create a new vertex for each shift's (next) state with the preceding vertex pointing to it. (There will always be a shift for the reduction's LHS symbol.)
			for (var v = 0; v < verticesLen; ++v) {
				var prevVertex = vertices[v]
				this.addNode(node, prevVertex, prevVertex.shifts[nodeSymId])
			}
		}
	}
}

/**
 * Searches parse vertices for the start node for the accepting parse state, otherwise the parse failed.
 *
 * May search vertices for two query indexes:
 * - The last index of `this.vertTab` (same vertex zNodes as `this.zNodeSets`) is for the `[blank-inserted]` symbol, which enables insertions that the grammar defines can only occur at the end of an input query. This special symbol has a `size` of 0, enabling the last `this.vertTab` index to include parse trees that include this final symbol and those that do not because they have identical spans.
 * - If the grammar lacks any `[blank-inserted]` insertions for the provided input query, then the last `this.vertTab` index also lacks the vertices that span the entire query but not `[blank-inserted]`. (These vertices are normally brought to the last index with the vertices for the `[blank-inserted]` insertions.
 * - Hence, when no start node is found in the last `this.vertTab` index, search the second-to-last index which also spans the entire input query but excludes `[blank-inserted]`.
 *
 * Note: Could extend `Parser.prototype.addVertex()` to check if each provided state is the accepting state, and to save it if so, thereby removing the need for this iteration. This is inferior, however, because it requires 10x as many checks.
 *
 * @memberOf Parser
 * @returns {Object|undefined} Returns the start node if found (i.e., the parse succeeded), else `undefined`.
 */
Parser.prototype.getStartNode = function () {
	// Check the vertex zNodes for the last parse index (same zNodes as `this.vertTab`) for the accepting state vertex (state table index of 1).
	var acceptingStateZNodes = this.zNodeSets[1]
	if (acceptingStateZNodes) {
		// Get index 0 because only the start node can point to the vertex for the 'accept' state.
		return acceptingStateZNodes[0].node
	}

	// If the grammar lacks any `[blank-inserted]` insertions for the provided input query, search the second-to-last index which also spans the entire input query but excludes `[blank-inserted]`.
	var prevVertices = this.vertTab[this.vertTab.length - 2]
	// The `shifts` array of the accepting state for identifying the associated vertex.
	var acceptingStateShifts = this.stateTable.states[1].shifts
	// Tests report 1.9x more likely to find the start node faster by iterating backward.
	for (var v = prevVertices.length - 1; v > -1; --v) {
		var vertex = prevVertices[v]

		if (vertex.shifts === acceptingStateShifts) {
			return vertex.zNodes[0].node
		}
	}
}

/**
 * Resets the `minCost` property of all nonterminal subnodes in `nodeTabs` to `undefined`.
 *
 * After `pfsearch` fails to generate legal parse trees (due to illegal semantics), `Parser.prototype.parse()` marks all tokens as deletable and re-generates the parse forest. The nodes constructed during the first parse remain in `nodeTabs`, and most will be reused and therefore require their `minCost` value be set to `undefined` to enable `calcHeuristicCosts` to re-calculate the heuristic costs of the new parse forest.
 *
 * @memberOf Parser
 */
Parser.prototype.resetMinCosts = function () {
	var nodeSetsLen = this.stateTable.symbolCount

	for (var t = 0; t < this.tokensLen; ++t) {
		var nodeSets = this.nodeTabs[t]

		for (var n = 0; n < nodeSetsLen; ++n) {
			var nodes = nodeSets[n]
			if (!nodes) continue

			for (var i = 0, nodesLen = nodes.length; i < nodesLen; ++i) {
				var subs = nodes[i].subs

				for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
					var sub = subs[s]
					var ruleProps = sub.ruleProps

					// Check `ruleProps` instead of existence of subnodes to determine if nonterminal because `calcHeuristicCosts` converts nonterminal subnodes where `ruleProps.rhsDoesNotProduceText` is `true` to terminal subnodes by modifying their `ruleProps`, though their subnodes remain.
					if (ruleProps.isNonterminal || ruleProps.constructor === Array) {
						sub.minCost = undefined

						var subNext = sub.next
						if (subNext) {
							subNext.minCost = undefined
						}
					}
				}
			}
		}
	}
}

// Export Parser.
module.exports = Parser

// Extend `Parser` with methods for matching terminal rules in input.
require('./matchTerminalRules')
// Extend `Parser` with methods for printing.
require('./printParser')