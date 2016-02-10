var g = require('../grammar')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')


// PHRASE
var datePhrase = g.newSymbol('date', 'phrase')

// (repos created) this month/year
var thisDate = g.newSymbol('this', 'date').addWord({
	insertionCost: 1,
	accepted: [ 'this' ],
	substitutions: [ 'in|within this', 'in|within the last|past' ],
})

// (repos created) last month/year
var lastDate = g.newSymbol('last', 'date').addWord({
	insertionCost: 1.5,
	accepted: [ 'last' ],
	substitutions: [ { symbol: 'in|within the last|past', costPenalty: 1 } ],
})

var yearTerm = g.newSymbol('year', 'term').addWord({
	insertionCost: 0.5,
	accepted: [ 'year' ],
})

var yearPhrase = g.newSymbol('year', 'phrase')
// (repos created) this year
yearPhrase.addRule({
	rhs: [ thisDate, yearTerm ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('this', 'year'), cost: 0.5 })
})
// (repos created) last year
yearPhrase.addRule({
	rhs: [ lastDate, yearTerm ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('last', 'year'), cost: 0.5 })
})
datePhrase.addRule({ rhs: [ yearPhrase ], noInsert: true })

var monthTerm = g.newSymbol('month', 'term').addWord({
	accepted: [ 'month' ],
})
// (repos created) this month
datePhrase.addRule({
	rhs: [ thisDate, monthTerm ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('this', 'month'), cost: 0.5 })
})
// (repos created) last month
datePhrase.addRule({
	rhs: [ lastDate, monthTerm ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('last', 'month'), cost: 0.5 })
})

var weekTerm = g.newSymbol('week', 'term').addWord({
	insertionCost: 1.5,
	accepted: [ 'week' ],
})
// (repos created) this week
datePhrase.addRule({
	rhs: [ thisDate, weekTerm ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('this', 'week'), cost: 0.5 })
})
// (repos created) last week
datePhrase.addRule({
	rhs: [ lastDate, weekTerm ],
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('last', 'week'), cost: 0.5 })
})

// (repos created) today
datePhrase.addRule({
	isTerminal: true,
	rhs: 'today',
	insertionCost: 1,
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('today'), cost: 0.5 })
})
// (repos created) yesterday
datePhrase.addRule({
	isTerminal: true,
	rhs: 'yesterday',
	semantic: g.newSemantic({ isArg: true, name: g.hyphenate('yesterday'), cost: 0.5 })
})


// VALUE
// (repos created in) [year]
// Can not add [year-phrase] to [year] because creates ambiguity when both [year] and [date-phrase] used in [date-phrase-or-value]
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

// (repos created in) [month] [year]
var monthYear = g.newSymbol('month', 'year')
monthYear.addRule({ rhs: [ month, year ], noInsert: true, transpositionCost: 0.1 })
monthYear.addRule({ rhs: [ month, yearPhrase ] })

var day = g.newSymbol('day')
day.addRule({
	isTerminal: true,
	rhs: g.newIntSymbol({ min: 1, max: 31 }),
	isPlaceholder: true,
})

var monthDay = g.newSymbol('month', 'day')
monthDay.addRule({ rhs: [ month, day ], noInsert: true, transpositionCost: 0.1 })

var monthDayYear = g.newSymbol('month', 'day', 'year')
monthDayYear.addRule({ rhs: [ monthDay, year ], noInsert: true, transpositionCost: 0.1 })
monthDayYear.addRule({ rhs: [ monthDay, yearPhrase ] })


// STRICT
var dateStrict = g.newSymbol('date', 'strict')
// (repos created) this/last month/year
dateStrict.addRule({ rhs: [ datePhrase ] })
// (repos created) in [year]
dateStrict.addRule({ rhs: [ preps.container, year ] })
// (repos created) in [month] [year]
dateStrict.addRule({ rhs: [ preps.container, monthYear ] })
// (repos created) on [month] [day] [year]
dateStrict.addRule({ rhs: [ preps.day, monthDayYear ] })

// INTERVAL
var datePhraseOrValue = g.newSymbol('date', 'phrase', 'or', 'value')
// (repos created before/after) this/last month/year
datePhraseOrValue.addRule({ rhs: [ datePhrase ] })
// (repos created before/after) [year]
datePhraseOrValue.addRule({ rhs: [ year ] })
// (repos created before/after) [month] [year]
datePhraseOrValue.addRule({ rhs: [ monthYear ] })
// (repos created before/after) [month] [day] [year]
datePhraseOrValue.addRule({ rhs: [ monthDayYear ] })


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
	cost: 0,
})
var dateSemantic = g.newSemantic({
	name: 'date',
	minParams: 1,
	maxParams: 3,
	cost: 0.5,
})


var dateIntervalStopWord = g.newSymbol('date', 'interval', 'stop', 'word').addStopWords('from', 'in')

// (repos created) <from> before (this year)
var prepBefore = g.newBinaryRule({ rhs: [ dateIntervalStopWord, preps.before ] })
var prepBeforeDatePhraseOrValue = g.newBinaryRule({ rhs: [ prepBefore, datePhraseOrValue ], semantic: dateBeforeSemantic })
// (repos created) <from> after (this year)
var prepAfter = g.newBinaryRule({ rhs: [ dateIntervalStopWord, preps.after ] })
var prepAfterDatePhraseOrValue = g.newBinaryRule({ rhs: [ prepAfter, datePhraseOrValue ], semantic: dateAfterSemantic })

var dateInterval = g.newSymbol('date', 'interval')
// (repos created) before this year, [month] [year]
dateInterval.addRule({ rhs: [ prepBefore, datePhraseOrValue ], semantic: dateBeforeSemantic })
// (repos created) after this year, [month] [year]
dateInterval.addRule({ rhs: [ prepAfter, datePhraseOrValue ], semantic: dateAfterSemantic })
// (repos created) <from> after [year] and <from> before [year]
dateInterval.addRule({
	rhs: [ prepAfterDatePhraseOrValue, [ conjunctions.and, prepBeforeDatePhraseOrValue ] ],
	noInsertionIndexes: [ 1 ],
})
// (repos created) <from> before [year] and <from>  after [year]
dateInterval.addRule({
	rhs: [ prepBeforeDatePhraseOrValue, [ conjunctions.and, prepAfterDatePhraseOrValue ] ],
	noInsertionIndexes: [ 1 ] })
// (repos created) from [year] to [year]
// Requires `date-interval-semantic()` to keep interval bound semantics within a single LHS semantic.
dateInterval.addRule({ rhs: [
	g.newBinaryRule({ rhs: [ preps.start, datePhraseOrValue ], semantic: dateSemantic }),
	g.newBinaryRule({ rhs: [ preps.end, datePhraseOrValue ], semantic: dateSemantic })
], semantic: dateIntervalSemantic })
// (repos created) <from> between [year] and [year]
// Requires `date-interval-semantic()` to keep interval bound semantics within a single LHS semantic.
dateInterval.addRule({ rhs: [
	g.newBinaryRule({ rhs: [ [ dateIntervalStopWord, preps.between ], datePhraseOrValue ], semantic: dateSemantic }),
	g.newBinaryRule({ rhs: [ conjunctions.and, datePhraseOrValue ], semantic: dateSemantic })
], semantic: dateIntervalSemantic })


exports.general = g.newSymbol('date', 'general')
// (repos created) this year, in [year], in [month] [year]
exports.general.addRule({ rhs: [ dateStrict ], semantic: dateSemantic })
// (repos created) before/after [year], from [year] to [year], between [year] and [year]
exports.general.addRule({ rhs: [ dateInterval ] })