var g = require('../grammar')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')


var number = new g.Symbol('number')
number.addInt({ min: 0 })

// (issues with under <int> comments) and over (<int> comments)
var andPrepOver = new g.Symbol('and', 'prep', 'over')
andPrepOver.addRule({ RHS: [ conjunctions.and, preps.over ] })

// (issues with over <int> comments) and under (<int> comments)
var andPrepUnder = new g.Symbol('and', 'prep', 'under')
andPrepUnder.addRule({ RHS: [ conjunctions.and, preps.under ] })


exports.addForCategoryItems = function (category, itemsSymbol) {
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

	// (issues) with <int> comments
	var itemsCount = new g.Symbol(itemsName, 'count')
	category.inner.addRule({ RHS: [ preps.possessed, itemsCount ] })


	// (issues with) <int> comments
	var numberItems = new g.Symbol('number', itemsName)
	numberItems.addRule({ RHS: [ number, itemsSymbol ] })
	// (issues with between) <int> /comments/ (and <int> comments)
	var numberItemsOpt = new g.Symbol('number', itemsName, 'opt')
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
	var prepUnderNumberItemsOpt = new g.Symbol('prep', 'under', 'number', itemsName, 'opt')
	prepUnderNumberItemsOpt.addRule({ RHS: [ preps.under, numberItemsOpt ], semantic: catPlItemsUnderSemantic })
	var andPrepOverNumberItems = new g.Symbol('and', 'prep', 'over', 'number', itemsName)
	andPrepOverNumberItems.addRule({ RHS: [ andPrepOver, numberItems ], semantic: catPlItemsOverSemantic })
	itemsCount.addRule({ RHS: [ prepUnderNumberItemsOpt, andPrepOverNumberItems ] })

	// (issues with) over <int> comments and under <int> comments
	// issues-comments-over(n1), issues-comments-under(n2) - exclusive
	var prepOverNumberItemsOpt = new g.Symbol('prep', 'over', 'number', itemsName, 'opt')
	prepOverNumberItemsOpt.addRule({ RHS: [ preps.over, numberItemsOpt ], semantic: catPlItemsOverSemantic })
	var andPrepUnderNumberItems = new g.Symbol('and', 'prep', 'under', 'number', itemsName)
	andPrepUnderNumberItems.addRule({ RHS: [ andPrepUnder, numberItems ], semantic: catPlItemsUnderSemantic })
	itemsCount.addRule({ RHS: [ prepOverNumberItemsOpt, andPrepUnderNumberItems ] })

	// (issues with) <int> comments to <int> comments
	// issues-comments(n1, n2) - inclusive
	var numberItemsOptPrepEnd = new g.Symbol('number', itemsName, 'opt', 'prep', 'end')
	numberItemsOptPrepEnd.addRule({ RHS: [ numberItemsOpt, preps.end ] })
	itemsCount.addRule({ RHS: [ numberItemsOptPrepEnd, numberItems ], semantic: catPlItemsSemantic })

	// (issues with) between <int> comments and <int> comments
	// issues-comments(n1, n2) - inclusive
	var prepBetweenNumberItemsOpt = new g.Symbol('prep', 'between', 'number', itemsName, 'opt')
	prepBetweenNumberItemsOpt.addRule({ RHS: [ preps.between, numberItemsOpt ] })
	var andNumberItems = new g.Symbol('and', 'number', itemsName)
	andNumberItems.addRule({ RHS: [ conjunctions.and, numberItems ] })
	itemsCount.addRule({ RHS: [ prepBetweenNumberItemsOpt, andNumberItems ], semantic: catPlItemsSemantic })
}