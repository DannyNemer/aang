var util = require('../util/util')


/**
 * The `StateTable` constructor.
 *
 * @constructor
 * @param {Object} ruleSets The map of the grammar's nonterminal symbols to rules.
 * @param {string} startSymbol The name of the start symbol of `ruleSets`.
 */
function StateTable(ruleSets, startSymbol) {
	this.symbolTab = {}
	this.states = []

	for (var nontermSym in ruleSets) {
		var lhsSym = this.lookUp(nontermSym)
		var symBuf = [ lhsSym ]

		var rules = ruleSets[nontermSym]
		var rulesLen = rules.length
		for (var r = 0; r < rulesLen; ++r) {
			var rule = rules[r]

			if (rule.isTerminal) {
				insertRule(this.lookUp(rule.RHS[0], true, rule.isPlaceholder), symBuf, rule)
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

	this.generate(this.lookUp(startSymbol))
}

/**
 * Adds a grammar symbol to the `StateTable` if it is new, otherwise returns the existing rule.
 *
 * @param {string} symbolName The symbol name.
 * @param {Boolean} isTerminal Specifies if this is a terminal symbol.
 * @param {Boolean} isPlaceholder Specifies if the symbol is a placeholder.
 * @returns {Object} Returns the symbol.
 */
StateTable.prototype.lookUp = function (symbolName, isTerminal, isPlaceholder) {
	var symbol = this.symbolTab[symbolName]
	if (symbol && symbol.isTerminal === isTerminal) {
		return symbol
	}

	symbol = this.symbolTab[symbolName] = {
		// Not needed in production (only debugging)
		name: symbolName,
		index: Object.keys(this.symbolTab).length,
		rules: [],
	}

	if (isTerminal) {
		symbol.isTerminal = true
		symbol.size = symbolName.split(' ').length

		// Prevent terminal symbol match with placeholder symbols: <int>, entities category names (e.g., {user})
		if (isPlaceholder) {
			symbol.isPlaceholder = true
		}
	}

	return symbol
}

/**
 * Adds a grammar rule to the `StateTable` if it is new.
 *
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
				// assuming grammar rules are sorted by increasing cost
				// assuming grammar doesn't have duplicates
				// store as array - only for insertions
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
		// For terminal symbols, this is the LHS
		RHS: symBuf,
		ruleProps: createRuleProps(origRule),
	})
}

/**
 * Creates an object holding all of the `rule`'s properties needed for forest-search but not needed for parsing. This reduces the memory required for a `StateTable` instance once the input grammar (i.e., its rules) are removed from memory.
 *
 * @param {Objct} rule The original rule holding the properties.
 * @returns {Object} Returns the new object with all of the rule's properties.
 */
function createRuleProps(rule) {
	var ruleProps = {
		cost: rule.cost // All rules have a cost
	}

	if (rule.insertionIdx !== undefined) {
		ruleProps.insertionIdx = rule.insertionIdx
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

	if (rule.text !== undefined) {
		ruleProps.text = rule.text
	}

	if (rule.gramProps) {
		ruleProps.gramProps = rule.gramProps
	}

	return ruleProps
}

/**
 * Compares two rules.
 *
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
 * Adds `newRules` to `ruleSets`.
 *
 * @param {Object[][]} ruleSets The `StateTable`'s exiting sets of rules.
 * @param {Object[]} newRules The new set of rules to add to `ruleSets`.
 * @returns {number} Returns the index of `newRules` in `ruleSets`.
 */
function addState(ruleSets, newRules) {
	var ruleSetsLen = ruleSets.length
	var newRuleSetLen = newRules.length
	for (var r = 0; r < ruleSetsLen; ++r) {
		var existingRules = ruleSets[r]
		var existingRulesLen = existingRules.length

		if (existingRulesLen === newRuleSetLen) {
			for (var i = 0; i < existingRulesLen; ++i) {
				if (compRules(existingRules[i], newRules[i]) !== 0) break
			}

			if (i >= existingRulesLen) {
				return r
			}
		}
	}

	// Subtract 1 to get index of `newRules`.
	return ruleSets.push(newRules) - 1
}

/**
 * Adds a `rule` to `shift`.
 *
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

	// Rules from grammar
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

				// Duplicate rule, saving rhsIdx
				// Add rule to list of rules that produce `rhsSym`
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
					RHS: rule.RHS, // Only used for printing
					ruleProps: rule.ruleProps,
				}

				if (rule.RHS.length === 2) {
					red.isBinary = true
				}

				newState.reds.push(red)
			}
		}

		// Tests show it is >2x faster to get the state directly using its index rather than saving a pointer to the state.
		var shiftsLen = shifts.length
		for (var i = 0; i < shiftsLen; ++i) {
			var shift = shifts[i]

			newState.shifts[i] = {
				sym: shift.sym,
				stateIdx: addState(ruleSets, shift.rules),
			}
		}

		this.states.push(newState)
	}

	// Delete symbol properties only needed for StateTable instantiation.
	for (var symbolName in this.symbolTab) {
		var symbol = this.symbolTab[symbolName]

		// Delete `index` property which is no longer used.
		delete symbol.index

		if (!symbol.isTerminal) {
			// `Rules` are only needed for terminal symbols.
			// `name` is the only remaining property for nonterminal terminal symbols, which is used to print.
			delete symbol.rules

			// Delete nonterminal symbols from `symbolTab`, which is only needed for terminal symbol lookup.
			delete this.symbolTab[symbolName]
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
 */
StateTable.prototype.print = function () {
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

		state.shifts.forEach(function (shift) {
			util.log('\t' + shift.sym.name, '=>', shift.stateIdx)
		})
	})
}

// Export `StateTable`.
module.exports = StateTable