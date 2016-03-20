var g = require('../grammar')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')



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

// (issues with over <int> comments) and under (<int> comments)
var andUnder = g.newBinaryRule({ rhs: [ conjunctions.and, preps.under ] })

// (issues with under <int> comments) and over (<int> comments)
var andOver = g.newBinaryRule({ rhs: [ conjunctions.and, preps.over ] })

/**
 * Creates rules for `itemsSymbol` to support number-based queries.
 *
 * @param {NSymbol} itemsSymbol The `NSymbol` for the noun being quantified.
 * @returns {NSymbol} Returns the new `NSymbol` that produces new rules for number-based queries.
 */
exports.create = function (itemsSymbol) {
	var itemsCount = g.newSymbol(itemsSymbol.name, 'count')

	// (issues with) <int> comments
	var numberItems = g.newBinaryRule({ rhs: [ number, itemsSymbol ] })
	// (issues with between) <int> /comments/ (and <int> comments)
	var numberItemsOpt = g.newSymbol(numberItems.name, 'opt').addRule({
		rhs: [ number, itemsSymbol ],
	}).addRule({
		rhs: [ number ],
	})


	// (issues with) <int> comments
	// count(n2)
	itemsCount.addRule({ rhs: [ numberItems ], semantic: countSemantic })

	// (issues with) under <int> comments
	// count-under(n)
	itemsCount.addRule({ rhs: [ preps.under, numberItems ], semantic: countUnderSemantic })

	// (issues with) over <int> comments
	// count-over(n)
	itemsCount.addRule({ rhs: [ preps.over, numberItems ], semantic: countOverSemantic })

	// (issues with) under <int> comments and over <int> comments
	// count-over(n1), count-under(n2) - exclusive
	// Each semantic must be on a seperate branch.
	itemsCount.addRule({ rhs: [
		g.newBinaryRule({ rhs: [ preps.under, numberItemsOpt ], semantic: countUnderSemantic }),
		g.newBinaryRule({ rhs: [ andOver, numberItems ], semantic: countOverSemantic }),
	] })

	// (issues with) over <int> comments and under <int> comments
	// count-over(n1), count-under(n2) - exclusive
	itemsCount.addRule({ rhs: [
		g.newBinaryRule({ rhs: [ preps.over, numberItemsOpt ], semantic: countOverSemantic }),
		g.newBinaryRule({ rhs: [ andUnder, numberItems ], semantic: countUnderSemantic }),
	] })

	// (issues with) <int> comments to <int> comments
	// count(n1, n2) - inclusive
	itemsCount.addRule({ rhs: [ [ numberItemsOpt, preps.end ], numberItems ], semantic: countSemantic })

	// (issues with) between <int> comments and <int> comments
	// count(n1, n2) - inclusive
	itemsCount.addRule({
		rhs: [ [ preps.between, numberItemsOpt ], [ conjunctions.and, numberItems ] ],
		semantic: countSemantic,
	})

	return itemsCount
}