var util = require('../../util/util')
var initSemantics = require('./initSemantics')
var initEntities = require('./initEntities')

/**
 * The `StateTable` constructor, which generates a shift-reduce parse table
 * from `grammar`.
 *
 * @constructor
 * @param {Object} grammar The input grammar.
 * @param {Object} grammar.ruleSets The map of nonterminal symbols to rules.
 * @param {Object} grammar.semantics The map of semantic names to semantics.
 * @param {Object} grammar.entitySets The map of entity tokens to entities.
 * @param {Object[]} grammar.intSymbols The integer symbols with specified
 * value ranges.
 * @param {string[]} grammar.deletables The terms that can be deleted when
 * found in input.
 * @param {string} grammar.startSymbol The name of the start symbol used in
 * `grammar.ruleSets`.
 * @param {string} grammar.blankSymbol The name of the blank terminal symbol
 * used in `grammar.ruleSets`.
 */
function StateTable(grammar) {
	/**
	 * Initialize the semantics of rules in `grammar` for parsing by replacing
	 * identical semantic functions, semantic nodes, and semantic arrays with
	 * references to the same object. Must occur before
	 * `StateTable.prototype.addRules()`, which creates new `ruleProps`
	 * objects from `grammar.ruleSets`.
	 */
	initSemantics(grammar.ruleSets, grammar.semantics)

	// Initialize the entities in `grammar` for parsing by replacing multiple
	// instances of the same entity with references to the same object.
	initEntities(grammar.entitySets)

	// The map of nonterminal symbol names to their symbol object.
	this.nonterminalSymTab = {}
	// The map of terminal symbol names to their symbol object. Used by `Parser`
	// for terminal symbol lookup.
	this.terminalSymTab = {}
	// The map of placeholder symbol names (e.g., entity categories) to their
	// symbol object. Used by `Parser` for placeholder symbol lookup.
	this.placeholderSymTab = {}
	/**
	 * The numbers of terminal and nonterminal symbols in this instance, for
	 * assigning symbol ids. Separate nonterminal and terminal symbols because
	 * `Parser` uses ids to map nonterminal symbols, and including the
	 * terminal ids would yield unnecessarily larger maps.
	 */
	this.termSymbolCount = 0
	this.nontermSymbolCount = 0
	// The states of this `StateTable` instance.
	this.states = []

	// Add the symbols and rules in `ruleSets` to this `StateTable` instance.
	// Invoke this method before `StateTable.prototype.generate()`.
	this.addRules(grammar.ruleSets)

	// Generate the state table from the grammar's rules.
	this.generate(this.lookUp(grammar.startSymbol))

	/**
	 * Generate the `Parser` node set for the `[blank-inserted]` symbol, which
	 * `Parser` appends to the end of the array of nodes that produce the
	 * input query's matched terminal rules. This enables `Parser` to accept
	 * insertion rules that are only recognized at the end of an input query.
	 */
	this.blankNodeArray = this.createBlankInsertedNodeArray(grammar.blankSymbol)

	// The map of tokens to entities for matching input lexical tokens to
	// terminal rules for specified entity categories.
	this.entitySets = grammar.entitySets
	// The array of integer symbols for matching integers in the input query to
	// terminal rules for integers with specified value bounds.
	this.intSymbols = grammar.intSymbols
	// The set of deletables for constructing additional parse trees with the
	// specified input tokens deleted at a cost.
	this.deletables = grammar.deletables.reduce(function (deletablesSet, deletable) {
		deletablesSet[deletable] = true
		return deletablesSet
	}, {})
}

/**
 * Adds the symbols and rules in `ruleSets` to this `StateTable` instance.
 * Invoke this method before `StateTable.prototype.generate()`.
 *
 * @memberOf StateTable
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to
 * rules.
 */
StateTable.prototype.addRules = function (ruleSets) {
	for (var nontermSym in ruleSets) {
		var lhsSym = this.lookUp(nontermSym)
		var lhsSymArray = [ lhsSym ]

		var rules = ruleSets[nontermSym]
		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var rule = rules[r]

			if (rule.isTerminal) {
				insertRule(this.lookUp(rule.rhs[0], true, rule.isPlaceholder), lhsSymArray, rule)
			} else {
				var newRuleRHS = []
				var ruleRHS = rule.rhs

				for (var s = 0, ruleRHSLen = ruleRHS.length; s < ruleRHSLen; ++s) {
					newRuleRHS[s] = this.lookUp(ruleRHS[s])
				}

				insertRule(lhsSym, newRuleRHS, rule)
			}
		}
	}
}

