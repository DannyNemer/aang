var util = require('../util/util')
var initSemantics = require('./initSemantics')
var initEntities = require('./initEntities')

/**
 * The `StateTable` constructor, which generates a shift-reduce parse table from `grammar`.
 *
 * @constructor
 * @param {Object} grammar The input grammar.
 * @param {Object} grammar.ruleSets The map of nonterminal symbols to rules.
 * @param {Object} grammar.semantics The map of semantic names to semantics.
 * @param {Object} grammar.entitySets The map of entity tokens to entities.
 * @param {Object[]} grammar.intSymbols The integer symbols with specified value ranges.
 * @param {string[]} grammar.deletables The terms that can be deleted when found in input.
 * @param {string} grammar.startSymbol The name of the start symbol used in `grammar.ruleSets`.
 * @param {string} grammar.blankSymbol The name of the blank terminal symbol used in `grammar.ruleSets`.
 */
function StateTable(grammar) {
	// Initialize the semantics of rules in `grammar` for parsing by replacing identical semantic functions, semantic nodes, and semantic arrays with references to the same object. Must occur before `StateTable.prototype.addRules()`, which creates new `ruleProps` objects from `grammar.ruleSets`.
	initSemantics(grammar.ruleSets, grammar.semantics)

	// Initialize the entities in `grammar` for parsing by replacing multiple instances of the same entity with references to the same object.
	initEntities(grammar.entitySets)

	// The map of nonterminal symbol names to their symbol object.
	this.nonterminalSymTab = {}
	// The map of terminal symbol names to their symbol object. Used by `Parser` for terminal symbol lookup.
	this.terminalSymTab = {}
	// The map of placeholder symbol names (e.g., entity categories) to their symbol objecftobject. Used by `Parser` for placeholder symbol lookup.
	this.placeholderSymTab = {}
	// The number of symbols in this `StateTable` instance.
	this.symbolCount = 0
	// The states of this `StateTable` instance.
	this.states = []

	// Add the symbols and rules in `ruleSets` to this `StateTable` instance. Invoke this method before `StateTable.prototype.generate()`.
	this.addRules(grammar.ruleSets)

	// Generate the state table from the grammar's rules.
	this.generate(this.lookUp(grammar.startSymbol))

	// Generate the `Parser` node set for the `<blank>` symbol, which `Parser` appends to the end of the array of nodes that produce the input query's matched terminal symbols. This enables `Parser` to accept insertion rules that are only recognized at the end of an input query.
	this.blankNodeArray = this.createBlankInsertedNodeArray(grammar.blankSymbol)

	// The map of tokens to entities for matching input lexical tokens to terminal rules for specified entity categories.
	this.entitySets = grammar.entitySets
	// The array of integer symbols for matching integers in the input query to terminal rules for integers with specified value bounds.
	this.intSymbols = grammar.intSymbols
	// The array of deletables for constructing additional parse trees with the specified input tokens deleted at a cost.
	this.deletables = grammar.deletables
}

/**
 * Adds the symbols and rules in `ruleSets` to this `StateTable` instance. Invoke this method before `StateTable.prototype.generate()`.
 *
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
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
 * Adds a grammar symbol to the `StateTable` if it is new, otherwise returns the existing rule.
 *
 * @memberOf StateTable
 * @param {string} symbolName The symbol name.
 * @param {boolean} [isTerminal] Specify this is a terminal symbol.
 * @param {boolean} [isPlaceholder] Specify the symbol is a placeholder symbol.
 * @returns {Object} Returns the symbol.
 */
StateTable.prototype.lookUp = function (symbolName, isTerminal, isPlaceholder) {
	var symbol

	if (isPlaceholder) {
		// Separate placeholder symbols from terminal symbols to prevent matching those symbols in input. E.g., integer symbols, entity category names (e.g., `{user}`), and `<blank>`.
		symbol = this.placeholderSymTab[symbolName]

		if (!symbol) {
			symbol = this.placeholderSymTab[symbolName] = this.newSymbol(symbolName, true)
		}
	} else if (isTerminal) {
		symbol = this.terminalSymTab[symbolName]

		if (!symbol) {
			symbol = this.terminalSymTab[symbolName] = this.newSymbol(symbolName, true)
		}
	} else {
		symbol = this.nonterminalSymTab[symbolName]

		if (!symbol) {
			symbol = this.nonterminalSymTab[symbolName] = this.newSymbol(symbolName)
		}
	}

	return symbol
}

/**
 * Create a new symbol.
 *
 * @param {string} name The symbol name.
 * @param {boolean} [isTerminal] Specify this is a terminal symbol.
 * @returns {Object} Returns the new symbol.
 */
StateTable.prototype.newSymbol = function (name, isTerminal) {
	return {
		// Only used for printing (i.e., debugging).
		name: name,
		index: this.symbolCount++,
		isTerminal: !!isTerminal,
		rules: [],
	}
}

