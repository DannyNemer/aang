var g = require('../grammar')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')


var number = g.newSymbol('number')
number.addInt({ min: 0 })

// (issues with under <int> comments) and over (<int> comments)
var andPrepOver = g.newSymbol('and', 'prep', 'over')
andPrepOver.addRule({ RHS: [ conjunctions.and, preps.over ] })

// (issues with over <int> comments) and under (<int> comments)
var andPrepUnder = g.newSymbol('and', 'prep', 'under')
andPrepUnder.addRule({ RHS: [ conjunctions.and, preps.under ] })


exports.createForCategoryItems = function (category, itemsSymbol) {
	var itemsName = itemsSymbol.name.slice(1, -1)

	var catPlItemsSemantic = g.newSemantic({
		name: g.hyphenate(category.namePl, itemsName),
		cost: 0.5,
		minParams: 1,
		maxParams: 2
	})

	var catPlItemsOverSemantic = g.newSemantic({
		name: g.hyphenate(category.namePl, itemsName, 'over'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1
	})

	var catPlItemsUnderSemantic = g.newSemantic({
		name: g.hyphenate(category.namePl, itemsName, 'under'),
		cost: 0.5,
		minParams: 1,
		maxParams: 1
	})


	var itemsCount = g.newSymbol(itemsName, 'count')

	// (issues with) <int> comments
	var numberItems = g.newSymbol('number', itemsName)
	numberItems.addRule({ RHS: [ number, itemsSymbol ] })
	// (issues with between) <int> /comments/ (and <int> comments)
	var numberItemsOpt = g.newSymbol('number', itemsName, 'opt')
	numberItemsOpt.addRule({ RHS: [ number, itemsSymbol.createNonterminalOpt() ] })


	// (issues with) <int> comments
	// issues-comments(n2)
	itemsCount.addRule({ RHS: [ numberItems ], semantic: catPlItemsSemantic })

	// (issues with) under <int> comments
	// issues-comments-under(n)
	itemsCount.addRule({ RHS: [ preps.under, numberItems ], semantic: catPlItemsUnderSemantic })

	// (issues with) over <int> comments
	// issues-comments-over(n)
	itemsCount.addRule({ RHS: [ preps.over, numberItems ], semantic: catPlItemsOverSemantic })

	// (issues with) under <int> comments and over <int> comments
	// issues-comments-over(n1), issues-comments-under(n2) - exclusive
	// Each semantic must be on a seperate branch
	var prepUnderNumberItemsOpt = g.newSymbol('prep', 'under', 'number', itemsName, 'opt')
	prepUnderNumberItemsOpt.addRule({ RHS: [ preps.under, numberItemsOpt ], semantic: catPlItemsUnderSemantic })
	var andPrepOverNumberItems = g.newSymbol('and', 'prep', 'over', 'number', itemsName)
	andPrepOverNumberItems.addRule({ RHS: [ andPrepOver, numberItems ], semantic: catPlItemsOverSemantic })
	itemsCount.addRule({ RHS: [ prepUnderNumberItemsOpt, andPrepOverNumberItems ] })

	// (issues with) over <int> comments and under <int> comments
	// issues-comments-over(n1), issues-comments-under(n2) - exclusive
	var prepOverNumberItemsOpt = g.newSymbol('prep', 'over', 'number', itemsName, 'opt')
	prepOverNumberItemsOpt.addRule({ RHS: [ preps.over, numberItemsOpt ], semantic: catPlItemsOverSemantic })
	var andPrepUnderNumberItems = g.newSymbol('and', 'prep', 'under', 'number', itemsName)
	andPrepUnderNumberItems.addRule({ RHS: [ andPrepUnder, numberItems ], semantic: catPlItemsUnderSemantic })
	itemsCount.addRule({ RHS: [ prepOverNumberItemsOpt, andPrepUnderNumberItems ] })

	// (issues with) <int> comments to <int> comments
	// issues-comments(n1, n2) - inclusive
	var numberItemsOptPrepEnd = g.newSymbol('number', itemsName, 'opt', 'prep', 'end')
	numberItemsOptPrepEnd.addRule({ RHS: [ numberItemsOpt, preps.end ] })
	itemsCount.addRule({ RHS: [ numberItemsOptPrepEnd, numberItems ], semantic: catPlItemsSemantic })

	// (issues with) between <int> comments and <int> comments
	// issues-comments(n1, n2) - inclusive
	var prepBetweenNumberItemsOpt = g.newSymbol('prep', 'between', 'number', itemsName, 'opt')
	prepBetweenNumberItemsOpt.addRule({ RHS: [ preps.between, numberItemsOpt ] })
	var andNumberItems = g.newSymbol('and', 'number', itemsName)
	andNumberItems.addRule({ RHS: [ conjunctions.and, numberItems ] })
	itemsCount.addRule({ RHS: [ prepBetweenNumberItemsOpt, andNumberItems ], semantic: catPlItemsSemantic })

	return itemsCount
}