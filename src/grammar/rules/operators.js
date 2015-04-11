// Basic boolean operations
// Could call conjunctions

var g = require('../grammar')

this.intersectSemantic = new g.Semantic({ name: 'intersect', cost: 0, minParams: 1, maxParams: 100 })
this.unionSemantic = new g.Semantic({ name: 'union', cost: 0.5, minParams: 1, maxParams: 100 })

// conjunction
this.and = g.addWord({
	symbol: new g.Symbol('and'),
	insertionCost: 2,
	accepted: [ 'and' ]
})

// disjunction
this.union = g.addWord({
	symbol: new g.Symbol('union'),
	accepted: [ 'or' ]
})

// Create rules for "and" + "or" to surround 'symbol'
exports.addConjunctions = function (symbol, glossProperty) {
	// Append '+' to original symbol name
	var symbolNamePlus = symbol.name.slice(1, -1) + '+'

	// (people who follow) [obj-users]
	var symbolPlus = new g.Symbol(symbolNamePlus)
	symbolPlus.addRule({ RHS: [ symbol ] })

	// (people who follow) [obj-users] and [obj-users+]
	var andSymbolPlus = new g.Symbol('and', symbolNamePlus)
	andSymbolPlus.addRule({ RHS: [ exports.and, symbolPlus ] })
	var andRule = { RHS: [ symbol, andSymbolPlus ] }
	// Assign gloss property if passed; e.g., [nom-users]: (people) I and {user} follow
	for (var gloss in glossProperty) {
		andRule[gloss] = glossProperty[gloss]
	}
	symbolPlus.addRule(andRule)

	// (people who follow) [obj-users] or [obj-users+]
	var orSymbolPlus = new g.Symbol('or', symbolNamePlus)
	orSymbolPlus.addRule({ RHS: [ exports.union, symbolPlus ] })
	var orRule = { RHS: [ symbol, orSymbolPlus ], semantic: exports.unionSemantic }
	// Assign gloss property if passed; e.g., [nom-users]: (people) I or {user} follow
	for (var gloss in glossProperty) {
		orRule[gloss] = glossProperty[gloss]
	}
	symbolPlus.addRule(orRule)

	return symbolPlus
}