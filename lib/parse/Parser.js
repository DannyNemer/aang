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
 * @typedef ParseResults
 * @type {Object}
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
	var wordTab = this.matchTerminalRules(query)

	// Construct a parse forest from the terminal rule matches that spans the entire input query and reaches the grammar's start symbol.
	this.startNode = this.shiftReduce(wordTab)

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
	wordTab = this.addDeletablesForAllTokens()

	// With the same `nodeTab` (including both the existing and new terminal nodes, in addition the previously added nonterminal nodes), re-parse the terminal rule matches. As a temporary solution, reset all other data sets, including `vertices` and `reds`, slightly slowing performance.
	this.startNode = this.shiftReduce(wordTab)

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
 * Constructs a parse forest from the terminal rule matches in `wordTab` that spans the entire input query and reaches the grammar's start symbol.
 *
 * Using the state table generated from the grammar, steps through `wordTab`, performing shift steps for an index's matched terminal nodes, followed by a series of reduce steps to apply completed grammar rules, and repeating for each successive index.
 *
 * @memberOf Parser
 * @param {Object[][]} wordTab The array of arrays of terminal rule matches.
 * @returns {Object|undefined} Returns the start node of the parse forest if the parse succeeds, else `undefined`.
 */
Parser.prototype.shiftReduce = function (wordTab) {
	// The current input query token index.
	this.curIdx = 0

	// The reductions to apply after each shift.
	this.reds = []
	var redsIdx = 0

	// The vertices for each token index.
	this.vertTabs = util.new2DArray(wordTab.length + 1)
	this.vertices = this.vertTabs[this.curIdx]

	// Add the vertex for the first state.
	this.addVertex(this.stateTable.states[0])

	// Parse entire input and inserted `<blank>` symbol (at index `this.tokensLen`).
	while (this.curIdx <= this.tokensLen) {
		// Terminal symbol matches whose span ends at this index.
		var words = wordTab[this.curIdx]

		// Use a separate `nodeTab` for each token index, but share the same `nodeTab` for the last lexical token and the `<blank>` symbol which follows it. This allows the new nodes for insertions that use `<blank>` to merge with the trees that do not and would otherwise have a different span (i.e., size). It also enables multiple instances of insertions that use `<blank>` within a single tree.
		if (this.curIdx < this.tokensLen) {
			this.nodeTab = this.nodeTabs[this.curIdx]
		}

		// Set `vertices` for `Parser.prototype.addNode()` invocations.
		this.vertices = this.vertTabs[++this.curIdx]

		// Add the terminal rule nodes for index `this.curIdx`, created by `matchTerminalRules`, that can follow the preceding vertices.
		this.shiftTerminalRuleNodes(words)

		// Reduce.
		while (redsIdx < this.reds.length) {
			var redObj = this.reds[redsIdx++]
			this.reduce(redObj.zNode, redObj.reds)
		}
	}

	// Find the start node for the accepting parse state.
	// When no start node is found in the last `this.vertTabs` index, search the second-to-last index which also spans the entire input query but excludes `[blank-inserted]`.
	return getStartNode(this.vertices) || getStartNode(this.vertTabs[this.vertTabs.length - 2])
}

/**
 * Adds the terminal rule nodes for index `this.curIdx`, created by `matchTerminalRules`, that can follow the preceding vertices. Discards nodes for which no state table shift exists from the preceding vertices to the node.
 *
 * @memberOf Parser
 * @param {Object[]} words The terminal rule nodes to add for index `this.curIdx`.
 * @param {Object[]} words[].nodes The terminal rule nodes.
 * @param {number} words[].startIdx The start index of the span of `words[].nodes`.
 */
Parser.prototype.shiftTerminalRuleNodes = function (words) {
	for (var w = 0, wordsLen = words.length; w < wordsLen; ++w) {
		var word = words[w]

		// The preceding vertices at the start of this terminal symbol's span.
		var prevVertices = this.vertTabs[word.startIdx]
		var prevVerticesLen = prevVertices.length

		// Loop through all terminal rules that produce the terminal symbol.
		var nodes = word.nodes
		for (var n = 0, nodesLen = nodes.length; n < nodesLen; ++n) {
			var node = nodes[n]

			for (var v = 0; v < prevVerticesLen; ++v) {
				// Add the terminal rule node (if there exists a shift from `prevVertices`).
				this.addNode(node, prevVertices[v])
			}
		}
	}
}