/**
 * Adds a grammar symbol to the `StateTable` if it is new, otherwise returns
 * the existing rule.
 *
 * @memberOf StateTable
 * @param {string} symbolName The symbol name.
 * @param {boolean} [isTerminal] Specify this is a terminal symbol.
 * @param {boolean} [isPlaceholder] Specify the symbol is a placeholder
 * symbol.
 * @returns {Object} Returns the symbol.
 */
StateTable.prototype.lookUp = function (symbolName, isTerminal, isPlaceholder) {
	if (isPlaceholder) {
		// Separate placeholder symbols from terminal symbols to prevent matching
		// those symbols in input. E.g., integer symbols, entity category names
		// (e.g., `{user}`), and `<blank>`.
		return this.placeholderSymTab[symbolName] ||
			(this.placeholderSymTab[symbolName] = this.newSymbol(symbolName, true))
	} else if (isTerminal) {
		return this.terminalSymTab[symbolName] ||
			(this.terminalSymTab[symbolName] = this.newSymbol(symbolName, true))
	} else {
		return this.nonterminalSymTab[symbolName] ||
			(this.nonterminalSymTab[symbolName] = this.newSymbol(symbolName))
	}
}

/**
 * Creates a new symbol.
 *
 * @memberOf StateTable
 * @param {string} name The symbol name.
 * @param {boolean} [isTerminal] Specify this is a terminal symbol.
 * @returns {Object} Returns the new symbol.
 */
StateTable.prototype.newSymbol = function (name, isTerminal) {
	return {
		// Only used for printing (i.e., debugging).
		name: name,
		id: isTerminal ? this.termSymbolCount++ : this.nontermSymbolCount++,
		isTerminal: !!isTerminal,
		rules: [],
	}
}

/**
 * Adds a grammar rule to the `StateTable` instance if unique.
 *
 * @memberOf StateTable
 * @param {Object} sym The LHS symbol for nonterminal rules, and the RHS
 * symbol for terminal rules.
 * @param {Object[]} symBuf The RHS symbols for nonterminal rules, and the
 * LHS symbol for terminal rules.
 * @param {Object} origRule The original grammar rule.
 */
function insertRule(sym, symBuf, origRule) {
	var symBufLen = symBuf.length
	var existingRules = sym.rules

	for (var r = 0, existingRulesLen = existingRules.length; r < existingRulesLen; ++r) {
		var existingRule = existingRules[r]
		var existingRuleRHS = existingRule.rhs
		var existingRuleRHSLen = existingRuleRHS.length
		var diff

		for (var s = 0; s < symBufLen && s < existingRuleRHSLen; ++s) {
			diff = symBuf[s].id - existingRuleRHS[s].id
			if (diff) break
		}

		if (diff === 0 && s >= existingRuleRHSLen) {
			if (s >= symBufLen) {
				/**
				 * When multiple insertions exist for the same symbol with the same
				 * non-inserted RHS symbol, the `ruleProps` for those insertions are
				 * stored in an array for a single action in the state table, and
				 * hence a single node in the parse forest.
				 * • Assuming grammar rules are sorted by increasing cost.
				 * • Assuming grammar doesn't have duplicates.
				 */
				existingRule.ruleProps = [].concat(existingRule.ruleProps, createRuleProps(origRule))
				return
			} else {
				break
			}
		} else if (diff > 0) {
			break
		}
	}

	existingRules.splice(r, 0, {
		// For terminal symbols, `rhs` is the rule's LHS.
		rhs: symBuf,
		ruleProps: createRuleProps(origRule),
	})
}

/**
 * Creates an object holding the `rule`'s properties needed for
 * forest-search but not needed for parsing. This reduces the memory
 * required for a `StateTable` instance once the input grammar (i.e., its
 * rules) are removed from memory.
 *
 * @private
 * @static
 * @param {Objct} rule The original rule holding the properties.
 * @returns {Object} Returns the new object with all of the rule's
 * properties.
 */
