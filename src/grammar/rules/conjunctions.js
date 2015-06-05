// Basic boolean operations

var g = require('../grammar')

exports.intersectSemantic = g.newSemantic({ name: 'intersect', cost: 0, minParams: 1, maxParams: 100 })
exports.unionSemantic = g.newSemantic({ name: 'union', cost: 0.5, minParams: 1, maxParams: 100 })

// conjunction
exports.and = g.newSymbol('and')
exports.and.addWord({
	insertionCost: 2,
	accepted: [ 'and' ]
})

// disjunction
exports.union = g.newSymbol('union')
exports.union.addWord({
	accepted: [ 'or' ]
})

// Create rules for "and" + "or" to surround 'symbol'
// Assign gloss property if passed; e.g., [nom-users]: (people) I and/or {user} follow
exports.addForSymbol = function (symbol, glossProperty) {
	// Append '+' to original symbol name
	var symbolNamePlus = symbol.name.slice(1, -1) + '+'

	// (people who follow) [obj-users]
	var symbolPlus = g.newSymbol(symbolNamePlus)
	symbolPlus.addRule({ RHS: [ symbol ] })

	// (people who follow) [obj-users] and [obj-users+]
	var andRule = { RHS: [ symbol, [ exports.and, symbolPlus ] ] }
	for (var gloss in glossProperty) {
		andRule[gloss] = glossProperty[gloss]
	}
	symbolPlus.addRule(andRule)

	// (people who follow) [obj-users] or [obj-users+]
	var orRule = { RHS: [ symbol, [ exports.union, symbolPlus ] ], semantic: exports.unionSemantic }
	for (var gloss in glossProperty) {
		orRule[gloss] = glossProperty[gloss]
	}
	symbolPlus.addRule(orRule)

	return symbolPlus
}