var g = require('../grammar')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')


// PHRASE
var datePhrase = g.newSymbol('date', 'phrase')

// (repos created) this month/year
var thisDate = g.newSymbol('this', 'date')
thisDate.addWord({
  insertionCost: 1.5,
  accepted: [ 'this' ],
  substitutions: [ 'in|within this', 'in|within the last|past' ]
})

// (repos created) last month/year
var lastDate = g.newSymbol('last', 'date')
lastDate.addWord({
  insertionCost: 0.5,
  accepted: [ 'last' ],
  substitutions: [ 'in|within the last|past' ]
})

var yearTerm = g.newSymbol('year', 'term')
yearTerm.addWord({
  accepted: [ 'year' ]
})

var yearPhrase = g.newSymbol('year', 'phrase')
// (repos created) this year
yearPhrase.addRule({
  RHS: [ thisDate, yearTerm ],
  semantic: g.newSemantic({ isArg: true, name: g.hyphenate('this', 'year'), cost: 0.5 })
})
// (repos created) last year
yearPhrase.addRule({
  RHS: [ lastDate, yearTerm ],
  semantic: g.newSemantic({ isArg: true, name: g.hyphenate('last', 'year'), cost: 0.5 })
})
datePhrase.addRule({ RHS: [ yearPhrase ] })

var monthTerm = g.newSymbol('month', 'term')
monthTerm.addWord({
  accepted: [ 'month' ]
})
// (repos created) this month
datePhrase.addRule({
  RHS: [ thisDate, monthTerm ],
  semantic: g.newSemantic({ isArg: true, name: g.hyphenate('this', 'month'), cost: 0.5 })
})
// (repos created) last month
datePhrase.addRule({
  RHS: [ lastDate, monthTerm ],
  semantic: g.newSemantic({ isArg: true, name: g.hyphenate('last', 'month'), cost: 0.5 })
})

var weekTerm = g.newSymbol('week', 'term')
weekTerm.addWord({
  insertionCost: 1.5,
  accepted: [ 'week' ]
})
// (repos created) this week
datePhrase.addRule({
  RHS: [ thisDate, weekTerm ],
  semantic: g.newSemantic({ isArg: true, name: g.hyphenate('this', 'week'), cost: 0.5 })
})
// (repos created) last week
datePhrase.addRule({
  RHS: [ lastDate, weekTerm ],
  semantic: g.newSemantic({ isArg: true, name: g.hyphenate('last', 'week'), cost: 0.5 })
})

// (repos created) today
datePhrase.addRule({
  terminal: true,
  RHS: 'today',
  insertionCost: 1,
  semantic: g.newSemantic({ isArg: true, name: g.hyphenate('today'), cost: 0.5 })
})
// (repos created) yesterday
datePhrase.addRule({
  terminal: true,
  RHS: 'yesterday',
  semantic: g.newSemantic({ isArg: true, name: g.hyphenate('yesterday'), cost: 0.5 })
})


// VALUE
// (repos created in) [year]
// Cannot add [year-phrase] to [year] because creates ambiguity when both [year] and [date-phrase] used in [date-phrase-or-value]
var year = g.newSymbol('year')
year.addInt({ min: 1950, max: 2050 })

