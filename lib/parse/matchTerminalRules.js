var util = require('../util/util')
var Parser = require('./Parser')
var semantic = require('../grammar/semantic')


/**
 * Searches for terminal rules that match `query`, including symbols in the query language and entities, and constructs the parser nodes accordingly. Determines the start and end indexes within `query` of each matched rule. Handles deletions and partial matches of multi-token entities, and determines the edit cost associated with these matches.
 *
 * @memberOf Parser
 * @param {string} query The input query.
 * @returns {Object[][]} Returns an array of an array of nodes for each terminal rule match at each index of `query`.
 */
Parser.prototype.matchTerminalRules = function (query) {
	// The input query tokens.
	this.tokens = query.toLowerCase().split(/\s+/)
	// The number of tokens in input.
	this.tokensLen = this.tokens.length

	// The array of arrays of nodes for each index in the parse forest.
	this.nodeTabs = util.new2DArray(this.tokensLen)

	// The array of arrays of nodes for each terminal rule match, as well each match's start index.
	this.wordTab = util.new2DArray(this.tokensLen + 1)
	// The array of arrays of multi-token entity matches for each index. This includes original matches, matches with deletions, and merges of adjacent matches of the same entity for multi-token entities.
	this.entityTab = util.new2DArray(this.tokensLen)
	// The semantic arguments created from input matches to entities and integer symbols. This prevents duplicate semantic arguments in the parse forest to enable equality checks by object reference (as opposed to having to check the semantic `name` property).
	this.semanticArgTab = Object.create(null)

	// Lookup every token in the input query.
	for (var curIdx = 0; curIdx < this.tokensLen; ++curIdx) {
		var token = this.tokens[curIdx]

		this.nodeTab = this.nodeTabs[curIdx]
		this.words = this.wordTab[curIdx]

		if (isNaN(token)) {
			// Check if `token` is a terminal symbol in the grammar.
			this.terminalSymbolLookup(token, curIdx)
		} else {
			// If token is a number, match with rules with integer terminal symbol placeholders, using the token as the semantic argument.
			this.intSymbolLookup(token, curIdx)
		}
	}

	// The map of each token index with a deletable to an object with the `cost` of that deletion and the `length` and `followingCost` of the continuous span of deletables that follow.
	this.deletions = new Array(this.tokensLen)
	// Initialize the possible deletions in input for use by `Parser.prototype.addWordTabDeletions()` and `Parser.prototype.entitiesLookup()`.
	this.deletablesLookup()

	// Search input for deletables that precede each terminal symbol and/or follow each terminal symbol at the end of input, and creates new nodes based on the terminal nodes in `this.wordTab` with spans and cost penalties that include the deletables.
	this.addWordTabDeletions()

	// Look up entity matches in `this.tokens`, create nodes for the associated terminal rules with the entities as semantic arguments, and check for adjacent deletables.
	this.entitiesLookup()

	// Append to the end of `this.nodeTabs` an array with the node that produces the `<blank>` symbol to enable insertion rules that are only recognized at the end of `query`.
	this.addBlankNode()

	return this.wordTab
}

/**
 * Checks if `symToken` is a terminal symbol in the grammar's query language, adds nodes for the rules that produce the matching terminal symbol, if any.
 *
 * @memberOf Parser
 * @param {string} symToken The lexical token to match to a terminal symbol in the query language.
 * @param {number} tokenIdx The index of `symToken` in input.
 */
Parser.prototype.terminalSymbolLookup = function (symToken, tokenIdx) {
	var terminalSym = this.stateTable.terminalSymTab[symToken]

	if (terminalSym) {
		// Add nodes for the terminal rules that produce `terminalSym` (at this index).
		this.addWordNodes(terminalSym, tokenIdx, tokenIdx)
	}
}

/**
 * Finds the integer symbols for which `intToken` is within range, and creates nodes for those rules with `intToken` as a semantic argument.
 *
 * @memberOf Parser
 * @param {string} intToken The integer input token.
 * @param {string} tokenIndex The index of `intToken` in input.
 */
