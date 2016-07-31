var g = require('../grammar')
var preps = require('./prepositions')
var conjunction = require('./conjunction')


/**
 * The map of `NSymbol` names for noun sets to the associated `NSymbol` instance for the count set for that noun, if any already exists. This enables `Category.prototype.addCountRuleSet()` to be invoked for multiple `Category` instances with the same noun set.
 *
 * @type {Object.<string, NSymbol>}
 */
var _countNSymbols = {}

var countSemantic = g.newSemantic({
	name: g.hyphenate('count'),
	cost: 0.5,
	minParams: 1,
	maxParams: 2,
})

var countOverSemantic = g.newSemantic({
	name: g.hyphenate('count', 'over'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})

var countUnderSemantic = g.newSemantic({
	name: g.hyphenate('count', 'under'),
	cost: 0.5,
	minParams: 1,
	maxParams: 1,
})

var number = g.newSymbol('number').addRule({
	isTerminal: true,
	rhs: g.newIntSymbol({ min: 0 }),
	isPlaceholder: true,
})

// (issues with over `<int>` comments) and under (<int> comments)
var andUnder = g.newTermSequenceBinarySymbol({
	termPair: [ conjunction.and, preps.under ],
	type: g.termTypes.INVARIABLE,
})
// (issues with under `<int>` comments) and over (<int> comments)
var andOver = g.newTermSequenceBinarySymbol({
	termPair: [ conjunction.and, preps.over ],
	type: g.termTypes.INVARIABLE,
})

/**
 * Creates an `NSymbol` that produces a nonterminal rule set for number-based expressions.
 *
 * For use by `Category.prototype.addCountRuleSet()`.
 *
 * If this method was already invoked with `itemsSymbol`, returns the previously constructed `NSymbol` (instead of throwing an exception for duplicity).
 *
 * @memberOf count
 * @param {NSymbol} itemsSymbol The `NSymbol` for the noun being quantified.
 * @returns {NSymbol} Returns the `NSymbol` that produces rules for number-based expressions.
 */
exports.create = function (itemsSymbol) {
	var itemsSymbolName = itemsSymbol.name
	// Check if a count set for `itemsSymbol` already exists.
	var existingItemsCount = _countNSymbols[itemsSymbolName]
	if (existingItemsCount) {
		return existingItemsCount
	}

	var itemsCount = g.newSymbol(itemsSymbolName, 'count')
	// Save `itemsCount` to enable `Category.prototype.addCountRuleSet()` to be invoked for multiple `Category` instances with the same noun set.
	_countNSymbols[itemsSymbolName] = itemsCount

	// (issues with) `<int>` comments
	var numberItems = g.newBinaryRule({ rhs: [ number, itemsSymbol ] })
	// (issues with between) `<int>` /comments/ (and `<int>` comments)
	var numberItemsOpt = g.newSymbol(numberItems.name, 'opt').addRule({
		rhs: [ number, itemsSymbol ],
	}).addRule({
		rhs: [ number ],
	})


	// (issues with) `<int>` comments
	// `count(n)`
	itemsCount.addRule({ rhs: [ numberItems ], semantic: countSemantic })

	// (issues with) under `<int>` comments
	// `count-under(n)` - exclusive
	itemsCount.addRule({ rhs: [ preps.under, numberItems ], semantic: countUnderSemantic })
	// (issues with) over `<int>` comments
	// `count-over(n)` - exclusive
	itemsCount.addRule({ rhs: [ preps.over, numberItems ], semantic: countOverSemantic })

	// (issues with) under `<int>` comments and over `<int>` comments
	// `count-over(n1),count-under(n2)` - exclusive
	// Each semantic must be on a seperate branch.
	itemsCount.addRule({ rhs: [
		g.newBinaryRule({ rhs: [ preps.under, numberItemsOpt ], semantic: countUnderSemantic }),
		g.newBinaryRule({ rhs: [ andOver, numberItems ], semantic: countOverSemantic }),
	] })
	// (issues with) over `<int>` comments and under `<int>` comments
	// `count-over(n1),count-under(n2)` - exclusive
	itemsCount.addRule({ rhs: [
		g.newBinaryRule({ rhs: [ preps.over, numberItemsOpt ], semantic: countOverSemantic }),
		g.newBinaryRule({ rhs: [ andUnder, numberItems ], semantic: countUnderSemantic }),
	] })

	// (issues with) `<int>` comments to `<int>` comments
	// `count(n1, n2)` - inclusive
	itemsCount.addRule({
		rhs: [ [ numberItemsOpt, preps.end ], numberItems ],
		semantic: countSemantic,
	})
	// (issues with) between `<int>` comments and `<int>` comments
	// `count(n1, n2)` - inclusive
	itemsCount.addRule({
		rhs: [ [ preps.between, numberItemsOpt ], [ conjunction.and, numberItems ] ],
		semantic: countSemantic,
	})

	return itemsCount
}