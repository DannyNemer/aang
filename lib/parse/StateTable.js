var util = require('../util/util')


/**
 * The `StateTable` constructor.
 *
 * @constructor
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} startSymbol The name of the start symbol of `ruleSets`.
 * @param {string} blankSymbol The name of the blank terminal symbol of `ruleSets`.
 */
function StateTable(ruleSets, startSymbol, blankSymbol) {
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

	for (var nontermSym in ruleSets) {
		var lhsSym = this.lookUp(nontermSym)
		var lhsSymArray = [ lhsSym ]

		var rules = ruleSets[nontermSym]
		var rulesLen = rules.length
		for (var r = 0; r < rulesLen; ++r) {
			var rule = rules[r]

			if (rule.isTerminal) {
				insertRule(this.lookUp(rule.RHS[0], true, rule.isPlaceholder), lhsSymArray, rule)
			} else {
				var newRuleRHS = []
				var ruleRHS = rule.RHS
				var ruleRHSLen = ruleRHS.length

				for (var s = 0; s < ruleRHSLen; ++s) {
					newRuleRHS[s] = this.lookUp(ruleRHS[s])
				}

				insertRule(lhsSym, newRuleRHS, rule)
			}
		}
	}

	// Generate `StateTable`.
	this.generate(this.lookUp(startSymbol))

	// Generate the `Parser` node for `blankSymbol` which `Parser` appends to the end of the array of nodes that produce the input query's matched terminal symbols. This enables `Parser` to accept insertion rules that are only recognized at the end of an input query.
	this.blankWordNodes = [ this.createBlankInsertedNode(blankSymbol) ]
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
 * @param {boolean} isTerminal Specify this is a terminal symbol.
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
	var existingRules = sym.rules
	var existingRulesLen = existingRules.length
	for (var r = 0; r < existingRulesLen; ++r) {
		var existingRule = existingRules[r]
		var existingRuleRHS = existingRule.RHS
		var diff

		for (var i = 0; symBuf[i] && existingRuleRHS[i]; ++i) {
			diff = symBuf[i].index - existingRuleRHS[i].index
			if (diff) break
		}

		if (diff === 0 && !existingRuleRHS[i]) {
			if (!symBuf[i]) {
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
		// For terminal symbols, `RHS` is the rule's LHS.
		RHS: symBuf,
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

	// Specifies rules as nonterminal, except those that were originally multi-token terminal symbol substitutions and have `text` defined on this rule. This enables `calcHeuristicCosts` to reduce the associated nodes before `pfsearch` (to get their costs), so that `pfsearch` does not wastefully traverse those nodes which produce neither semantics nor text.
	if (!rule.isTerminal && !(rule.insertedSymIdx === undefined && rule.text) && !rule.isStopWord) {
		ruleProps.isNonterminal = true
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

	if (rule.semanticIsRHS) {
		ruleProps.semanticIsRHS = true
	}

	if (rule.rhsCanProduceSemantic) {
		ruleProps.rhsCanProduceSemantic = true
	}

	// `secondRHSCanProduceSemantic` is checked at binary, non-insertion rules. Convert to an integer so that it can properly increment `nextItemList.nodeCount` in `pfsearch` as the number of nodes in `nextItemList` that can produce a semantic.
	if (rule.RHS.length === 2 && rule.insertedSymIdx === undefined) {
		ruleProps.secondRHSCanProduceSemantic = Number(rule.secondRHSCanProduceSemantic)
	}

	if (rule.text !== undefined) {
		ruleProps.text = rule.text
	}

	if (rule.tense) {
		ruleProps.tense = rule.tense
	}

	if (rule.personNumber) {
		ruleProps.personNumber = rule.personNumber
	}

	if (rule.gramProps) {
		ruleProps.gramProps = rule.gramProps
	}

	return ruleProps
}


/**
 * Generates the `Parser` node for `blankSymbol`, which `Parser` appends to the end of the array of nodes that produce the input query's matched terminal symbols. This enables `Parser` to accept insertion rules that are only recognized at the end of an input query.
 *
 * @memberOf StateTable
 * @param {string} blankSymbol The name of the blank terminal symbol of `ruleSets`.
 * @returns {Object} The nonterminal node that produces `blankSymbol`.
 */
StateTable.prototype.createBlankInsertedNode = function (blankSymbol) {
	var blankSymbol = this.placeholderSymTab[blankSymbol]

	var blankNode = {
		sym: blankSymbol,
		size: 0,
		// This is only used for debugging.
		start: undefined,
	}

	var blankInsertedRule = blankSymbol.rules[0]

	var blankSub = {
		node: blankNode,
		size: 0,
		ruleProps: blankInsertedRule.ruleProps,
		minCost: 0,
	}

	// Set `size` to zero to enable the parse forest to return both trees that end with the `<blank>` symbol and those without, which would otherwise be excluded because of a different size (and seemingly not spanning the entire input).
	var blankInsertedNode = {
		sym: blankInsertedRule.RHS[0],
		size: 0,
		start: undefined,
		subs: [ blankSub ],
	}

	return blankInsertedNode
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
	var diff = a.LHS ? (b.LHS ? a.LHS.index - b.LHS.index : 1) : (b.LHS ? -1 : 0)
	if (diff) return diff

	diff = a.rhsIdx - b.rhsIdx
	if (diff) return diff

	var rhsA = a.RHS
	var rhsB = b.RHS
	for (var s = 0; rhsA[s] && rhsB[s]; ++s) {
		diff = rhsA[s].index - rhsB[s].index
		if (diff) break
	}

	return rhsA[s] ? (rhsB[s] ? diff : 1) : (rhsB[s] ? -1 : 0)
}

/**
 * Adds `newRules` to `ruleSets` if unique.
 *
 * @private
 * @static
 * @param {Object[][]} ruleSets The `StateTable` instance's exiting sets of rules.
 * @param {Object[]} newRules The new set of rules to add to `ruleSets`.
 * @returns {number} Returns the index of `newRules` in `ruleSets`.
 */
function addState(ruleSets, newRules) {
	var ruleSetsLen = ruleSets.length
	var newRuleSetLen = newRules.length
	for (var r = 0; r < ruleSetsLen; ++r) {
		var existingRules = ruleSets[r]
		var existingRulesLen = existingRules.length

		// Check if `existingRules` is identical to `newRules`.
		if (existingRulesLen === newRuleSetLen) {
			for (var i = 0; i < existingRulesLen; ++i) {
				if (compRules(existingRules[i], newRules[i]) !== 0) break
			}

			if (i === existingRulesLen) {
				return r
			}
		}
	}

	// Subtract 1 to get `newRules` index.
	return ruleSets.push(newRules) - 1
}

/**
 * Adds a `rule` to `shift`.
 *
 * @private
 * @static
 * @param {Object} shift The shift to hold `rule.
 * @param {Object} rule The rule to add.
 */
function addRule(shift, rule) {
	var existingRules = shift.rules
	var existingRulesLen = existingRules.length
	for (var r = 0; r < existingRulesLen; ++r) {
		var diff = compRules(existingRules[r], rule)

		if (diff === 0) return
		if (diff > 0) break
	}

	existingRules.splice(r, 0, {
		LHS: rule.LHS,
		RHS: rule.RHS,
		rhsIdx: rule.rhsIdx,
		ruleProps: rule.ruleProps,
	})
}

/**
 * Gets a shift if it exists, otherwise create a new shift.
 *
 * @private
 * @static
 * @param {Object[]} shifts The set of existing shifts to search.
 * @param {Object[]} rules The rules for the shift.
 * @param {Object} rhsSym The RHS symbol.
 * @returns {Object} Returns the shift.
 */
function getShift(shifts, rules, rhsSym) {
	var shiftsLen = shifts.length
	for (var s = 0; s < shiftsLen; ++s) {
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
	var rhsSymRulesLen = rhsSymRules.length
	for (var r = 0; r < rhsSymRulesLen; ++r) {
		var rule = rhsSymRules[r]

		rules.push({
			LHS: rhsSym,
			RHS: rule.RHS,
			rhsIdx: 0,
			ruleProps: rule.ruleProps,
		})
	}

	return newShift
}

/**
 * Generates the `StateTable`.
 *
 * @memberOf StateTable
 * @param {string} startSym The grammar's start symbol.
 */
StateTable.prototype.generate = function (startSym) {
	var ruleSets = []

	var startRule = { RHS: [ startSym ], rhsIdx: 0 }
	addState(ruleSets, [ startRule ])

	for (var s = 0; s < ruleSets.length; ++s) {
		var rules = ruleSets[s].slice()
		var shifts = []
		var newState = { reds: [], shifts: [] }

		for (var r = 0; r < rules.length; ++r) {
			var rule = rules[r]

			if (!rule.RHS[rule.rhsIdx]) {
				if (!rule.LHS) newState.isFinal = true
			} else {
				var rhsSym = rule.RHS[rule.rhsIdx]
				var shift = getShift(shifts, rules, rhsSym)

				// Duplicate rule, saving `rule.rhsIdx`.
				// Add rule to list of rules that produce `rhsSym`.
				rule.rhsIdx++
				addRule(shift, rule)
				rule.rhsIdx--
			}
		}

		var rulesLen = rules.length
		for (var r = 0; r < rulesLen; ++r) {
			var rule = rules[r]

			if (!rule.RHS[rule.rhsIdx] && rule.LHS) {
				var red = {
					LHS: rule.LHS,
					// Only used for printing.
					RHS: rule.RHS,
					ruleProps: rule.ruleProps,
				}

				if (rule.RHS.length === 2) {
					red.isBinary = true
				}

				newState.reds.push(red)
			}
		}

		var shiftsLen = shifts.length
		for (var i = 0; i < shiftsLen; ++i) {
			var shift = shifts[i]

			// Map `symbol.index` to next state indexes.
			newState.shifts[shift.sym.index] = addState(ruleSets, shift.rules)
		}

		this.states.push(newState)
	}

	// Extend `state.shifts` to map `symbol.index` to the next state for `symbol`, if any (instead of the next state's index).
	for (var s = 0, statesLen = this.states.length; s < statesLen; ++s) {
		var shifts = this.states[s].shifts

		for (var i in shifts) {
			shifts[i] = this.states[shifts[i]]
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
 *   (a) ACCEPT - This indicates that state 1 is the accepting state of the LR(0) parser. The accepting state will always be state 1.
 *     1:
 *       accept
 *
 *   (b) SHIFTS and GOTOS - This example indicates a shift (or goto) on item "c" from state 3 to state 8. The difference between shifts and gotos in LR(k) parsing has no bearing here, so they are listed in a common format.
 *     3:
 *       c => 8
 *
 *   (c) REDUCTIONS - This indicates that in state 4, a reduction action may be applied whereby the last two items on the parsing stack (which will always be nodes of types X and Y) are to be combined into a new node of type X. A goto on the item X is then executed from the state located two levels back in the stack to a new state.
 *     4:
 *       [X -> X Y]
 *
 * @memberOf StateTable
 */
StateTable.prototype.print = function () {
	this.nonterminalSyms = Object.keys(this.nonterminalSymTab)

	this.states.forEach(function (state, s) {
		util.log(util.colors.yellow(s) + ':')

		if (state.isFinal) util.log('\taccept')

		state.reds.forEach(function (red) {
			var ruleStr = '\t[' + red.LHS.name + ' ->'

			if (red.RHS) {
				red.RHS.forEach(function (sym) {
					ruleStr += ' ' + sym.name
				})
			}

			ruleStr += ']'

			util.log(ruleStr, red.ruleProps)
		})

		var shifts = state.shifts
		for (var s = 0, shiftsLen = shifts.length; s < shiftsLen; ++s) {
			var shift = shifts[s]

			if (shift) {
				util.log('\t' + this.indexToSymbolName(s), '=>', this.states.indexOf(shift))
			}
		}
	}, this)
}

/**
 * Gets the name of the symbol identified by `index`.
 *
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