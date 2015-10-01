var util = require('../util')


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
		var LHS = this.lookUp(nontermSym)
		var symBuf = [ LHS ]

		ruleSets[nontermSym].forEach(function (rule) {
			if (rule.isTerminal) {
				insertRule(this.lookUp(rule.RHS[0], true, rule.isPlaceholder), symBuf, rule)
			} else {
				var newRuleRHS = rule.RHS.map(function (rightSymName) {
					return this.lookUp(rightSymName)
				}, this)

				insertRule(LHS, newRuleRHS, rule)
			}
		}, this)
	}

	this.generate(this.lookUp(startSymbol))
}

// Could separate terminal/nonterminal symbol tabs for faster term symbol lookup
// Unclear about use of Index property - might need to wait until grammar is larger to properly test
StateTable.prototype.lookUp = function (symName, isTerminal, isPlaceholder) {
	var sym = this.symbolTab[symName]
	if (sym && sym.isTerminal === isTerminal) {
		return sym
	}

	sym = this.symbolTab[symName] = {
		name: symName, // Not needed in production (only debugging)
		index: Object.keys(this.symbolTab).length,
		rules: [],
	}

	if (isTerminal) {
		sym.isTerminal = true
		sym.size = symName.split(' ').length
		// Prevent terminal symbol match with placeholder symbols: <int>, entities category names (e.g., {user})
		if (isPlaceholder) sym.isPlaceholder = true
	}

	return sym
}

