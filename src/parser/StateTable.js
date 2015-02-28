module.exports = StateTable

function StateTable(inputGrammar) {
	this.symbolTab = {}
	this.shifts = []

	Object.keys(inputGrammar.nonTerminals).forEach(function (leftSymName) {
		var LHS = this.lookUp(leftSymName)
		inputGrammar.nonTerminals[leftSymName].forEach(function (rule) {
			var newRuleRHS = rule.RHS.map(function (rightSymName) {
				return this.lookUp(rightSymName)
			}, this)
			this.insertRule(LHS, newRuleRHS)
		}, this)
	}, this)

	Object.keys(inputGrammar.terminals).forEach(function (leftSymName) {
		var symBuf = [ this.lookUp(leftSymName) ]
		inputGrammar.terminals[leftSymName].forEach(function (rule) {
			this.insertRule(this.lookUp(rule.RHS[0], true), symBuf)
		}, this)
	}, this)

	this.generate(this.lookUp(inputGrammar.startSymbol))
}

StateTable.prototype.lookUp = function (name, isLiteral) {
	var sym = this.symbolTab[name]
	if (sym && sym.isLiteral === isLiteral && sym.name === name)
		return sym

	return this.symbolTab[name] = {
		name: name,
		isLiteral: isLiteral,
		index: Object.keys(this.symbolTab).length,
		rules: []
	}
}

StateTable.prototype.insertRule = function (sym, newRuleRHS) {
	var existingRules = sym.rules

	for (var i = 0; i < existingRules.length; i++) {
		var existingRuleRHS = existingRules[i]
		var diff

		for (var j = 0; newRuleRHS[j] && existingRuleRHS[j]; j++) {
			diff = newRuleRHS[j].index - existingRuleRHS[j].index
			if (diff) break
		}

		if (diff === 0 && !existingRuleRHS[j]) {
			if (!newRuleRHS[j]) return
			else break
		} else if (diff > 0) {
			break
		}
	}

	existingRules.splice(i, 0, newRuleRHS)
}

function compItems(A, B) {
	var diff = A.LHS ? (B.LHS ? A.LHS.index - B.LHS.index : 1) : (B.LHS ? -1 : 0)
	if (diff) return diff

	diff = (A.posIdx - A.RHSIdx) - (B.posIdx - B.RHSIdx)
	if (diff) return diff

	for (var AP = A.RHSIdx, BP = B.RHSIdx; A.RHS[AP] && B.RHS[BP]; AP++, BP++) {
		diff = A.RHS[AP].index - B.RHS[BP].index
		if (diff) break
	}

	return A.RHS[AP] ? (B.RHS[BP] ? diff : 1) : (B.RHS[BP] ? -1 : 0)
}

function addState(ruleSets, list) {
	for (var S = 0; S < ruleSets.length; S++) {
		var oldList = ruleSets[S]
		if (oldList.length !== list.length) continue

		for (var i = 0; i < oldList.length; ++i) {
			if (compItems(oldList[i], list[i]) !== 0) break
		}

		if (i >= oldList.length) {
			return S
		}
	}

	return ruleSets.push(list) - 1
}

function addItem(items, item) {
	for (var i = 0; i < items.list.length; i++) {
		var diff = compItems(items.list[i], item)
		if (diff === 0) return
		if (diff > 0) break
	}

	items.list.splice(i, 0, {
		LHS: item.LHS,
		RHS: item.RHS,
		RHSIdx: item.RHSIdx,
		pos: item.pos,
		posIdx: item.posIdx
	})
}

StateTable.prototype.generate = function (startSym) {
	var ruleSets = []

	var startRule = [ startSym ]
	addState(ruleSets, [ { RHS: startRule, RHSIdx: 0, pos: startRule, posIdx: 0 } ])

	for (var S = 0; S < ruleSets.length; S++) {
		var rules = ruleSets[S].slice()
		var XTab = []
		var newState = { reds: [] }

		for (var r = 0; r < rules.length; r++) {
			var item = rules[r]
			if (!item.pos[item.posIdx]) {
				if (!item.LHS) newState.isFinal = true
			} else {
				var sym = item.pos[item.posIdx]
				var items = null

				for (var x = XTab.length; x-- > 0;) {
					var xItems = XTab[x]
					if (xItems.sym === sym) {
						items = xItems
						break
					}
				}

				if (!items) {
					items = { sym: sym, list: [] }
					XTab.push(items)
					sym.rules.forEach(function (rule) {
						rules.push({ LHS: sym, RHS: rule, RHSIdx: 0, pos: rule, posIdx: 0 })
					})
				}

				item.posIdx++
				addItem(items, item)
				item.posIdx--
			}
		}

		rules.forEach(function (item) {
			if (!item.pos[item.posIdx] && item.LHS) {
				newState.reds.push({
					LHS: item.LHS,
					RHS: item.RHS
				})
			}
		})

		newState.shifts = XTab.map(function (shift) {
			return { sym: shift.sym, stateIdx: addState(ruleSets, shift.list) }
		})

		this.shifts.push(newState)
	}
}

StateTable.prototype.print = function () {
	this.shifts.forEach(function (state, S) {
		console.log(S + ':')

		if (state.isFinal) console.log('\taccept')

		state.reds.forEach(function (red) {
			var toPrint = '\t[' + red.LHS.name + ' ->'

			red.RHS.forEach(function (sym) {
				toPrint += ' ' + sym.name
			})

			console.log(toPrint + ']')
		})

		state.shifts.forEach(function (shift) {
			console.log('\t' + shift.sym.name + ' => ' +  shift.stateIdx)
		})
	})
}