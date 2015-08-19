module.exports = StateTable

function StateTable(inputGrammar, startSymbolStr) {
	this.symbolTab = {}
	this.shifts = []

	for (var nontermSym in inputGrammar) {
		var LHS = this.lookUp(nontermSym)
		var symBuf = [ LHS ]

		inputGrammar[nontermSym].forEach(function (rule) {
			if (rule.terminal) {
				insertRule(this.lookUp(rule.RHS[0], true, rule.RHSIsPlaceholder), symBuf, rule)
			} else {
				var newRuleRHS = rule.RHS.map(function (rightSymName) {
					return this.lookUp(rightSymName)
				}, this)

				insertRule(LHS, newRuleRHS, rule)
			}
		}, this)
	}

	this.generate(this.lookUp(startSymbolStr))
}

// Could seperate term/nonterm symbol tabs for faster term symbol lookup
// Unclear about use of Index property - might need to wait until grammar is larger to properly test
StateTable.prototype.lookUp = function (name, isLiteral, symIsPlaceholder) {
	var sym = this.symbolTab[name]
	if (sym && sym.isLiteral === isLiteral)
		return sym

	sym = this.symbolTab[name] = {
		name: name, // Not needed in production (only debugging)
		index: Object.keys(this.symbolTab).length,
		rules: [],
	}

	if (isLiteral) {
		sym.isLiteral = true
		sym.size = name.split(' ').length
		// Prevent terminal symbol match with placeholder symbols: <int>, entities category names (e.g., {user})
		if (symIsPlaceholder) sym.isPlaceholder = true
	}

	return sym
}

function insertRule(sym, symBuf, origRule) {
	var existingRules = sym.rules

	for (var i = 0; i < existingRules.length; i++) {
		var existingRule = existingRules[i]
		var existingRuleRHS = existingRule.RHS
		var diff

		for (var j = 0; symBuf[j] && existingRuleRHS[j]; j++) {
			diff = symBuf[j].index - existingRuleRHS[j].index
			if (diff) break
		}

		if (diff === 0 && !existingRuleRHS[j]) {
			if (!symBuf[j]) {
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

	existingRules.splice(i, 0, {
		RHS: symBuf, // for term syms, this is the LHS (that produces the term syms)
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

	if (origRule.intMin !== undefined) {
		ruleProps.intMin = origRule.intMin
	}

	if (origRule.intMax !== undefined) {
		ruleProps.intMax = origRule.intMax
	}

	if (origRule.transposition) {
		ruleProps.transposition = true
	}

	if (origRule.semanticIsRHS) {
		ruleProps.semanticIsRHS = true
	}

	return ruleProps
}

function compItems(A, B) {
	var diff = A.LHS ? (B.LHS ? A.LHS.index - B.LHS.index : 1) : (B.LHS ? -1 : 0)
	if (diff) return diff

	diff = A.RHSIdx - B.RHSIdx
	if (diff) return diff

	for (var i = 0; A.RHS[i] && B.RHS[i]; ++i) {
		diff = A.RHS[i].index - B.RHS[i].index
		if (diff) break
	}

	return A.RHS[i] ? (B.RHS[i] ? diff : 1) : (B.RHS[i] ? -1 : 0)
}

function addState(ruleSets, newRuleSet) {
	for (var S = 0; S < ruleSets.length; S++) {
		var existingRuleSet = ruleSets[S]
		if (existingRuleSet.length !== newRuleSet.length) continue

		for (var i = 0; i < existingRuleSet.length; ++i) {
			if (compItems(existingRuleSet[i], newRuleSet[i]) !== 0) break
		}

		if (i >= existingRuleSet.length) {
			return S
		}
	}

	// Subtract 1 to get index of newRuleSet
	return ruleSets.push(newRuleSet) - 1
}

function addRule(items, rule) {
	var existingRules = items.list

	for (var i = 0; i < existingRules.length; i++) {
		var diff = compItems(existingRules[i], rule)

		if (diff === 0) return
		if (diff > 0) break
	}

	existingRules.splice(i, 0, {
		LHS: rule.LHS,
		RHS: rule.RHS,
		RHSIdx: rule.RHSIdx,
		ruleProps: rule.ruleProps,
	})
}

function getItems(XTab, ruleSet, RHSSym) {
	for (var x = XTab.length; x-- > 0;) {
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

	for (var S = 0; S < ruleSets.length; S++) {
		var ruleSet = ruleSets[S].slice()
		var XTab = []
		var newState = { reds: [] }

		for (var r = 0; r < ruleSet.length; r++) {
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
				newState.reds.push({
					LHS: rule.LHS,
					// RHS: rule.RHS, // Only useful for printing
					binary: rule.RHS.length === 2,
					ruleProps: rule.ruleProps,
				})
			}
		})

		newState.shifts = XTab.map(function (shift) {
			return { sym: shift.sym, stateIdx: addState(ruleSets, shift.list) }
		})

		this.shifts.push(newState)
	}

	// Remove `index` property from because no longer needed
	for (var symName in this.symbolTab) {
		delete this.symbolTab[symName].index
	}
}

StateTable.prototype.print = function () {
	this.shifts.forEach(function (state, S) {
		console.log(S + ':')

		if (state.isFinal) console.log('\taccept')

		state.reds.forEach(function (red) {
			var toPrint = '\t[' + red.LHS.name + ' ->'

			if (red.RHS) {
				red.RHS.forEach(function (sym) {
					toPrint += ' ' + sym.name
				})
			}

			toPrint += ']'

			console.log(toPrint, red.ruleProps)
		})

		state.shifts.forEach(function (shift) {
			console.log('\t' + shift.sym.name + ' => ' +  shift.stateIdx)
		})
	})
}