function createRuleProps(rule) {
	var ruleProps = {
		// The base rule cost. Including the epsilon rule cost, semantic cost (if
		// any), and any edit cost penalties (for substitutions, transposition, or
		// insertions).
		cost: rule.cost,
	}

	if (rule.insertedSymIdx !== undefined) {
		ruleProps.insertedSymIdx = rule.insertedSymIdx

		// If `buildGrammar` ran with '--trees' option, then include the insertion
		// rules' parse trees (which form the insertions) if printing the graph
		// representations of the `phsearch` parse trees.
		if (rule.tree) {
			ruleProps.tree = rule.tree
		}
	}

	if (!rule.isTerminal) {
		ruleProps.isNonterminal = true

		/**
		 * Specify nonterminal rules whose RHS produces neither display text nor
		 * semantics. This enables `flattenTermSequence` to reduce the
		 * associated node's subnode's costs (which include deletion costs on
		 * the terminal nodes) so that `pfsearch` does not wastefully traverse
		 * those subnodes. This includes nonterminal substitutions and
		 * stop-words created from regex-style terminal rules, and rules that
		 * produce only stop-words.
		 *
		 * In addition, this enables these nonterminal rules to share existing
		 * terminal rules that also have `text` values by only using their
		 * `text` value and not traversing those nodes.
		 */
		if (rule.rhsDoesNotProduceText) {
			ruleProps.rhsDoesNotProduceText = true
		}

		// Specify `rule.rhs` produces only terminal rule sets; i.e., consecutive
		// single-token terminal rules.
		else if (rule.isTermSequence) {
			ruleProps.isTermSequence = true

			/**
			 * If the nonterminal term sequence has `insertedSymIdx`, then it is an
			 * insertion term sequence.
			 *
			 * This instructs `flattenTermSequence` to traverse the single child
			 * node `rule` produces to get the matched terminal rule `text`.
			 * `flattenTermSequence` merges this `text` with the insertion `text`
			 * according to `rule.insertedSymIdx`. For example:
			 *   `[contribute-to]` -> `[contribute]`, text: "to"
			 *                     -> "contribute" (input), text: `{contribute-verb-forms}`
			 *                     -> text: `[ {contribute-verb-forms}, "to" ]` (merged text values)
			 *
			 * `flattenTermSequence` also gets the input tense of any verb terminal
			 * rule its single child node (i.e., `rule.rhs`) produces to maintain
			 * optional tense if the parent rule of `rule` has matching
			 * `acceptedTense`. For example:
			 *   `[contribute-to]` -> `[contribute]`, text: "to"
			 *                     -> "contributed" (input), text: `{contribute-verb-forms}`
			 *                     -> text: "contributed to" (merged text values)
			 */
			if (rule.insertedSymIdx !== undefined) {
				if (!rule.text) {
					util.logError('Term sequence insertion lacks `text`:', rule)
					throw new Error('Ill-formed term sequence insertion')
				}

				ruleProps.text = rule.text
			}

			/**
			 * If the nonterminal term sequence has `text` and no `insertedSymIdx`,
			 * then it is a multi-token substitution term sequence.
			 *
			 * This instructs `pfsearch` to use this rule's `text` property instead
			 * of the matched terminal rules it produces. For example:
			 *   `[contribute-to]` -> `[work-verb]` `[on]` (input) -> text: `[ {contribute-verb-forms}, "to" ]`
			 *
			 * `flattenTermSequence` will, however, traverse this rule's child nodes
			 * to get the input tense of any matched verb terminal rules to maintain
			 * tense for any verb substitutions in `text` if the parent rule  of
			 * `rule` has matching `acceptedTense` (i.e., maintain the tense if
			 * input, but do not conjugate to the tense if otherwise). For example:
			 *   `[contribute-to]` -> "worked on" (input) -> "contributed to" (past tense maintained).
			 */
			else if (rule.text) {
				ruleProps.text = rule.text
			}

			/**
			 * If the nonterminal term sequence has no `text`, then it is a normal
			 * term sequence.
			 *
			 * Without `text` or `insertedSymIdx`, `isTermSequence` alone instructs
			 * `flattenTermSequence` to traverse this rule's child nodes and do the following:
			 * 1. Merge the `text` values of the matched terminal rules (i.e., child
			 *    nodes).
			 * 2. Get the input tense of any matched verb terminal rules (for `text`
			 *    conjugation).
			 * 3. Assign both the merged `text` (#1) and input tense (#2), if any,
			 *    to this rule's node.
			 * 4. Mark this rule's node as terminal.
			 *
			 * This prevents `pfsearch` from traversing past this rule's (now
			 * terminal) node (to its child nodes), and instead use this node's
			 * merged `text` and input tense for display text.
			 *
			 * This operation reduces multiple instances of generating the same
			 * display text for the same subtree of adjacent terminal rules.
			 *
			 * This operation is also essential for conjugating verb phrases.
			 * Consider the following rules:
			 * 1. `[contribute-to]`   -> `[contribute-verb]` `[to]`
			 * 2. `[contribute-verb]` -> 'contributed', text: {contribute-verb-forms}
			 * The rule with the verb phrase `[contribute-to]` as a RHS symbol also
			 * has the necessary `gramProps` grammatical properties to conjugate the
			 * `text` object of `[contribute-verb]`. Hence, `flattenTermSequence`
			 * must bring the `[contribute-verb]` `text` object up one level
			 * (#2 -> #1 above).
			 *
			 * This rule can be unary and neither a substitution nor insertion. For
			 * example:
			 *   `[like]` -> `[love]` -> "love", "loves", "loved" text: `{love-verb-forms}`
			 */
		}

		/**
		 * Specify this binary nonterminal rule is a partial term sequence,
		 * where the symbol at the defined RHS index is a term sequence and the
		 * other is not. Instructs `flattenTermSequence` to flatten the binary
		 * node into an insertion node with the term sequence subnode's text as
		 * the insertion text.
		 */
		if (rule.rhsTermSequenceIndexes) {
			ruleProps.rhsTermSequenceIndexes = rule.rhsTermSequenceIndexes

			/**
			 * Assign `isTermSequence`, even though only one of the two child
			 * subnodes is a term sequence, to simplify the `calcHeuristicCosts`
			 * check for passing the subnode to `flattenTermSequence`.
			 * `flattenTermSequence` then properly checks for
			 * `ruleProps.rhsTermSequenceIndexes` to distinguish the subnode as a
			 * partial term sequence.
			 *
			 * In the grammar, partial term sequences lack this property because
			 * it would contradict the property's definition, which otherwise
			 * enables nesting complete term sequences (which this is not) within
			 * other term sequences.
			 *
			 * Note: Might amend the grammar generator to assign this property to
			 * partial term sequence rules as done here, and extend the generator
			 * to distinguish partial sequence to prevent their nesting.
			 */
			ruleProps.isTermSequence = true
		}

		/**
		 * Specify instructing `flattenTermSequence` to discard the display text
		 * the RHS symbol(s) at the defined index(es) produces when
		 * `flattenTermSequence` creates a new `ruleProps` from this rule's term
		 * sequence node.
		 */
		if (rule.rhsNoTextIndexes) {
			ruleProps.rhsNoTextIndexes = rule.rhsNoTextIndexes
		}

		/**
		 * Specify this nonterminal rule is a transposition edit, which
		 * instructs `Parser.prototype.reduce()` to swap the child nodes when
		 * reducing this rule's binary node.
		 */
		if (rule.isTransposition) {
			ruleProps.isTransposition = true
		}

		if (rule.personNumber) {
			ruleProps.personNumber = rule.personNumber
		}

		// The map of RHS index to the grammatical properties with which to
		// conjugate the term sequence at that RHS index.
		if (rule.gramProps) {
			ruleProps.gramProps = rule.gramProps
		}

		if (rule.anaphoraPersonNumber) {
			ruleProps.anaphoraPersonNumber = rule.anaphoraPersonNumber
		}
	}

	if (rule.semantic !== undefined) {
		ruleProps.semantic = rule.semantic

		if (rule.insertedSemantic !== undefined) {
			ruleProps.insertedSemantic = rule.insertedSemantic
		}

		if (rule.semanticIsReduced) {
			ruleProps.semanticIsReduced = true
		}
	}

	if (rule.rhsCanProduceSemantic) {
		ruleProps.rhsCanProduceSemantic = true
	}

	/**
	 * `secondRHSCanProduceSemantic` is checked at binary, non-insertion
	 * rules. Convert to an integer so that it can properly increment
	 * `nextItemList.nodeCount` in `pfsearch` as the number of nodes in
	 * `nextItemList` that can produce a semantic.
	 */
	if (rule.rhs.length === 2 && rule.insertedSymIdx === undefined) {
		ruleProps.secondRHSCanProduceSemantic = Number(rule.secondRHSCanProduceSemantic)
	}

	if (rule.text !== undefined) {
		ruleProps.text = rule.text
	}

	/**
	 * For terminal rules and nonterminal rules created from regex-style
	 * terminal rules, specify the tense that is checked against the parent
	 * nonterminal rules' `acceptedTense` property to determine if this symbol
	 * is an acceptable form of the associated verb (though not enforced by
	 * default).
	 */
	if (rule.tense) {
		ruleProps.tense = rule.tense
	}

	return ruleProps
}