/**
 * Adds a grammar rule to the `StateTable` instance if unique.
 *
 * @memberOf StateTable
 * @param {Object} sym The LHS symbol for nonterminal rules, and the RHS symbol for terminal rules.
 * @param {Object[]} symBuf The RHS symbols for nonterminal rules, and the LHS symbol for terminal rules.
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
			diff = symBuf[s].index - existingRuleRHS[s].index
			if (diff) break
		}

		if (diff === 0 && s >= existingRuleRHSLen) {
			if (s >= symBufLen) {
				// When multiple insertions exist for the same symbol with the same non-inserted RHS symbol, the `ruleProps` for those insertions are stored in an array for a single action in the state table, and hence a single node in the parse forest.
				// - Assuming grammar rules are sorted by increasing cost.
				// - Assuming grammar doesn't have duplicates.
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
 * Creates an object holding the `rule`'s properties needed for forest-search but not needed for parsing. This reduces the memory required for a `StateTable` instance once the input grammar (i.e., its rules) are removed from memory.
 *
 * @private
 * @static
 * @param {Objct} rule The original rule holding the properties.
 * @returns {Object} Returns the new object with all of the rule's properties.
 */
function createRuleProps(rule) {
	var ruleProps = {
		cost: rule.cost,
	}

	if (rule.insertedSymIdx !== undefined) {
		ruleProps.insertedSymIdx = rule.insertedSymIdx
	}

	if (!rule.isTerminal) {
		ruleProps.isNonterminal = true

		// Specify nonterminal rules whose RHS produces neither display text nor semantics. This enables `calcHeuristicCosts` to reduce the associated node's subnode's costs (which include deletion costs on the terminal nodes) so that `pfsearch` does not wastefully traverse those subnodes. This includes nonterminal substitutions and stop-words created from regex-style terminal rules, and rules that produce only stop-words. In addition, this enables these nonterminal rules to share existing terminal rules that also have `text` values by only using their `text` value and not traversing those nodes.
		if (rule.rhsDoesNotProduceText) {
			ruleProps.rhsDoesNotProduceText = true
		}
	}

	if (rule.isTransposition) {
		ruleProps.isTransposition = true
	}

	if (rule.semantic !== undefined) {
		ruleProps.semantic = rule.semantic
	}

	if (rule.insertedSemantic !== undefined) {
		ruleProps.insertedSemantic = rule.insertedSemantic
	}

	if (rule.semanticIsReduced) {
		ruleProps.semanticIsReduced = true
	}

	if (rule.rhsCanProduceSemantic) {
		ruleProps.rhsCanProduceSemantic = true
	}

	// `secondRHSCanProduceSemantic` is checked at binary, non-insertion rules. Convert to an integer so that it can properly increment `nextItemList.nodeCount` in `pfsearch` as the number of nodes in `nextItemList` that can produce a semantic.
	if (rule.rhs.length === 2 && rule.insertedSymIdx === undefined) {
		ruleProps.secondRHSCanProduceSemantic = Number(rule.secondRHSCanProduceSemantic)
	}

	if (rule.text !== undefined) {
		ruleProps.text = rule.text
	}

	// For terminal rules and nonterminal rules created from regex-style terminal rules, specify the tense that is checked against the parent nonterminal rules' `acceptedTense` property to determine if this symbol is an acceptable form of the associated verb (though not enforced by default).
	if (rule.tense) {
		ruleProps.tense = rule.tense
	}

	if (rule.personNumber) {
		ruleProps.personNumber = rule.personNumber
	}

	if (rule.gramProps) {
		ruleProps.gramProps = rule.gramProps
	}

	if (rule.anaphoraPersonNumber) {
		ruleProps.anaphoraPersonNumber = rule.anaphoraPersonNumber
	}

	return ruleProps
}


/**
 * Generates the `Parser` node for the `<blank>` symbol, which `Parser` appends to the end of the array of nodes that produce the input query's matched terminal symbols. This enables `Parser` to accept insertion rules that are only recognized at the end of an input query.
 *
 * @memberOf StateTable
 * @param {string} blankSymbolName The name of the blank terminal symbol of `ruleSets`.
 * @returns {Object[]} Returns the array containing the nonterminal node that produces `<blank>`.
 */
StateTable.prototype.createBlankInsertedNodeArray = function (blankSymbolName) {
	var blankSymbol = this.placeholderSymTab[blankSymbolName]

	var blankNode = {
		sym: blankSymbol,
		size: 0,
		// Only used for debugging.
		startIdx: undefined,
	}

	var blankInsertedRule = blankSymbol.rules[0]

	var blankSub = {
		node: blankNode,
		size: 0,
		ruleProps: blankInsertedRule.ruleProps,
		minCost: 0,
	}

	// Set `size` to 0 to enable `Parser` to include in the parse forest both trees that end with the `<blank>` symbol and those without, which would otherwise be excluded because of a different size (and seemingly not spanning the entire input).
	var blankInsertedNode = {
		sym: blankInsertedRule.rhs[0],
		size: 0,
		startIdx: undefined,
		subs: [ blankSub ],
	}

	// Return the node in an array for use in every parse as the last index's node set.
	return [ blankInsertedNode ]
}