Parser.prototype.intSymbolLookup = function (intToken, tokenIndex) {
	// It is faster to parse the number from the string and compare it to the numeric min and max values than to compare the original string, though they have the same outcome.
	var parsedFloat = parseFloat(intToken)

	// Assuming `intSymbols` is already sorted by increasing minimum value and then by increasing maximum value.
	for (var i = 0, intSymbolsLen = this.stateTable.intSymbols.length; i < intSymbolsLen; ++i) {
		var intSymbol = this.stateTable.intSymbols[i]

		// Integer symbols are sorted by increasing minimum value, so all following values are equal to or greater than this.
		if (parsedFloat < intSymbol.min) return

		if (parsedFloat <= intSymbol.max) {
			var terminalSym = this.stateTable.placeholderSymTab[intSymbol.name]

			// Get the semantic argument for `intToken` if it exists, else create a new semantic using the integer (as a string).
			var semanticArg = this.getSemanticArg(intToken)

			// Generate all nodes for rules that produce the terminal symbol.
			this.addWordNodes(terminalSym, tokenIndex, tokenIndex, semanticArg, intToken)
		}
	}
}

/**
 * Looks up entity matches in input, creates nodes for the associated terminal rules with the entities as semantic arguments, and checks for deletables that precede or are within the entity matches and/or that follow entity matches at the end of input.
 *
 * @memberOf Parser
 */
Parser.prototype.entitiesLookup = function () {
	// Check for entity tokens in input, deletables that precede or are within the entity matches, and deletables that follow entity matches at the end of input.
	for (var curIdx = 0; curIdx < this.tokensLen; ++curIdx) {
		var token = this.tokens[curIdx]
		var entitySet = this.stateTable.entitySets[token]

		this.nodeTab = this.nodeTabs[curIdx]
		this.words = this.wordTab[curIdx]

		// Check if this token is used by an entity.
		if (entitySet) {
			var matchedEntities = this.entityTab[curIdx]
			var matchedTokens = [ token ]

			for (var e = 0, entitySetLen = entitySet.length; e < entitySetLen; ++e) {
				var entity = entitySet[e]

				// Get the terminal symbol for the entity category. Terminal nodes for multiple entities in the same category use the same symbol, but use the node's parent subnode's `ruleProps`, which contains the entities' semantic and display text, to distinguish them.
				var terminalSym = this.stateTable.placeholderSymTab[entity.category]

				// Get the semantic argument for the entity category if it exists, else create a new semantic using the entity id.
				var semanticArg = this.getSemanticArg(entity.id)

				matchedEntities.push({
					entity: entity,
					terminalSym: terminalSym,
					semanticArg: semanticArg,
					matchedTokens: matchedTokens,
					startIdx: curIdx,
					endIdx: curIdx,
					deletionsCost: 0,
				})

				// Search input for deletables that precede `token` and/or follow `token` if at the end of input. Create a new entity object for each span of adjacent deletables, if any.
				this.findDeletions(curIdx, curIdx, function (startIdx, endIdx, deletionCost) {
					matchedEntities.push({
						entity: entity,
						terminalSym: terminalSym,
						semanticArg: semanticArg,
						matchedTokens: matchedTokens,
						startIdx: startIdx,
						endIdx: endIdx,
						deletionsCost: deletionCost,
					})
				})
			}
		}
	}

	// Merge adjacent token matches for the same entity.
	for (var endIdx = 1; endIdx < this.tokensLen; ++endIdx) {
		var matchedEntities = this.entityTab[endIdx]

		for (var e = 0, matchedEntitiesLen = matchedEntities.length; e < matchedEntitiesLen; ++e) {
			var entityObj = matchedEntities[e]
			// Skip if this entity match already spans to the start of the input query via deletions.
			if (entityObj.startIdx === 0) continue

			// The entity matches that precede this match (and any deletables within the match).
			var prevMatchedEntities = this.entityTab[entityObj.startIdx - 1]
			var entity = entityObj.entity
			var entTokens = entity.tokens

			for (var p = 0, prevMatchedEntitiesLen = prevMatchedEntities.length; p < prevMatchedEntitiesLen; ++p) {
				var prevEntityObj = prevMatchedEntities[p]

				// Check if a match for the same entity directly precedes this match in input.
				if (prevEntityObj.entity === entity) {
					// Concatenate token arrays and sort alphabetically to prevent multiple matches of the same entity token index.
					var matchedTokens = prevEntityObj.matchedTokens.concat(entityObj.matchedTokens).sort()

					// Check if the tokens of the adjacent entity matches are valid; i.e., do not merge if it contains multiple instances of the same entity token index.
					var prevIdx = -1
					for (var t = 0, matchedTokensLen = matchedTokens.length; t < matchedTokensLen; ++t) {
						var token = matchedTokens[t]
						prevIdx = entTokens.indexOf(token, prevIdx + 1)
						if (prevIdx === -1) break
					}

					// Skip if a matched token is a duplicate. E.g., "John John" for "John von Neumann".
					if (t < matchedTokensLen) continue

					matchedEntities.push({
						entity: entity,
						terminalSym: prevEntityObj.terminalSym,
						semanticArg: prevEntityObj.semanticArg,
						matchedTokens: matchedTokens,
						startIdx: prevEntityObj.startIdx,
						endIdx: entityObj.endIdx,
						deletionsCost: prevEntityObj.deletionsCost + entityObj.deletionsCost,
					})

					// Do not remove the non-merged entities, because those entities can enable other results. For example, given the entities "Jeb Bush" and "George Bush", with the input "Jeb and Bush", removing the entity for "Jeb" and merging with "<and> Bush" (where "and" is a delatable), prevents the result "Jeb Bush and George Bush".
				}
			}
		}
	}

	// Generate nodes for terminal rules that produce each entity terminal symbol.
	for (var endIdx = 0; endIdx < this.tokensLen; ++endIdx) {
		var matchedEntities = this.entityTab[endIdx]

		// Add nodes at the last index of the multi-token entity match.
		this.nodeTab = this.nodeTabs[endIdx]
		this.words = this.wordTab[endIdx]

		for (var e = 0, matchedEntitiesLen = matchedEntities.length; e < matchedEntitiesLen; ++e) {
			var entityObj = matchedEntities[e]
			var entity = entityObj.entity

			// Calculate cost penalty using `matchedTokens.length` instead of the match's span, because the span can include interspersed deletions.
			// Calculate cost using division so that "John not" produces different edit costs for "John <not>" and "John not Neumann".
			var costPenalty = 1 - entityObj.matchedTokens.length / entity.size + entityObj.deletionsCost

			// Create nodes for terminal rules that produce the entity.
			this.addWordNodes(entityObj.terminalSym, entityObj.startIdx, entityObj.endIdx, entityObj.semanticArg, entity.text, costPenalty)
		}
	}
}