/**
 * Generates the `Parser` node set for the `[blank-inserted]` symbol, which
 * `Parser` appends to the end of the array of nodes that produce the input
 * query's matched terminal rules. This enables `Parser` to accept insertion
 * rules that are only recognized at the end of an input query.
 *
 * @memberOf StateTable
 * @param {string} blankSymbolName The name of the blank terminal symbol of
 * `ruleSets`.
 * @returns {Object[]} Returns the array containing the nonterminal node
 * that produces `<blank>`.
 */
StateTable.prototype.createBlankInsertedNodeArray = function (blankSymbolName) {
	var blankSymbol = this.placeholderSymTab[blankSymbolName]

	var blankNode = {
		sym: blankSymbol,
		size: 0,
		// Only used for debugging.
		startIdx: undefined,
		minCost: 0,
	}

	var blankInsertedRule = blankSymbol.rules[0]

	var blankSub = {
		node: blankNode,
		size: 0,
		ruleProps: blankInsertedRule.ruleProps,
	}

	/**
	 * Set `size` to 0 to enable `Parser` to include in the parse forest both
	 * trees that end with the `<blank>` symbol and those without, which would
	 * otherwise be excluded because of a different size (and seemingly not
	 * spanning the entire input).
	 */
	var blankInsertedNode = {
		sym: blankInsertedRule.rhs[0],
		size: 0,
		startIdx: undefined,
		subs: [ blankSub ],
		minCost: 0,
	}

	// Return the node in an array for use in every parse as the last token
	// index's node set.
	return [ blankInsertedNode ]
}

