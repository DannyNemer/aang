var g = require('../grammar')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')


var number = g.newSymbol('number').addRule({
	isTerminal: true,
	rhs: g.newIntSymbol({ min: 0 }),
	isPlaceholder: true,
})

// (issues with under <int> comments) and over (<int> comments)
var andPrepOver = g.newBinaryRule({ rhs: [ conjunctions.and, preps.over ] })

// (issues with over <int> comments) and under (<int> comments)
var andPrepUnder = g.newBinaryRule({ rhs: [ conjunctions.and, preps.under ] })

/**
 * Creates rules for `itemsSymbol` to support number-based queries.
 *
 * @param {NSymbol} itemsSymbol The `NSymbol` for the noun being quantified.
 * @returns {NSymbol} Returns the new `NSymbol` that produces new rules for number-based queries.
 */
exports.createForItems = function (itemsSymbol) {
	var itemsCountSemantic = g.newSemantic({
		name: g.hyphenate(itemsSymbol.name, 'count'),
		cost: 0.5,
		minParams: 1,
		maxParams: 2,
	})

	var itemsCountOverSemantic = g.newSemantic({
		name: g.hyphenate(itemsSymbol.name, 'count', 'over'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	})

	var itemsCountUnderSemantic = g.newSemantic({
		name: g.hyphenate(itemsSymbol.name, 'count', 'under'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1,
	})


	var itemsCount = g.newSymbol(itemsSymbol.name, 'count')

	// (issues with) <int> comments
	var numberItems = g.newBinaryRule({ rhs: [ number, itemsSymbol ] })
	// (issues with between) <int> /comments/ (and <int> comments)
	var numberItemsOpt = g.newBinaryRule({ rhs: [ number, itemsSymbol.createNonterminalOpt() ] })


	// (issues with) <int> comments
	// comments-count(n2)
	itemsCount.addRule({ rhs: [ numberItems ], semantic: itemsCountSemantic })

	// (issues with) under <int> comments
	// comments-count-under(n)
	itemsCount.addRule({ rhs: [ preps.under, numberItems ], semantic: itemsCountUnderSemantic })

	// (issues with) over <int> comments
	// comments-count-over(n)
	itemsCount.addRule({ rhs: [ preps.over, numberItems ], semantic: itemsCountOverSemantic })

	// (issues with) under <int> comments and over <int> comments
	// comments-count-over(n1), comments-count-under(n2) - exclusive
	// Each semantic must be on a seperate branch
	itemsCount.addRule({ rhs: [
		g.newBinaryRule({ rhs: [ preps.under, numberItemsOpt ], semantic: itemsCountUnderSemantic }),
		g.newBinaryRule({ rhs: [ andPrepOver, numberItems ], semantic: itemsCountOverSemantic })
	] })

	// (issues with) over <int> comments and under <int> comments
	// comments-count-over(n1), comments-count-under(n2) - exclusive
	itemsCount.addRule({ rhs: [
		g.newBinaryRule({ rhs: [ preps.over, numberItemsOpt ], semantic: itemsCountOverSemantic }),
		g.newBinaryRule({ rhs: [ andPrepUnder, numberItems ], semantic: itemsCountUnderSemantic })
	] })

	// (issues with) <int> comments to <int> comments
	// comments-count(n1, n2) - inclusive
	itemsCount.addRule({ rhs: [ [ numberItemsOpt, preps.end ], numberItems ], semantic: itemsCountSemantic })

	// (issues with) between <int> comments and <int> comments
	// comments-count(n1, n2) - inclusive
	itemsCount.addRule({
		rhs: [ [ preps.between, numberItemsOpt ], [ conjunctions.and, numberItems ] ],
		semantic: itemsCountSemantic,
	})

	return itemsCount
}