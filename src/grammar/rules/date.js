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
  semantic: g.newSemantic({ name: g.hyphenate('this', 'year'), cost: 0.5, isArg: true })
})
// (repos created) last year
yearPhrase.addRule({
  RHS: [ lastDate, yearTerm ],
  semantic: g.newSemantic({ name: g.hyphenate('last', 'last'), cost: 0.5, isArg: true })
})
datePhrase.addRule({ RHS: [ yearPhrase ] })

var monthTerm = g.newSymbol('month', 'term')
monthTerm.addWord({
  accepted: [ 'month' ]
})
// (repos created) this month
datePhrase.addRule({
  RHS: [ thisDate, monthTerm ],
  semantic: g.newSemantic({ name: g.hyphenate('this', 'month'), cost: 0.5, isArg: true })
})
// (repos created) last month
datePhrase.addRule({
  RHS: [ lastDate, monthTerm ],
  semantic: g.newSemantic({ name: g.hyphenate('last', 'month'), cost: 0.5, isArg: true })
})

var weekTerm = g.newSymbol('week', 'term')
weekTerm.addWord({
  insertionCost: 1.5,
  accepted: [ 'week' ]
})
// (repos created) this week
datePhrase.addRule({
  RHS: [ thisDate, weekTerm ],
  semantic: g.newSemantic({ name: g.hyphenate('this', 'week'), cost: 0.5, isArg: true })
})
// (repos created) last week
datePhrase.addRule({
  RHS: [ lastDate, weekTerm ],
  semantic: g.newSemantic({ name: g.hyphenate('last', 'week'), cost: 0.5, isArg: true })
})

// (repos created) today
datePhrase.addRule({
  terminal: true,
  RHS: 'today',
  text: 'today',
  insertionCost: 1,
  semantic: g.newSemantic({ name: g.hyphenate('today'), cost: 0.5, isArg: true })
})
// (repos created) yesterday
datePhrase.addRule({
  terminal: true,
  RHS: 'yesterday',
  text: 'yesterday',
  semantic: g.newSemantic({ name: g.hyphenate('yesterday'), cost: 0.5, isArg: true })
})


// VALUE
// (repos created in) [year]
var year = g.newSymbol('year')
year.addInt({ min: 1950, max: 2050 })
year.addRule({ RHS: [ yearPhrase ] })

