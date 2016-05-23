var g = require('../grammar')
var conjunction = require('./conjunction')
var preps = require('./prepositions')
var terms = require('./terms')


// DATE-PHRASE:
var datePhrase = g.newSymbol('date', 'phrase')

// (repos created) today
datePhrase.addRule({
	isTerminal: true,
	rhs: 'today',
	text: 'today',
	insertionCost: 1,
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('today'), cost: 0.5 })
})
// (repos created) yesterday
datePhrase.addRule({
	isTerminal: true,
	rhs: 'yesterday',
	text: 'yesterday',
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('yesterday'), cost: 0.5 })
})

// (repos created) this week
datePhrase.addRule({
	rhs: [ terms.thisDate, terms.week ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('this', 'week'), cost: 0.5 })
})
// (repos created) last week
datePhrase.addRule({
	rhs: [ terms.lastDate, terms.week ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('last', 'week'), cost: 0.5 })
})

// (repos created) this month
datePhrase.addRule({
	rhs: [ terms.thisDate, terms.month ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('this', 'month'), cost: 0.5 })
})
// (repos created) last month
datePhrase.addRule({
	rhs: [ terms.lastDate, terms.month ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('last', 'month'), cost: 0.5 })
})

var yearPhrase = g.newSymbol('year', 'phrase')
// (repos created) this year
yearPhrase.addRule({
	rhs: [ terms.thisDate, terms.year ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('this', 'year'), cost: 0.5 })
})
// (repos created) last year
yearPhrase.addRule({
	rhs: [ terms.lastDate, terms.year ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('last', 'year'), cost: 0.5 })
})
datePhrase.addRule({ rhs: [ yearPhrase ], noInsert: true })


// DATE-VALUE:
// (repos created in) `[year]`
// Can not add [year-phrase] to [year] because creates ambiguity when both [year] and [date-phrase] used in [date-value]
var year = g.newSymbol('year').addRule({
	isTerminal: true,
	rhs: g.newIntSymbol({ min: 1950, max: 2050 }),
	isPlaceholder: true,
})

