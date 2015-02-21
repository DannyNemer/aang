var grammar = require('../../grammar.json')

Object.keys(grammar).forEach(function (nontermSym) {
	grammar[nontermSym].forEach(function (rule) {
		var re = null
		rule.RHS.forEach(function (termSym) {
			if (!/[\[{<]/.test(termSym)) {
				if (termSym.indexOf(' ') !== -1) {
					re = termSym.split(' ').map(function (group) {
						var barIdx = group.indexOf('|')

						if (barIdx === 0) { // optional
							group = '(' + group.substr(1) + ')?'
						} else if (barIdx !== -1) {
							group = '(' + group + ')'
						}

						return group
					}).join(' ?\\b') // could be simplified to not alway use ' ?\b', to speed up
				} else {
					re = termSym.indexOf('|') === -1 ? termSym : '(' + termSym + ')'
				}
			}
		})

		if (re) {
			rule.regExp = new RegExp('^' + re + '$','i')
		}
	})
})

module.exports = function matchTermSymbols(query) {
	var tokens = query.split(' '),
			tokensLen = tokens.length,
			matchedTermSymbols = {}

	for (var i = 0; i < tokensLen; i++) {
		var nGram = ''

		for (var j = i; j < tokensLen; j++) {
			nGram += (nGram ? ' ' : '') + tokens[j]

			Object.keys(grammar).forEach(function (nontermSym) {
				grammar[nontermSym].some(function (rule) {
					if (rule.hasOwnProperty('regExp')) {
						if (rule.regExp.test(nGram)) {
							var match = {
								start: i,
								end: j + 1,
								cost: rule.cost
							}

							if (matchedTermSymbols[nontermSym]) {
								matchedTermSymbols[nontermSym].push(match)
							} else {
								matchedTermSymbols[nontermSym] = [ match ]
							}

							return true
						}
					}
				})
			})
		}
	}

	for (var i = 0; i < tokensLen; i++) {
		var recognized = Object.keys(matchedTermSymbols).some(function (termSym) {
			return matchedTermSymbols[termSym].some(function (match) {
				return i >= match.start && i < match.end
			})
		})

		if (!recognized) {
			console.log('unrecognized terminal symbol: ' + tokens[i])
			return
		}
	}

	return matchedTermSymbols
}