function insertRule(sym, symBuf, origRule) {
	var existingRules = sym.rules

	for (var r = 0, existingRulesLen = existingRules.length; r < existingRulesLen; ++r) {
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

// Create ruleProps obj manually to avoid memory consumption of undefined props
function createRuleProps(origRule) {
	var ruleProps = {
		cost: origRule.cost // All rules have a cost
	}

	if (origRule.text !== undefined) {
		ruleProps.text = origRule.text
	}

	if (origRule.insertionIdx !== undefined) {
		ruleProps.insertionIdx = origRule.insertionIdx
	}

	if (origRule.semantic !== undefined) {
		ruleProps.semantic = origRule.semantic
	}

	if (origRule.insertedSemantic !== undefined) {
		ruleProps.insertedSemantic = origRule.insertedSemantic
	}

	if (origRule.verbForm !== undefined) {
		ruleProps.gramProps = {
			verbForm: origRule.verbForm,
		}
	}

	if (origRule.personNumber !== undefined) {
		if (ruleProps.gramProps) {
			ruleProps.gramProps.personNumber = origRule.personNumber
		} else {
			ruleProps.gramProps = {
				personNumber: origRule.personNumber,
			}
		}
	}

	if (origRule.gramCase !== undefined) {
		if (ruleProps.gramProps) {
			ruleProps.gramProps.gramCase = origRule.gramCase
		} else {
			ruleProps.gramProps = {
				gramCase: origRule.gramCase,
			}
		}
	}

	if (origRule.isTransposition) {
		ruleProps.isTransposition = true
	}

	if (origRule.semanticIsRHS) {
		ruleProps.semanticIsRHS = true
	}

	return ruleProps
}

function compItems(a, b) {
	var diff = a.LHS ? (b.LHS ? a.LHS.index - b.LHS.index : 1) : (b.LHS ? -1 : 0)
	if (diff) return diff

	diff = a.RHSIdx - b.RHSIdx
	if (diff) return diff

	for (var i = 0; a.RHS[i] && b.RHS[i]; ++i) {
		diff = a.RHS[i].index - b.RHS[i].index
		if (diff) break
	}

	return a.RHS[i] ? (b.RHS[i] ? diff : 1) : (b.RHS[i] ? -1 : 0)
}

function addState(ruleSets, newRuleSet) {
	var newRuleSetLen = newRuleSet.length

	for (var r = 0, ruleSetsLen = ruleSets.length; r < ruleSetsLen; ++r) {
		var existingRuleSet = ruleSets[r]
		var existingRuleSetLen = existingRuleSet.length

		if (existingRuleSetLen !== newRuleSetLen) continue

		for (var i = 0; i < existingRuleSetLen; ++i) {
			if (compItems(existingRuleSet[i], newRuleSet[i]) !== 0) break
		}

		if (i >= existingRuleSetLen) {
			return r
		}
	}

	// Subtract 1 to get index of newRuleSet
	return ruleSets.push(newRuleSet) - 1
}

function addRule(items, rule) {
	var existingRules = items.list

	for (var r = 0, existingRulesLen = existingRules.length; r < existingRulesLen; ++r) {
		var diff = compItems(existingRules[r], rule)

		if (diff === 0) return
		if (diff > 0) break
	}

	existingRules.splice(r, 0, {
		LHS: rule.LHS,
		RHS: rule.RHS,
		RHSIdx: rule.RHSIdx,
		ruleProps: rule.ruleProps,
	})
}

function getItems(XTab, ruleSet, RHSSym) {
	for (var x = 0, XTabLen = XTab.length; x < XTabLen; ++x) {
		var xItems = XTab[x]
		if (xItems.sym === RHSSym) {
			return xItems
		}
	}

	// Existing not found
	var items = { sym: RHSSym, list: [] }
	XTab.push(items)

	// Rules from grammar
	RHSSym.rules.forEach(function (rule) {
		ruleSet.push({
			LHS: RHSSym,
			RHS: rule.RHS,
			RHSIdx: 0,
			ruleProps: rule.ruleProps,
		})
	})

	return items
}

StateTable.prototype.generate = function (startSym) {
	var ruleSets = []

	var startRule = { RHS: [ startSym ], RHSIdx: 0 }
	addState(ruleSets, [ startRule ])

	for (var s = 0; s < ruleSets.length; ++s) {
		var ruleSet = ruleSets[s].slice()
		var XTab = []
		var newState = { reds: [] }

		for (var r = 0; r < ruleSet.length; ++r) {
			var rule = ruleSet[r]

			if (!rule.RHS[rule.RHSIdx]) {
				if (!rule.LHS) newState.isFinal = true
			} else {
				var RHSSym = rule.RHS[rule.RHSIdx]
				var items = getItems(XTab, ruleSet, RHSSym)

				// Duplicate rule, saving RHSIdx
				// Add rule to list of rules that produce RHSSym
				rule.RHSIdx++
				addRule(items, rule)
				rule.RHSIdx--
			}
		}

		ruleSet.forEach(function (rule) {
			if (!rule.RHS[rule.RHSIdx] && rule.LHS) {
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
		})

		newState.shifts = XTab.map(function (shift) {
			// Tests show it is >2x faster to get the state directly using its index rather than saving a pointer to the state.
			return { sym: shift.sym, stateIdx: addState(ruleSets, shift.list) }
		})

		this.states.push(newState)
	}

	// Delete symbol properties only needed for StateTable instantiation.
	for (var symName in this.symbolTab) {
		var symbol = this.symbolTab[symName]

		// Delete `index` property which is no longer used.
		delete symbol.index

		if (!symbol.isTerminal) {
			// `Rules` are only needed for terminal symbols.
			// `name` is the only remaining property for nonterminal terminal symbols, which is used to print.
			delete symbol.rules

			// Delete nonterminal symbols from `symbolTab`, which is only needed for terminal symbol lookup.
			delete this.symbolTab[symName]
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
	this.states.forEach(function (state, S) {
		util.log(util.colors.yellow(S) + ':')

		if (state.isFinal) console.log('\taccept')

		state.reds.forEach(function (red) {
			var toPrint = '\t[' + red.LHS.name + ' ->'

			if (red.RHS) {
				red.RHS.forEach(function (sym) {
					toPrint += ' ' + sym.name
				})
			}

			toPrint += ']'

			util.log(toPrint, red.ruleProps)
		})

		state.shifts.forEach(function (shift) {
			util.log('\t' + shift.sym.name, '=>', shift.stateIdx)
		})
	})
}

// Export `StateTable`.
module.exports = StateTable