var month = g.newSymbol('month').addRule({
	rhs: [ g.newSymbol('january').addWord({ accepted: [ 'January', '01' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'jan', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('february').addWord({ accepted: [ 'February', '02' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'feb', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('march').addWord({ accepted: [ 'March', '03' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'mar', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('april').addWord({ accepted: [ 'April', '04' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'apr', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('may').addWord({ accepted: [ 'May', '05' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'may', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('june').addWord({ accepted: [ 'June', '06' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'jun', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('july').addWord({ accepted: [ 'July', '07' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'jul', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('august').addWord({ accepted: [ 'August', '08' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'aug', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('september').addWord({ accepted: [ 'September', '09' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'sep', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('october').addWord({ accepted: [ 'October', '10' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'oct', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('november').addWord({ accepted: [ 'November', '11' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'nov', cost: 0.5 })
}).addRule({
	rhs: [ g.newSymbol('december').addWord({ accepted: [ 'December', '12' ] }) ],
	semantic: g.newSemantic({ isArg: true, name: 'dec', cost: 0.5 })
})

// (repos created in) [month] [year]/[year-phrase]
var monthYear = g.newSymbol('month', 'year')
monthYear.addRule({ rhs: [ month, year ], noInsert: true, transpositionCost: 0.1 })
monthYear.addRule({ rhs: [ month, yearPhrase ] })

var day = g.newSymbol('day').addRule({
	isTerminal: true,
	rhs: g.newIntSymbol({ min: 1, max: 31 }),
	isPlaceholder: true,
})

var monthDay = g.newBinaryRule({ rhs: [ month, day ], noInsert: true, transpositionCost: 0.1 })

// (repos created on) [month] [day] [year]/[year-phrase]
var monthDayYear = g.newSymbol('month', 'day', 'year')
monthDayYear.addRule({ rhs: [ monthDay, year ], noInsert: true, transpositionCost: 0.1 })
monthDayYear.addRule({ rhs: [ monthDay, yearPhrase ] })


// STRICT
var dateStrict = g.newSymbol('date', 'strict')
// (repos created) this/last week/month/year, today, yesterday
dateStrict.addRule({ rhs: [ datePhrase ] })
// (repos created) in [year]
dateStrict.addRule({ rhs: [ preps.origin, year ] })
// (repos created) in [month] [year]/[year-phrase]
dateStrict.addRule({ rhs: [ preps.origin, monthYear ] })
// (repos created) on [month] [day] [year]/[year-phrase]
dateStrict.addRule({ rhs: [ preps.day, monthDayYear ] })

// INTERVAL
var dateValue = g.newSymbol('date', 'value')
// (repos created before/after) this/last week/month/year, today, yesterday
dateValue.addRule({ rhs: [ datePhrase ] })
// (repos created before/after) [year]
dateValue.addRule({ rhs: [ year ] })
// (repos created before/after) [month] [year]/[year-phrase]
dateValue.addRule({ rhs: [ monthYear ] })
// (repos created before/after) [month] [day] [year]/[year-phrase]
dateValue.addRule({ rhs: [ monthDayYear ] })


var dateBeforeSemantic = g.newSemantic({
	name: g.hyphenate('date', 'before'),
	minParams: 1,
	maxParams: 3,
	cost: 0.5,
})
var dateAfterSemantic = g.newSemantic({
	name: g.hyphenate('date', 'after'),
	minParams: 1,
	maxParams: 3,
	cost: 0.5,
})

// Semantic reduces the pair of semantics to a single semantic, because the two can not exist independently, unlike `date-before()` and `date-after()`.
var dateIntervalSemantic = g.newSemantic({
	name: g.hyphenate('date', 'interval'),
	minParams: 2,
	maxParams: 2,
	// No cost.
	cost: 0,
})
var dateSemantic = g.newSemantic({
	name: 'date',
	minParams: 1,
	maxParams: 3,
	cost: 0.5,
})


var dateIntervalStopWord = g.newSymbol('date', 'interval', 'stop', 'word').addStopWords('from', 'in')

// (repos created) <from> before (`[date-value]`)
var prepBefore = g.newBinaryRule({ rhs: [ dateIntervalStopWord, preps.before ] })
var prepBeforeDatePhraseOrValue = g.newBinaryRule({ rhs: [ prepBefore, dateValue ], semantic: dateBeforeSemantic })
// (repos created) <from> after (`[date-value]`)
var prepAfter = g.newBinaryRule({ rhs: [ dateIntervalStopWord, preps.after ] })
var prepAfterDatePhraseOrValue = g.newBinaryRule({ rhs: [ prepAfter, dateValue ], semantic: dateAfterSemantic })

var dateInterval = g.newSymbol('date', 'interval')
// (repos created) before `[date-value]`, `date-before(a,b,c)` - exclusive
dateInterval.addRule({ rhs: [ prepBefore, dateValue ], semantic: dateBeforeSemantic })
// (repos created) after `[date-value]`, `date-after(a,b,c)` - exclusive
dateInterval.addRule({ rhs: [ prepAfter, dateValue ], semantic: dateAfterSemantic })

// (repos created) <from> before `[date-value]` and <from>  after `[date-value]`
// `date-after(a,b,c),date-before(a,b,c)` - exclusive
dateInterval.addRule({
	rhs: [ prepBeforeDatePhraseOrValue, [ conjunction.and, prepAfterDatePhraseOrValue ] ],
	noInsertionIndexes: [ 1 ],
})
// (repos created) <from> after `[date-value]` and <from> before `[date-value]`
// `date-after(a,b,c),date-before(a,b,c)` - exclusive
dateInterval.addRule({
	rhs: [ prepAfterDatePhraseOrValue, [ conjunction.and, prepBeforeDatePhraseOrValue ] ],
	noInsertionIndexes: [ 1 ],
})

// The following two rules require `date-interval()` to keep interval-bound semantics within a single LHS (parent) semantic, which will have `maxParams` as 1 and would otherwise be copied for each of these RHS semantics.
// (repos created) from `[date-value]` to `[date-value]`
// `date-interval(date(a,b,c),date(a,b,c))` - inclusive
dateInterval.addRule({ rhs: [
	g.newBinaryRule({ rhs: [ preps.start, dateValue ], semantic: dateSemantic }),
	g.newBinaryRule({ rhs: [ preps.end, dateValue ], semantic: dateSemantic })
], semantic: dateIntervalSemantic })
// (repos created) <from> between `[date-value]` and `[date-value]`
// `date-interval(date(a,b,c),date(a,b,c))` - inclusive
dateInterval.addRule({ rhs: [
	g.newBinaryRule({ rhs: [ [ dateIntervalStopWord, preps.between ], dateValue ], semantic: dateSemantic }),
	g.newBinaryRule({ rhs: [ conjunction.and, dateValue ], semantic: dateSemantic })
], semantic: dateIntervalSemantic })


var date = g.newSymbol('date')
// (repos created) this/last week/month/year, today, yesterday
// (repos created) in [year]
// (repos created) in [month] [year]/[year-phrase]
// (repos created) on [month] [day] [year]/[year-phrase]
date.addRule({ rhs: [ dateStrict ], semantic: dateSemantic })
// (repos created) before/after `[date-value]`
// (repos created) before/after `[date-value]` and before/after `[date-value]`
// (repos created) from `[date-value]` to `[date-value]`
// (repos created) between `[date-value]` and `[date-value]`
date.addRule({ rhs: [ dateInterval ] })

// Export `[date]`.
module.exports = date