/**
 * Searches input for deletables and unrecognized tokens. Uses `Parser.prototype.deletions` to map each token index with a deletable to an object with the length and cost of the continuous span of deletables that begins at that index.
 *
 * @memberOf Parser
 */
Parser.prototype.deletablesLookup = function () {
	// Look for deletables at each index. Iterate backward to determine the continuous span of deletables that follow each index.
	for (var t = this.tokensLen - 1; t > -1; --t) {
		var token = this.tokens[t]
		var cost
		if (deletables.indexOf(token) !== -1) {
			// `token` is a grammar-defined deletable.
			cost = 1
		} else if (this.wordTab[t].length === 0 && !entities[token]) {
			// `token` is neither a recognized token in the query language or the entities, nor is a legal integer symbol (i.e., within the symbols' specified bounds). This implementation will change with the integration of input strings and language models.
			cost = 3
		} else {
			continue
		}

		var nextDeletion = this.deletions[t + 1]
		if (nextDeletion) {
			this.deletions[t] = {
				// The cost of deleting this token.
				cost: cost,
				// The total deletion cost of the continuous span of deletables that follow this deletion.
				followingCost: nextDeletion.cost + nextDeletion.followingCost,
				// The length of continuous deletables beginning at this index.
				length: nextDeletion.length + 1,
			}
		} else {
			this.deletions[t] = {
				cost: cost,
				followingCost: 0,
				length: 1,
			}
		}
	}
}

/**
 * Searches input for deletables that precede each terminal symbol and/or follow each terminal symbol at the end of input, and creates new nodes based on the terminal nodes in `this.wordTab` with spans and cost penalties that include the deletables.
 *
 * @memberOf Parser
 */
Parser.prototype.addWordTabDeletions = function () {
	// Save the initial length of each word array, because words will be added to the arrays before iterating to them when creating deletions at the end of input.
	var origWordTabLengths = []
	for (var endIdx = 0; endIdx < this.tokensLen; ++endIdx) {
		var words = this.wordTab[endIdx]
		origWordTabLengths[endIdx] = words ? words.length : 0
	}

	// Check for deletables that precede each terminal node and/or follow each terminal node at the end of input.
	for (var endIdx = 0; endIdx < this.tokensLen; ++endIdx) {
		var words = this.wordTab[endIdx]

		for (var w = 0, wordsLen = origWordTabLengths[endIdx]; w < wordsLen; ++w) {
			var word = words[w]
			var wordNodes = word.nodes
			var terminalNode = wordNodes[0].subs[0].node

			// Create new nodes based on `wordNodes` with spans and cost penalties that include adjacent deletables.
			this.findDeletions(word.startIdx, endIdx, this.addDeletion.bind(this, terminalNode, wordNodes))
		}
	}
}