/**
 * Compares two rules.
 *
 * @private
 * @static
 * @param {Object} a The rule to compare.
 * @param {Object} b The other rule to compare.
 * @returns {number} Returns less than `0` to sort `a` before `b`, `0` to
 * leave `a` and `b` unchanged, and greater than `1` to sort `b` before `a`.
 */
function compRules(a, b) {
	var diff = a.lhs ? (b.lhs ? a.lhs.id - b.lhs.id : 1) : (b.lhs ? -1 : 0)
	if (diff) return diff

	diff = a.rhsIdx - b.rhsIdx
	if (diff) return diff

	var rhsA = a.rhs
	var rhsB = b.rhs
	for (var s = 0; rhsA[s] && rhsB[s]; ++s) {
		diff = rhsA[s].id - rhsB[s].id
		if (diff) break
	}

	return rhsA[s] ? (rhsB[s] ? diff : 1) : (rhsB[s] ? -1 : 0)
}

/**
 * Adds `newRules` to `ruleSets` if unique, as a set of rules to convert to
 * a state.
 *
 * @private
 * @static
 * @param {Object[][]} ruleSets The `StateTable` instance's exiting sets of
 * rules.
 * @param {Object[]} newRules The new set of rules to add to `ruleSets`.
 * @returns {number} Returns the index of `newRules` in `ruleSets`, which
 * becomes the state index.
 */
function addState(ruleSets, newRules) {
	var newRuleSetLen = newRules.length
	for (var r = 0, ruleSetsLen = ruleSets.length; r < ruleSetsLen; ++r) {
		var existingRules = ruleSets[r]

		// Check if `existingRules` is identical to `newRules`.
		if (existingRules.length === newRuleSetLen) {
			for (var i = 0; i < newRuleSetLen; ++i) {
				if (compRules(existingRules[i], newRules[i]) !== 0) break
			}

			if (i === newRuleSetLen) {
				return r
			}
		}
	}

	// Subtract 1 to get `newRules` index.
	return ruleSets.push(newRules) - 1
}

/**
 * Gets a shift if it exists, otherwise creates a new shift.
 *
 * @private
 * @static
 * @param {Object[]} shifts The set of existing shifts to search.
 * @param {Object[]} rules The rules for the shift.
 * @param {Object} rhsSym The RHS symbol.
 * @returns {Object} Returns the shift.
 */
