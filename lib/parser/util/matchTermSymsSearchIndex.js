var lunr = require('lunr')


/**
 * A temporary solution for partial-matches of input to terminal symbols using a search index.
 *
 * @param {Parser} Parser The `Parser` instance.
 * @example
 *
 * // Instantiate parser.
 * var parser = new Parser(myStateTable)
 *
 * // Replace Parser's `matchTerminalRules()` method.
 * require('./util/matchTermSymsSearchIndex.js')(parser)
 *
 * // Execute parse
 * parser.parse(query)
 */
module.exports = function (Parser) {
	// Initialize search index with terminal symbols
	Parser.index = new lunr.Index
	Parser.index.field('text')

	for (var symName in Parser.stateTable.symbolTab) {
		var sym = Parser.stateTable.symbolTab[symName]
		if (sym.isLiteral) {
			Parser.index.add({
				id: symName,
				text: symName
			})
		}
	}

	// Lunr could support "cont to" -> [ "contributors to", "contributed to" ]
	// But we are not currently permitting that
	// That should not matter because this is temporary solution

	// Replace Parser's `matchTerminalRules()` method.
	Parser.matchTerminalRules = function (query) {
		var tokens = query.split(' ')
		Parser.tokensLen = tokens.length

		// First, match input to terminal symbols
		// If it is a multi-word terminal symbol, check out far the match extends
		// This must be separate because resorting is required after checking for extending matches
		var multiTokenWords = []
		var matchTab = []
		for (var t = 0; t < Parser.tokensLen; ++t) {
			var nGram = tokens[t]

			if (!isNaN(nGram)) continue

			var matches = matchTab[t] = Parser.index.search(nGram)

			for (var m = 0, matchesLen = matches.length; m < matchesLen; ++m) {
				var match = matches[m]
				var matchRef = match.ref
				match.score = matchRef === nGram ? 0 : 1 - match.score

				// Loop through all terminal rules that produce terminal symbol
				var wordNodes = []
				match.size = 1
				var symSize = matchRef.split(' ').length

				if (symSize > 1 && t < Parser.tokensLen - 1) {
					var mults = multiTokenWords[t]
					if (mults && mults.indexOf(matchRef) !== -1) continue

					var nGramNew = null
					var bound = Math.min(Parser.tokensLen, t + symSize)

					for (var i = t + 2; i <= bound; ++i) {
						nGramNew = tokens.slice(t, i).join(' ')
						if (matchRef.indexOf(nGramNew) === -1) {
							nGramNew = tokens.slice(t, i - 1).join(' ')
							break
						} else {
							var idx = i - 1
							var arr = multiTokenWords[idx] || (multiTokenWords[idx] = [])
							arr.push(matchRef)
						}
					}

					match.size = i - 1 - t

					if (match.size > 1) { // otherwise match did not begin at first token and only matched one
						var matchesNew = Parser.index.search(nGramNew)
						for (var m2 = 0, matchesNewLen = matchesNew.length; m2 < matchesNewLen; ++m2) {
							var matchNew = matchesNew[m2]
							if (matchNew.ref === matchRef) {
								match.score = matchRef === nGramNew ? 0 : 1 - matchNew.score
								break
							}
						}
					}
				}
			}
		}


		var wordTab = []

		// Create semantic arguments for input matches to '<int>'
		// Prevent making duplicate semantic arguments to detect duplicity by Object reference (not semantic name)
		var newSemanticArgs = {}

		for (; Parser.position < Parser.tokensLen; ++Parser.position) {
			var nGram = tokens[Parser.position]
			Parser.nodeTab = Parser.nodeTabs[Parser.position] = []

			if (isNaN(nGram)) {
				// Score can change after checking for extent of multi-word terminal symbol matches
				// Must reorder because choose the first terminal symbol to match to a terminal rule
				var matches = matchTab[Parser.position].sort(function (a, b) {
					return a.score - b.score
				})
				// Multiple terminal symbols can match to the same terminal rule, so choose the first (best match)
				// Ex: 'repos' -> [ 'repos', 'repositories' ]
				var LHSSeen = []

				for (var m = 0, matchesLen = matches.length; m < matchesLen; ++m) {
					var match = matches[m]
					var wordSym = Parser.stateTable.symbolTab[match.ref]
					var wordNode = Parser.addSub(wordSym)

					// Loop through all terminal rules that produce terminal symbol
					var wordNodes = []
					var wordSize = match.size

					for (var rules = wordSym.rules, r = rules.length; r-- > 0;) {
						var rule = rules[r]
						var LHS = rule.RHS[0] // FIX: rename prop - rule.RHS[0] is LHS for terms

						if (LHSSeen.indexOf(LHS) !== -1) continue
						LHSSeen.push(LHS)

						// Make new ruleProps with match score
						var origRuleProps = rule.ruleProps
						var sub = {
							size: wordSize, // number of positions spanned in input
							node: wordNode,
							ruleProps: {
								cost: origRuleProps.cost + match.score,
								text: origRuleProps.text,
								semantic: origRuleProps.semantic
							}
						}

						// create node with LHS of terminal rule
						wordNodes.push(Parser.addSub(LHS, sub))
					}

					if (wordNodes.length) {
						var endIdx = Parser.position + wordSize - 1
						var words = wordTab[endIdx] || (wordTab[endIdx] = [])
						words.push({
							start: Parser.position,
							nodes: wordNodes
						})
					}
				}
			}

			// Handle numbers in input (same as other implementation)
			else {
				var wordSym = Parser.stateTable.symbolTab['<int>']
				// create node with terminal symbol
				var wordNode = Parser.addSub(wordSym)

				var semanticArg = newSemanticArgs[nGram] || (newSemanticArgs[nGram] = [ { semantic: { name: nGram } } ])

				// Loop through all terminal rules that produce terminal symbol
				var wordNodes = []
				var wordSize = wordSym.size
				for (var rules = wordSym.rules, r = rules.length; r-- > 0;) {
					var rule = rules[r]
					var sub = {
						size: wordSize, // size of literal
						node: wordNode,
						ruleProps: {
							cost: rule.ruleProps.cost,
							semantic: semanticArg,
							text: nGram
						}
					}

					// create node with LHS of terminal rule
					wordNodes.push(Parser.addSub(rule.RHS[0], sub)) // FIX: rename prop - rule.RHS[0] is LHS for terms
				}

				// will only be one terminal symbol match (<int>) and only of length 1
				wordTab[Parser.position] = [ {
					start: Parser.position,
					nodes: wordNodes
				} ]
			}
		}

		Parser.position = 0 // reset

		return wordTab
	}
}