/**
 * Searches input for deletables that precede `startIdx` and/or follow `endIdx` if at the end of input. For each span of adjacent deletions, invokes `addDeletionFunc` with three arguments: (delStartIdx, delEndIdx, deletionCost).
 *
 * @param {number} startIdx The start index of the terminal symbol in input.
 * @param {number} endIdx The end index of the terminal symbol in input.
 * @param {Function} addDeletionFunc The function invoked per continuous span of adjacent deletables.
 */
Parser.prototype.findDeletions = function (startIdx, endIdx, addDeletionFunc) {
	// Add nodes (in `this.addSub()`) to the input index of the terminal symbol's last lexical token.
	this.nodeTab = this.nodeTabs[endIdx]
	this.words = this.wordTab[endIdx]

	// Step backward checking for continuous spans of deletable tokens that end at the start of this terminal symbol.
	var delStartIdx = startIdx
	var deletionCost = 0
	var deletion
	while (deletion = this.deletions[--delStartIdx]) {
		deletionCost += deletion.cost

		// Create new nodes based on `origWordNodes` for the span beginning with the deletable(s) at `delStartIdx` and ending with this terminal symbol. Each new node has a cost penalty equal to the number of deleted tokens.
		addDeletionFunc(delStartIdx, endIdx, deletionCost)
	}

	// Check if all remaining tokens in input (that follow this terminal symbol) are deletable.
	if (deletion = this.deletions[endIdx + 1]) {
		endIdx += deletion.length
		if (endIdx === this.tokensLen - 1) {
			delStartIdx = startIdx
			deletionCost = deletion.followingCost

			// Create new nodes based on `wordNodes` for the span beginning with this terminal symbol and ending with the deletables that extend to the end of input, and for each distinct span of preceding deletables found above, if any, ending with the deletables that extend to the end of input. Each new node has a cost penalty equal to the number of deleted tokens.
			do {
				deletionCost += deletion.cost
				this.nodeTab = this.nodeTabs[endIdx]
				this.words = this.wordTab[endIdx]

				addDeletionFunc(delStartIdx, endIdx, deletionCost)
			} while (deletion = this.deletions[--delStartIdx])
		}
	}
}

/**
 * Create nodes for terminal rules that produce `terminalSym`.
 *
 * @memberOf Parser
 * @param {Object} terminalSym The terminal symbol.
 * @param {number} startIdx The start index of a terminal symbol in input.
 * @param {number} endIdx The end index of a terminal symbol in input.
 * @param {Object[]} [semanticArg] The semantic argument if the terminal symbol is a placeholder (i.e., the semantic created from an entity or integer in input).
 * @param {string} [text] The display text if the terminal symbol is a placeholder (i.e., entities and integers).
 * @param {number} [costPenalty] The cost penalty if the terminal symbol is an entity with deletions and/or insertions.
 */
Parser.prototype.addWordNodes = function (terminalSym, startIdx, endIdx, semanticArg, text, costPenalty) {
	// The span of the terminal symbol match, including deletions.
	var wordSize = endIdx - startIdx + 1

	// The unique node for `terminalSym`. There can only be one match per terminal symbol per index. Hence, there will not be duplicate terminal nodes at the same index (just as nonterminal nodes) despite not checking existing nodes. However, there can be multiple matches at the same index to the same entity category, which is the same terminal symbol, though for different entities within the category. The node's parent subnode's `ruleProps` distinguishes these terminal nodes. Though those nodes are identical, they must both exist for `subIsNew()` to distinguish the subnodes (because `subIsNew()` does not check `ruleProps`).
	var terminalNode = {
		sym: terminalSym,
		size: wordSize,
		startIdx: startIdx,
	}

	// The terminal rules that produce `terminalSym`.
	var rules = terminalSym.rules
	// The nodes for `rules`.
	var wordNodes = []
	// The cost penalty associated with the terminal symbol match. This can be a deletion cost for adjacent symbols, or an insertion cost for a partial match to a multi-token entity.
	if (costPenalty === undefined) costPenalty = 0

	// Add a node for each terminal rule that produces `terminalSym`.
	for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
		var rule = rules[r]

		var terminalSub = {
			node: terminalNode,
			size: wordSize,
			ruleProps: undefined,
			minCost: 0,
		}

		// Recreate `ruleProps` if terminal symbol is a placeholder and special display text and creates a semantic argument from input.
		if (semanticArg) {
			var origRuleProps = rule.ruleProps
			terminalSub.ruleProps = {
				cost: origRuleProps.cost + costPenalty,
				// Use the semantic argument created from input (e.g., an entity or integer).
				semantic: origRuleProps.semantic ? semantic.reduce(origRuleProps.semantic, semanticArg) : semanticArg,
				// Entities: use saved text with correct capitalization.
				// Integers: use string of the number to avoid converting number to string later.
				text: text,
			}
		} else {
			terminalSub.ruleProps = rule.ruleProps
		}

		// Create a node with the LHS of the terminal rule. (In `StateTable`, the LHS of terminal rules is `rhs`.)
		var node = this.addSub(rule.rhs[0], terminalSub)
		// If `node` did not already exists (for another subnode at this index), then add it to the current index of `wordTab`.
		if (node) wordNodes.push(node)
	}

	if (wordNodes.length > 0) {
		// Save the (new) nodes for the terminal rules for `terminalSym` to the last index of the match's span (including deletions) within the input query.
		this.words.push({
			startIdx: startIdx,
			nodes: wordNodes,
		})
	}
}