var month = g.newSymbol('month')
month.addRule({
  RHS: [ g.newSymbol('january').addWord({ accepted: [ 'January', '01' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'jan', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('february').addWord({ accepted: [ 'February', '02' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'feb', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('march').addWord({ accepted: [ 'March', '03' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'mar', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('april').addWord({ accepted: [ 'April', '04' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'apr', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('may').addWord({ accepted: [ 'May', '05' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'may', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('june').addWord({ accepted: [ 'June', '06' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'jun', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('july').addWord({ accepted: [ 'July', '07' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'jul', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('august').addWord({ accepted: [ 'August', '08' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'aug', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('september').addWord({ accepted: [ 'September', '09' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'sep', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('october').addWord({ accepted: [ 'October', '10' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'oct', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('november').addWord({ accepted: [ 'November', '11' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'nov', cost: 0.5 })
})
month.addRule({
  RHS: [ g.newSymbol('december').addWord({ accepted: [ 'December', '12' ] }) ],
  semantic: g.newSemantic({ isArg: true, name: 'dec', cost: 0.5 })
})
// (repos created in) [month] [year]
var monthYear = g.newSymbol('month', 'year')
monthYear.addRule({ RHS: [ month, year ], transpositionCost: 0.1 })
monthYear.addRule({ RHS: [ month, yearPhrase ] })

var day = g.newSymbol('day')
day.addInt({ min: 1, max: 31 })
var monthDay = g.newSymbol('month', 'day')
monthDay.addRule({ RHS: [ month, day ], transpositionCost: 0.1 })
var monthDayYear = g.newSymbol('month', 'day', 'year')
monthDayYear.addRule({ RHS: [ monthDay, year ], transpositionCost: 0.1 })
monthDayYear.addRule({ RHS: [ monthDay, yearPhrase ] })


// STRICT
var dateStrict = g.newSymbol('date', 'strict')
// (repos created) this/last month/year
dateStrict.addRule({ RHS: [ datePhrase ] })
// (repos created) in [year]
dateStrict.addRule({ RHS: [ preps.container, year ] })
// (repos created) in [month] [year]
dateStrict.addRule({ RHS: [ preps.container, monthYear ] })
// (repos created) on [month] [day] [year]
dateStrict.addRule({ RHS: [ preps.surface, monthDayYear ] })

// INTERVAL
var datePhraseOrValue = g.newSymbol('date', 'phrase', 'or', 'value')
// (repos created before/after) this/last month/year
datePhraseOrValue.addRule({ RHS: [ datePhrase ] })
// (repos created before/after) [year]
datePhraseOrValue.addRule({ RHS: [ year ] })
// (repos created before/after) [month] [year]
datePhraseOrValue.addRule({ RHS: [ monthYear ] })
// (repos created before/after) [month] [day] [year]
datePhraseOrValue.addRule({ RHS: [ monthDayYear ] })


var dateBeforeSemantic = g.newSemantic({ name: g.hyphenate('date', 'before'), minParams: 1, maxParams: 3, cost: 0.5 })
var dateAfterSemantic = g.newSemantic({ name: g.hyphenate('date', 'after'), minParams: 1, maxParams: 3, cost: 0.5 })
var dateIntervalStartSemantic = g.newSemantic({ name: g.hyphenate('date', 'interval', 'start'), minParams: 1, maxParams: 3, cost: 0.5 })
var dateIntervalEndSemantic = g.newSemantic({ name: g.hyphenate('date', 'interval', 'end'), minParams: 1, maxParams: 3, cost: 0.5 })


var dateIntervalStopWord = g.newSymbol('date', 'interval', 'stop', 'word')
dateIntervalStopWord.addStopWord({
  stopWords: [ 'from|in' ]
})

// (repos created) <from> before (this year)
var prepBefore = g.newBinaryRule({ RHS: [ dateIntervalStopWord, preps.before ] })
var prepBeforeDatePhraseOrValue = g.newBinaryRule({ RHS: [ prepBefore, datePhraseOrValue ], semantic: dateBeforeSemantic })
// (repos created) <from> after (this year)
var prepAfter = g.newBinaryRule({ RHS: [ dateIntervalStopWord, preps.after ] })
var prepAfterDatePhraseOrValue = g.newBinaryRule({ RHS: [ prepAfter, datePhraseOrValue ], semantic: dateAfterSemantic })

var dateInterval = g.newSymbol('date', 'interval')
// (repos created) before this year, [month] [year]
dateInterval.addRule({ RHS: [ prepBefore, datePhraseOrValue ], semantic: dateBeforeSemantic })
// (repos created) after this year, [month] [year]
dateInterval.addRule({ RHS: [ prepAfter, datePhraseOrValue ], semantic: dateAfterSemantic })
// (repos created) <from> after [year] and <from> before [year]
dateInterval.addRule({ RHS: [ prepAfterDatePhraseOrValue, [ conjunctions.and, prepBeforeDatePhraseOrValue ] ] })
// (repos created) <from> before [year] and <from>  after [year]
dateInterval.addRule({ RHS: [ prepBeforeDatePhraseOrValue, [ conjunctions.and, prepAfterDatePhraseOrValue ] ] })
// (repos created) from [year] to [year]
dateInterval.addRule({ RHS: [
	g.newBinaryRule({ RHS: [ preps.start, datePhraseOrValue ], semantic: dateIntervalStartSemantic }),
	g.newBinaryRule({ RHS: [ preps.end, datePhraseOrValue ], semantic: dateIntervalEndSemantic })
] })
// (repos created) <from> between [year] and [year]
dateInterval.addRule({ RHS: [
	g.newBinaryRule({ RHS: [ [ dateIntervalStopWord, preps.between ], datePhraseOrValue ], semantic: dateIntervalStartSemantic }),
	g.newBinaryRule({ RHS: [ conjunctions.and, datePhraseOrValue ], semantic: dateIntervalEndSemantic })
] })


exports.general = g.newSymbol('date', 'general')
// (repos created) this year, in [year], in [month] [year]
var dateSemantic = g.newSemantic({ name: 'date', minParams: 1, maxParams: 3, cost: 0.5 })
exports.general.addRule({ RHS: [ dateStrict ], semantic: dateSemantic })
// (repos created) before/after [year], from [year] to [year], between [year] and [year]
exports.general.addRule({ RHS: [ dateInterval ] })