/**
 * Gets the node for `nontermSym` if it exists, else creates a new node. Then adds `sub` to that node if it is unique.
 *
 * @memberOf Parser
 * @param {Object} nontermSym The new nonterminal symbol.
 * @param {Object} sub The subnode (i.e., RHS) produced by `nontermSym`.
 * @returns {Object|null} Returns the node to which `sub` was added if `sub` is nonterminal or the node did not already exist (in `nodeTabe`), else `null`.
 */
Parser.prototype.addSub = function (nontermSym, sub) {
	var size = sub.size

	// Get the node of `nontermSym` if it exists.
	var lastIdx = this.nodeTab.length - 1
	for (var n = lastIdx; n > -1; --n) {
		var node = this.nodeTab[n]

		if (node.sym === nontermSym && node.size === size) {
			// Reorder to cache last call.
			if (n !== lastIdx) {
				this.nodeTab[n] = this.nodeTab[lastIdx]
				this.nodeTab[lastIdx] = node
			}

			// Add `sub` to the existing node's subnodes if unique.
			if (subIsNew(node.subs, sub)) {
				node.subs.push(sub)
			}

			// Return `null` if `sub` produces a terminal node. This enables `Parser.prototype.addWordNodes()` to avoid adding duplicate instances of `node` to `this.wordTab`.
			return sub.node.subs ? node : null
		}
	}

	// Create a new node.
	var newNode = {
		// The LHS of `sub`.
		sym: nontermSym,
		// The number of lexical tokens spanned by this node.
		size: size,
		// The token index of input at which this node's span begin. This is only used for debugging.
		startIdx: sub.ruleProps.isTransposition ? sub.next.node.startIdx : sub.node.startIdx,
		// The child nodes produces by this node's rules (i.e., the RHS).
		subs: [ sub ],
	}

	// Save the new node.
	this.nodeTab.push(newNode)

	return newNode
}

/**
 * Checks if `newSub` already exists in `existingSubs`.
 *
 * @static
 * @param {Object[]} existingSubs The subnodes of the parent node.
 * @param {Object} newSub The new subnode.
 * @returns {boolean} Returns `true` if `newSub` already exists, else `false`.
 */