/**
 * Create new nodes based on `wordNodes` with spans and cost penalties that include adjacent deletables.
 *
 * @param {Object} terminalNode The node for the terminal symbol to check for adjacent deletables.
 * @param {Object[]} wordNodes The nodes for the terminal rules that produce `terminalNode`.
 * @param {number} startIdx The start index of the span of the terminal symbol and deletables.
 * @param {number} endIdx The end index of the span of the terminal symbol and deletables.
 * @param {number} costPenalty The cost penalty for the deletions, which is equal to 1 per deleted token.
 */
Parser.prototype.addDeletion = function (terminalNode, wordNodes, startIdx, endIdx, costPenalty) {
	// The nodes for terminal rules that produce the `terminalSym`.
	var newWordNodes = []
	// The size (i.e., span) of the terminal symbol and surround deletions.
	var wordSize = endIdx - startIdx + 1

	// For each terminal rule, create a new node with a deletion cost penalty and the new token span.
	for (var n = 0, origWordNodesLen = wordNodes.length; n < origWordNodesLen; ++n) {
		var oldNode = wordNodes[n]
		// Get ruleProps from the first sub because there will always be one. There are never two instances of the same terminal symbol for the same nonterminal symbol because that would be a duplicate rule.
		var oldRuleProps = oldNode.subs[0].ruleProps

		var sub = {
			node: terminalNode,
			// The number of lexical tokens spanned by this node.
			size: wordSize,
			ruleProps: {
				// Add cost penalty of 1 per deleted token.
				cost: oldRuleProps.cost + costPenalty,
				// Reuse previously created semantic arguments or semantic reductions.
				semantic: oldRuleProps.semantic,
				// Reuse previously determined text (e.g., properly capitalized).
				text: oldRuleProps.text,
			},
			minCost: 0,
		}

		var newNode = this.addSub(oldNode.sym, sub)
		newNode.startIdx = startIdx
		newWordNodes.push(newNode)
	}

	// Add new nodes at the index of the end of their span.
	this.words.push({
		startIdx: startIdx,
		nodes: newWordNodes,
	})
}

/**
 * Gets the semantic argument for `semanticArgName` if it exists, else creates and returns a new semantic argument. This prevents duplicate semantic arguments in the parse forest to enable equality checks by object reference (as opposed to having to check the semantic `name` property).
 *
 * @memberOf Parser
 * @param {string} semanticArgName The semantic argument name.
 * @returns {Object[]} Returns the semantic argument for `semanticArgName`.
 */
Parser.prototype.getSemanticArg = function (semanticArgName) {
	return this.semanticArgTab[semanticArgName] || (this.semanticArgTab[semanticArgName] = [ {
		semantic: {
			name: semanticArgName,
		}
	} ])
}

/**
 * Appends to the end of `nodeTabs` an array with the node that produces the `<blank>` symbol to enable insertion rules that are only recognized at the end of the input query.
 *
 * The node has `size` of 0, which enable the returned parse forest to include both trees that end with the `<blank>` symbol and those without, which would otherwise be excluded because of a different size (and seemingly not spanning the entire input).
 *
 * @memberOf Parser
 */
Parser.prototype.addBlankNode = function () {
	this.wordTab[this.tokensLen] = [ {
		startIdx: this.tokensLen,
		nodes: this.stateTable.blankWordNodeArray,
	} ]
}