function getShift(shifts, rules, rhsSym) {
	for (var s = 0, shiftsLen = shifts.length; s < shiftsLen; ++s) {
		var shift = shifts[s]

		if (shift.sym === rhsSym) {
			return shift
		}
	}

	// No existing shift found.
	var newShift = { sym: rhsSym, rules: [] }
	shifts.push(newShift)

	// Rules from grammar.
	var rhsSymRules = rhsSym.rules
	for (var r = 0, rhsSymRulesLen = rhsSymRules.length; r < rhsSymRulesLen; ++r) {
		var rule = rhsSymRules[r]

		rules.push({
			lhs: rhsSym,
			rhs: rule.rhs,
			rhsIdx: 0,
			ruleProps: rule.ruleProps,
		})
	}

	return newShift
}

/**
 * Adds `rule` to `shift` if unique.
 *
 * @private
 * @static
 * @param {Object} shift The shift to hold `rule.
 * @param {Object} rule The rule to add.
 */
function addRuleToShift(shift, rule) {
	var existingRules = shift.rules
	for (var r = 0, existingRulesLen = existingRules.length; r < existingRulesLen; ++r) {
		var diff = compRules(existingRules[r], rule)

		if (diff === 0) return
		if (diff > 0) break
	}

	existingRules.splice(r, 0, {
		lhs: rule.lhs,
		rhs: rule.rhs,
		rhsIdx: rule.rhsIdx,
		ruleProps: rule.ruleProps,
	})
}

/**
 * Generates the `StateTable`, a shift-reduce parse table, from the input
 * grammar.
 *
 * @memberOf StateTable
 * @param {string} startSym The grammar's start symbol.
 */
StateTable.prototype.generate = function (startSym) {
	// Sets of rules yet to convert to states.
	var ruleSets = []

	var startRule = { rhs: [ startSym ], rhsIdx: 0 }
	addState(ruleSets, [ startRule ])

	for (var s = 0; s < ruleSets.length; ++s) {
		var rules = ruleSets[s].slice()
		var shifts = []
		var newState = {
			reds: [],
			shifts: [],
			// The index of the state within the state table. Used by
			// `Parser.prototype.addVertex()` to map state index to vertex zNodes
			// for the current input query parse index.
			index: this.states.length,
		}

		for (var r = 0; r < rules.length; ++r) {
			var rule = rules[r]

			if (rule.rhs[rule.rhsIdx]) {
				var rhsSym = rule.rhs[rule.rhsIdx]
				var shift = getShift(shifts, rules, rhsSym)

				// Add rule to list of rules that produce `rhsSym`.
				rule.rhsIdx++
				addRuleToShift(shift, rule)
				rule.rhsIdx--
			} else if (rule.lhs) {
				newState.reds.push({
					lhs: rule.lhs,
					// Only used for printing.
					rhs: rule.rhs,
					ruleProps: rule.ruleProps,
					// Always include this value (as opposed to only when `true`) to
					// enforce monomorphism for `Parser.prototype.reduce()`.
					isBinary: rule.rhs.length === 2,
				})
			} else {
				// Accepting state.
				newState.isFinal = true
			}
		}

		for (var i = 0, shiftsLen = shifts.length; i < shiftsLen; ++i) {
			var shift = shifts[i]

			// Map `symbol.id` to next state indexes.
			newState.shifts[shift.sym.id] = addState(ruleSets, shift.rules)
		}

		this.states.push(newState)
	}

	// Extend `state.shifts` to map `symbol.id` to the next state for `symbol`,
	// if any, instead of mapping to the next state's index.
	mapShiftsToStates(this.states)

	// Assign `cost` to `ruleProps` arrays (i.e., insertions) from its first
	// element (which is the cheapest `ruleProps` because it is sorted in
	// grammar generation) for use as its minimum cost in `calcHeuristicCosts`.
	cacheRulePropsArraysMinCost(this.nonterminalSymTab)
}

/**
 * Extends shifts to map `symbol.id` to the next state for `symbol`, if any,
 * instead of mapping to the next state's index.
 *
 * @private
 * @static
 * @param {Object[]} states The states with the shifts to map.
 */