var month = g.newSymbol('month')
month.addRule({
  RHS: [ (g.newSymbol('january')).addWord({ accepted: [ 'January', '01' ] }) ],
  semantic: g.newSemantic({ name: 'jan', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('february')).addWord({ accepted: [ 'February', '02' ] }) ],
  semantic: g.newSemantic({ name: 'feb', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('march')).addWord({ accepted: [ 'March', '03' ] }) ],
  semantic: g.newSemantic({ name: 'mar', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('april')).addWord({ accepted: [ 'April', '04' ] }) ],
  semantic: g.newSemantic({ name: 'apr', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('may')).addWord({ accepted: [ 'May', '05' ] }) ],
  semantic: g.newSemantic({ name: 'may', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('june')).addWord({ accepted: [ 'June', '06' ] }) ],
  semantic: g.newSemantic({ name: 'jun', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('july')).addWord({ accepted: [ 'July', '07' ] }) ],
  semantic: g.newSemantic({ name: 'jul', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('august')).addWord({ accepted: [ 'August', '08' ] }) ],
  semantic: g.newSemantic({ name: 'aug', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('september')).addWord({ accepted: [ 'September', '09' ] }) ],
  semantic: g.newSemantic({ name: 'sep', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('october')).addWord({ accepted: [ 'October', '10' ] }) ],
  semantic: g.newSemantic({ name: 'oct', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('november')).addWord({ accepted: [ 'November', '11' ] }) ],
  semantic: g.newSemantic({ name: 'nov', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (g.newSymbol('december')).addWord({ accepted: [ 'December', '12' ] }) ],
  semantic: g.newSemantic({ name: 'dec', cost: 0.5, isArg: true })
})
// (repos created in) [month] [year]
var monthYear = g.newSymbol('month', 'year')
monthYear.addRule({ RHS: [ month, year ], transpositionCost: 0.1 })

var day = g.newSymbol('day')
day.addInt({ min: 1, max: 31 })
var monthDay = g.newSymbol('month', 'day')
monthDay.addRule({ RHS: [ month, day ], transpositionCost: 0.1 })
var monthDayYear = g.newSymbol('month', 'day', 'year')
monthDayYear.addRule({ RHS: [ monthDay, year ], transpositionCost: 0.1 })


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
var dateValueOrPhrase = g.newSymbol('date', 'phrase', 'or', 'value')
// (repos created before/after) this/last month/year
dateValueOrPhrase.addRule({ RHS: [ datePhrase ] })
// (repos created before/after) [year]
dateValueOrPhrase.addRule({ RHS: [ year ] })
// (repos created before/after) [month] [year]
dateValueOrPhrase.addRule({ RHS: [ monthYear ] })
// (repos created before/after) [month] [day] [year]
dateValueOrPhrase.addRule({ RHS: [ monthDayYear ] })


var dateBeforeSemantic = g.newSemantic({ name: g.hyphenate('date', 'before'), minParams: 1, maxParams: 3, cost: 0.5 })
var dateAfterSemantic = g.newSemantic({ name: g.hyphenate('date', 'after'), minParams: 1, maxParams: 3, cost: 0.5 })
var dateIntervalStartSemantic = g.newSemantic({ name: g.hyphenate('date', 'interval', 'start'), minParams: 1, maxParams: 3, cost: 0.5 })
var dateIntervalEndSemantic = g.newSemantic({ name: g.hyphenate('date', 'interval', 'end'), minParams: 1, maxParams: 3, cost: 0.5 })


var dateIntervalStopWord = g.newSymbol('date', 'interval', 'stop', 'word')
dateIntervalStopWord.addStopWord({
  stopWords: [ 'from|in' ]
})

// (repos created) <from> before this year
var prepBefore = g.newSymbol('date', 'interval', 'stop', 'word', 'prep', 'before')
prepBefore.addRule({ RHS: [ dateIntervalStopWord, preps.before ] })
var andPrepBefore = g.newSymbol('and', 'prep', 'before')
andPrepBefore.addRule({ RHS: [ conjunctions.and, prepBefore ] })

// (repos created) <from> after this year
var prepAfter = g.newSymbol('date', 'interval', 'stop', 'word', 'prep', 'after')
prepAfter.addRule({ RHS: [ dateIntervalStopWord, preps.after ] })
var andPrepAfter = g.newSymbol('and', 'prep', 'after')
andPrepAfter.addRule({ RHS: [ conjunctions.and, prepAfter ] })

// (repos created) <from> between last year and this year
var prepBetween = g.newSymbol('date', 'interval', 'stop', 'word', 'prep', 'between')
prepBetween.addRule({ RHS: [ dateIntervalStopWord, preps.between ] })


var dateInterval = g.newSymbol('date', 'interval')

// (repos created) before this year, [month] [year]
dateInterval.addRule({ RHS: [ prepBefore, dateValueOrPhrase ], semantic: dateBeforeSemantic })

// (repos created) after this year, [month] [year]
dateInterval.addRule({ RHS: [ prepAfter, dateValueOrPhrase ], semantic: dateAfterSemantic })

// (repos created) after [year] and before [year]
var prepAfterDatePresentOrPhrase = g.newSymbol('prep', 'after', 'date', 'value', 'or', 'phrase')
prepAfterDatePresentOrPhrase.addRule({ RHS: [ prepAfter, dateValueOrPhrase ], semantic: dateAfterSemantic })
var andPrepBeforeDatePresentOrPhrase = g.newSymbol('and', 'prep', 'before', 'date', 'value', 'or', 'phrase')
andPrepBeforeDatePresentOrPhrase.addRule({ RHS: [ andPrepBefore, dateValueOrPhrase ], semantic: dateBeforeSemantic })
dateInterval.addRule({ RHS: [ prepAfterDatePresentOrPhrase, andPrepBeforeDatePresentOrPhrase ] })

// (repos created) before [year] and after [year]
var prepBeforeDatePresentOrPhrase = g.newSymbol('prep', 'before', 'date', 'value', 'or', 'phrase')
prepBeforeDatePresentOrPhrase.addRule({ RHS: [ prepBefore, dateValueOrPhrase ], semantic: dateBeforeSemantic })
var andPrepAfterDatePresentOrPhrase = g.newSymbol('and', 'prep', 'after', 'date', 'value', 'or', 'phrase')
andPrepAfterDatePresentOrPhrase.addRule({ RHS: [ andPrepAfter, dateValueOrPhrase ], semantic: dateAfterSemantic })
dateInterval.addRule({ RHS: [ prepBeforeDatePresentOrPhrase, andPrepAfterDatePresentOrPhrase ] })

// (repos created) from [year] to [year]
var prepStartDatePresentOrPhrase = g.newSymbol('prep', 'start', 'date', 'value', 'or', 'phrase')
prepStartDatePresentOrPhrase.addRule({ RHS: [ preps.start, dateValueOrPhrase ], semantic: dateIntervalStartSemantic })
var prepEndDatePresentOrPhrase = g.newSymbol('prep', 'end', 'date', 'value', 'or', 'phrase')
prepEndDatePresentOrPhrase.addRule({ RHS: [ preps.end, dateValueOrPhrase ], semantic: dateIntervalEndSemantic })
dateInterval.addRule({ RHS: [ prepStartDatePresentOrPhrase, prepEndDatePresentOrPhrase ] })

// (repos created) between [year] and [year]
var prepBetweenDatePresentOrPhrase = g.newSymbol('prep', 'between', 'date', 'value', 'or', 'phrase')
prepBetweenDatePresentOrPhrase.addRule({ RHS: [ prepBetween, dateValueOrPhrase ], semantic: dateIntervalStartSemantic })
var andDatePresentOrPhrase = g.newSymbol('and', 'date', 'value', 'or', 'phrase')
andDatePresentOrPhrase.addRule({ RHS: [ conjunctions.and, dateValueOrPhrase ], semantic: dateIntervalEndSemantic })
dateInterval.addRule({ RHS: [ prepBetweenDatePresentOrPhrase, andDatePresentOrPhrase ] })


exports.general = g.newSymbol('date', 'general')
// (repos created) this year, in [year], in [month] [year]
var dateSemantic = g.newSemantic({ name: 'date', minParams: 1, maxParams: 3, cost: 0.5 })
exports.general.addRule({ RHS: [ dateStrict ], semantic: dateSemantic })
// (repos created) before/after [year], from [year] to [year], between [year] and [year]
exports.general.addRule({ RHS: [ dateInterval ] })