/**
 * Compares two rules.
 *
 * @private
 * @static
 * @param {Object} a The rule to compare.
 * @param {Object} b The other rule to compare.
 * @returns {number} Returns less than `0` to sort `a` before `b`, `0` to leave `a` and `b` unchanged, and greater than `1` to sort `b` before `a`.
 */
function compRules(a, b) {
	var diff = a.lhs ? (b.lhs ? a.lhs.index - b.lhs.index : 1) : (b.lhs ? -1 : 0)
	if (diff) return diff

	diff = a.rhsIdx - b.rhsIdx
	if (diff) return diff

	var rhsA = a.rhs
	var rhsB = b.rhs
	for (var s = 0; rhsA[s] && rhsB[s]; ++s) {
		diff = rhsA[s].index - rhsB[s].index
		if (diff) break
	}

	return rhsA[s] ? (rhsB[s] ? diff : 1) : (rhsB[s] ? -1 : 0)
}

/**
 * Adds `newRules` to `ruleSets` if unique, as a set of rules to convert to a state.
 *
 * @private
 * @static
 * @param {Object[][]} ruleSets The `StateTable` instance's exiting sets of rules.
 * @param {Object[]} newRules The new set of rules to add to `ruleSets`.
 * @returns {number} Returns the index of `newRules` in `ruleSets`, which becomes the state index.
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
 * Generates the `StateTable`, a shift-reduce parse table, from the input grammar.
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
		var newState = { reds: [], shifts: [] }

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
					// Always include this value (as opposed to only when `true`) to enforce monomorphism for `Parser.prototype.reduce()`.
					isBinary: rule.rhs.length === 2,
				})
			} else {
				newState.isFinal = true
			}
		}

		for (var i = 0, shiftsLen = shifts.length; i < shiftsLen; ++i) {
			var shift = shifts[i]

			// Map `symbol.index` to next state indexes.
			newState.shifts[shift.sym.index] = addState(ruleSets, shift.rules)
		}

		this.states.push(newState)
	}

	// Extend `state.shifts` to map `symbol.index` to the next state for `symbol`, if any (instead of the next state's index).
	for (var s = 0, statesLen = this.states.length; s < statesLen; ++s) {
		var shifts = this.states[s].shifts

		var symIndexes = Object.keys(shifts)
		for (var i = 0, symIndexesLen = symIndexes.length; i < symIndexesLen; ++i) {
			var symIndex = Number(symIndexes[i])
			shifts[symIndex] = this.states[shifts[symIndex]]
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
 * (a) ACCEPT - This indicates that state 1 is the accepting state of the LR(0) parser. The accepting state will always be state 1.
 *   1:
 *     accept
 *
 * (b) SHIFTS and GOTOS - This example indicates a shift (or goto) on item "c" from state 3 to state 8. The difference between shifts and gotos in LR(k) parsing has no bearing here, so they are listed in a common format.
 *   3:
 *     c => 8
 *
 * (c) REDUCTIONS - This indicates that in state 4, a reduction action may be applied whereby the last two items on the parsing stack (which will always be nodes of types X and Y) are to be combined into a new node of type X. A goto on the item X is then executed from the state located two levels back in the stack to a new state.
 *   4:
 *     [X -> X Y]
 *
 * @memberOf StateTable
 */
StateTable.prototype.print = function () {
	this.nonterminalSyms = Object.keys(this.nonterminalSymTab)

	for (var s = 0, statesLen = this.states.length; s < statesLen; ++s) {
		var state = this.states[s]

		util.log(util.colors.yellow(s) + ':')

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
		var symIndexes = Object.keys(shifts)
		for (var i = 0, symIndexesLen = symIndexes.length; i < symIndexesLen; ++i) {
			var symIndex = Number(symIndexes[i])
			util.log('\t' + this.indexToSymbolName(symIndex), '=>', this.states.indexOf(shifts[symIndex]))
		}
	}
}

/**
 * Gets the name of the symbol identified by `index`.
 *
 * @memberOf StateTable
 * @param {number} index The symbol's index.
 * @returns {string} Returns the symbol's name.
 */
StateTable.prototype.indexToSymbolName = function (index) {
	for (var s = 0, symsLen = this.nonterminalSyms.length; s < symsLen; ++s) {
		var symbol = this.nonterminalSymTab[this.nonterminalSyms[s]]

		if (symbol.index === index) {
			return symbol.name
		}
	}
}

// Export `StateTable`.
module.exports = StateTable