function subIsNew(existingSubs, newSub) {
	var newSubNext = newSub.next

	// Tests show 1.15x more likely to find the subnode faster by iterating backward.
	for (var s = existingSubs.length - 1; s > -1; --s) {
		var oldSub = existingSubs[s]

		if (oldSub.node !== newSub.node || oldSub.size !== newSub.size) {
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
 * Gets the next state for `node.sym` that follows `oldVertex.state`. Then, gets the vertex for that state if it exists, else creates a new vertex. Then, gets that vertex's zNode for `node` if it exists, else creates a new zNode. Then, adds `oldVertex` to that zNode if it is unique.
 *
 * @memberOf Parser
 * @param {Object} node The new node.
 * @param {Object} oldVertex The vertex that points to `node` (i.e., the previous state).
 */
Parser.prototype.addNode = function (node, oldVertex) {
	// Get the next state that follows `oldVertex.state` for `node.sym`, if any.
	var state = oldVertex.state.shifts[node.sym.index]
	// Fails only for shifts; never for reductions.
	if (!state) return

	// Add a vertex for `state` if none exists for `this.curIdx`.
	// Get the zNodes that point to the vertex for `state` (whether or not the vertex is new).
	var vertexZNodes = this.addVertex(state)

	// Get the zNode for `node` for `state`.
	var lastIdx = vertexZNodes.length - 1
	for (var z = lastIdx; z > -1; --z) {
		var zNode = vertexZNodes[z]

		if (zNode.node === node) {
			// Reorder to cache last call.
			if (z !== lastIdx) {
				vertexZNodes[z] = vertexZNodes[lastIdx]
				vertexZNodes[lastIdx] = zNode
			}

			// Add `oldVertex` to the existing zNode's vertices if unique.
			var zNodeVertices = zNode.vertices
			if (zNodeVertices.indexOf(oldVertex) === -1) {
				// `oldVertex` points to `zNode`.
				zNodeVertices.push(oldVertex)
			}

			// Stop after finding existing zNode.
			return
		}
	}

	// Create a new zNode for `node` for `state`.
	// `oldVertex` points to `newZNode`.
	var newZNode = { node: node, vertices: [ oldVertex ] }
	vertexZNodes.push(newZNode)

	// Save reductions for this `node` and its next state.
	if (state.reds.length > 0) {
		this.reds.push({
			zNode: newZNode,
			reds: state.reds,
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
	// Get the vertex for `state` if it exists.
	var lastIdx = this.vertices.length - 1
	for (var v = lastIdx; v > -1; --v) {
		var vertex = this.vertices[v]

		if (vertex.state === state) {
			// Reorder to cache last call.
			if (v !== lastIdx) {
				this.vertices[v] = this.vertices[lastIdx]
				this.vertices[lastIdx] = vertex
			}

			return vertex.zNodes
		}
	}

	// The zNodes that point to the new vertex.
	var newZNodes = []

	// Create a new vertex for `state`.
	this.vertices.push({
		// The state in `stateTable` with reds and shifts.
		state: state,
		// The index within the input string tokens array. This is only used for debugging.
		startIdx: this.curIdx,
		// The zNodes that point to this vertex.
		zNodes: newZNodes,
	})

	return newZNodes
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
					var subNew

					if (isTransposition) {
						// Swap RHS symbols for transposition.
						subNew = {
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
						subNew = {
							node: zNodeNode,
							size: zNodeNode.size + sub.size,
							next: sub,
							ruleProps: ruleProps,
							minCost: undefined,
						}
					}

					// The node for the binary rule.
					var node = this.addSub(red.lhs, subNew)

					var zNodeVertices = zNode.vertices
					for (var v2 = 0, zNodeVerticesLen = zNodeVertices.length; v2 < zNodeVerticesLen; ++v2) {
						this.addNode(node, zNodeVertices[v2])
					}
				}
			}
		} else {
			sub.ruleProps = red.ruleProps
			var node = this.addSub(red.lhs, sub)

			// Get the shift, if any, from each vertex to `node`, then create a vertex for `node` with the original vertex pointing to it.
			for (var v = 0; v < verticesLen; ++v) {
				this.addNode(node, vertices[v])
			}
		}
	}
}

/**
 * Searches `vertices` for the start node for the accepting parse state, otherwise the parse failed.
 *
 * `Parser.prototype.shiftReduce()` may invoke this function twice:
 * - The last index of `this.vertTabs` is for the `[blank-inserted]` symbol, which enables insertions that the grammar defines can only occur at the end of an input query. This special symbol has a `size` of 0, enabling the last `this.vertTabs` index to include parse trees that include this final symbol and those that do not because they have identical spans.
 * - If the grammar lacks any `[blank-inserted]` insertions for the provided input query, then the last `this.vertTabs` index also lacks the vertices that span the entire query but not `[blank-inserted]`. (These vertices are normally brought to the last index with the vertices for the `[blank-inserted]` insertions.
 * - Hence, when no start node is found in the last `this.vertTabs` index, search the second-to-last index which also spans the entire input query but excludes `[blank-inserted]`.
 *
 * @private
 * @static
 * @param {Object[]} vertices The vertices to search.
 * @returns {Object|undefined} Returns the start node if found (i.e., the parse succeeded), else `undefined`.
 */
function getStartNode(vertices) {
	// Tests show 1.9x more likely to find the start node faster by iterating backward.
	for (var v = vertices.length - 1; v > -1; --v) {
		var vertex = vertices[v]

		if (vertex.state.isFinal) {
			// Only one zNode because only the start node can point to the vertex for the 'accept' state.
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
	for (var t = 0; t < this.tokensLen; ++t) {
		var nodes = this.nodeTabs[t]

		for (var n = 0, nodesLen = nodes.length; n < nodesLen; ++n) {
			var subs = nodes[n].subs

			for (var s = 0, subsLen = subs.length; s < subsLen; ++s) {
				var sub = subs[s]
				var ruleProps = sub.ruleProps

				// Check `ruleProps` instead of existence of subnodes to determine if nonterminal because `calcHeuristicCosts` converts nonterminal subnodes where `ruleProps.rhsDoesNotProduceText` is `true` to terminal subnodes by modifying their `ruleProps`, though their subnodes remain.
				if (ruleProps.isNonterminal || ruleProps.constructor === Array) {
					sub.minCost = undefined

					if (sub.next) {
						sub.next.minCost = undefined
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