function mapShiftsToStates(states) {
	for (var s = 0, statesLen = states.length; s < statesLen; ++s) {
		var shifts = states[s].shifts
		var symIds = Object.keys(shifts)

		for (var i = 0, symIdsLen = symIds.length; i < symIdsLen; ++i) {
			var symId = Number(symIds[i])
			shifts[symId] = states[shifts[symId]]
		}
	}
}

/**
 * Assigns `cost` to `ruleProps` arrays (i.e., insertions) from its first
 * element (which is the cheapest `ruleProps` because it is sorted in
 * grammar generation) for use as its minimum cost in `calcHeuristicCosts`.
 *
 * @private
 * @static
 * @param {Object} nonterminalSymTab The map of nonterminal symbol names to
 * their symbol object.
 */
function cacheRulePropsArraysMinCost(nonterminalSymTab) {
	for (var nontermSym in nonterminalSymTab) {
		var rules = nonterminalSymTab[nontermSym].rules

		for (var r = 0, rulesLen = rules.length; r < rulesLen; ++r) {
			var ruleProps = rules[r].ruleProps

			if (ruleProps.constructor === Array) {
				ruleProps.cost = ruleProps[0].cost
			}
		}
	}
}

/**
 * Prints the `StateTable` instance in the following format:
 *   <state>:
 *     <list of items>
 *     ...
 *
 * For example, the start state (state 0) can be listed as listed as:
 *   0:
 *     A => 1
 *     B => 2
 *     d => 3
 *
 * Items can be of any of the following forms:
 * (a) ACCEPT - This indicates that state 1 is the accepting state of the
 *     LR(0) parser. The accepting state will always be state 1.
 *   1:
 *     accept
 *
 * (b) SHIFTS and GOTOS - This example indicates a shift (or goto) on item "c"
 *     from state 3 to state 8. The difference between shifts and gotos in
 *     LR(k) parsing has no bearing here, so they are listed in a common
 *     format.
 *   3:
 *     c => 8
 *
 * (c) REDUCTIONS - This indicates that in state 4, a reduction action may be
 *     applied whereby the last two items on the parsing stack (which will
 *     always be nodes of types X and Y) are to be combined into a new node of
 *     type X. A goto on the item X is then executed from the state located
 *     two levels back in the stack to a new state.
 *   4:
 *     [X -> X Y]
 *
 * @memberOf StateTable
 * @param {boolean} [suppressStateIndexes] Specify suppressing state indexes
 * from output. This is useful for comparing output for different grammar
 * builds.
 */
StateTable.prototype.print = function (suppressStateIndexes) {
	this.nonterminalSyms = Object.keys(this.nonterminalSymTab)

	for (var s = 0, statesLen = this.states.length; s < statesLen; ++s) {
		var state = this.states[s]

		util.log(util.colors.yellow(suppressStateIndexes ? 'X' : s) + ':')

		if (state.isFinal) util.log('\taccept')

		var reds = state.reds
		for (var r = 0, redsLen = reds.length; r < redsLen; ++r) {
			var red = reds[r]

			var ruleStr = '\t[' + red.lhs.name + ' ->'

			var rhs = red.rhs
			for (var i = 0, rhsLen = rhs.length; i < rhsLen; ++i) {
				ruleStr += ' ' + rhs[i].name
			}

			ruleStr += ']'

			util.log(ruleStr, red.ruleProps)
		}

		var shifts = state.shifts
		var symIds = Object.keys(shifts)
		for (var i = 0, symIdsLen = symIds.length; i < symIdsLen; ++i) {
			var symId = Number(symIds[i])
			var symName = this.idToSymbolName(symId)
			var nextStateIdx = this.states.indexOf(shifts[symId])
			util.log('\t' + symName, suppressStateIndexes ? '' : '=> ' + util.colors.yellow(nextStateIdx))
		}
	}
}

/**
 * Gets the name of the symbol identified by `id`.
 *
 * @memberOf StateTable
 * @param {number} id The symbol's id.
 * @returns {string} Returns the symbol's name.
 */
StateTable.prototype.idToSymbolName = function (id) {
	for (var s = 0, symsLen = this.nonterminalSyms.length; s < symsLen; ++s) {
		var symbol = this.nonterminalSymTab[this.nonterminalSyms[s]]

		if (symbol.id === id) {
			return symbol.name
		}
	}
}

// Export `StateTable`.
module.exports = StateTable