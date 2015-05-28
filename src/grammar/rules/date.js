var g = require('../grammar')
var preps = require('./prepositions')
var conjunctions = require('./conjunctions')


// PHRASE
var datePhrase = new g.Symbol('date', 'phrase')

// (repos created) this month/year
var thisDate = new g.Symbol('this', 'date')
thisDate.addWord({
  insertionCost: 1.5,
  accepted: [ 'this' ],
  substitutions: [ 'in|within this', 'in|within the last|past' ]
})

// (repos created) last month/year
var lastDate = new g.Symbol('last', 'date')
lastDate.addWord({
  insertionCost: 0.5,
  accepted: [ 'last' ],
  substitutions: [ 'in|within the last|past' ]
})

var yearTerm = new g.Symbol('year', 'term')
yearTerm.addWord({
  accepted: [ 'year' ]
})

var yearPhrase = new g.Symbol('year', 'phrase')
// (repos created) this year
yearPhrase.addRule({
  RHS: [ thisDate, yearTerm ],
  semantic: g.newSemantic({ name: g.hyphenate('this', 'year'), cost: 0.5, isArg: true })
})
// (repos created) last year
yearPhrase.addRule({
  RHS: [ lastDate, yearTerm ],
  semantic: g.newSemantic({ name: g.hyphenate('last', 'year'), cost: 0.5, isArg: true })
})
datePhrase.addRule({ RHS: [ yearPhrase ] })

var monthTerm = new g.Symbol('month', 'term')
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

var weekTerm = new g.Symbol('week', 'term')
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
var year = new g.Symbol('year')
year.addInt({ min: 1950, max: 2050 })
year.addRule({ RHS: [ yearPhrase ] })

var month = new g.Symbol('month')
month.addRule({
  RHS: [ (new g.Symbol('january')).addWord({ accepted: [ 'January', '01' ] }) ],
  semantic: g.newSemantic({ name: 'jan', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('february')).addWord({ accepted: [ 'February', '02' ] }) ],
  semantic: g.newSemantic({ name: 'feb', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('march')).addWord({ accepted: [ 'March', '03' ] }) ],
  semantic: g.newSemantic({ name: 'mar', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('april')).addWord({ accepted: [ 'April', '04' ] }) ],
  semantic: g.newSemantic({ name: 'apr', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('may')).addWord({ accepted: [ 'May', '05' ] }) ],
  semantic: g.newSemantic({ name: 'may', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('june')).addWord({ accepted: [ 'June', '06' ] }) ],
  semantic: g.newSemantic({ name: 'jun', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('july')).addWord({ accepted: [ 'July', '07' ] }) ],
  semantic: g.newSemantic({ name: 'jul', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('august')).addWord({ accepted: [ 'August', '08' ] }) ],
  semantic: g.newSemantic({ name: 'aug', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('september')).addWord({ accepted: [ 'September', '09' ] }) ],
  semantic: g.newSemantic({ name: 'sep', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('october')).addWord({ accepted: [ 'October', '10' ] }) ],
  semantic: g.newSemantic({ name: 'oct', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('november')).addWord({ accepted: [ 'November', '11' ] }) ],
  semantic: g.newSemantic({ name: 'nov', cost: 0.5, isArg: true })
})
month.addRule({
  RHS: [ (new g.Symbol('december')).addWord({ accepted: [ 'December', '12' ] }) ],
  semantic: g.newSemantic({ name: 'dec', cost: 0.5, isArg: true })
})
// (repos created in) [month] [year]
var monthYear = new g.Symbol('month', 'year')
monthYear.addRule({ RHS: [ month, year ], transpositionCost: 0.1 })

var day = new g.Symbol('day')
day.addInt({ min: 1, max: 31 })
var monthDay = new g.Symbol('month', 'day')
monthDay.addRule({ RHS: [ month, day ], transpositionCost: 0.1 })
var monthDayYear = new g.Symbol('month', 'day', 'year')
monthDayYear.addRule({ RHS: [ monthDay, year ], transpositionCost: 0.1 })


// STRICT
var dateStrict = new g.Symbol('date', 'strict')
// (repos created) this/last month/year
dateStrict.addRule({ RHS: [ datePhrase ] })
// (repos created) in [year]
dateStrict.addRule({ RHS: [ preps.container, year ] })
// (repos created) in [month] [year]
dateStrict.addRule({ RHS: [ preps.container, monthYear ] })
// (repos created) on [month] [day] [year]
dateStrict.addRule({ RHS: [ preps.surface, monthDayYear ] })

// INTERVAL
var dateValueOrPhrase = new g.Symbol('date', 'phrase', 'or', 'value')
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


var dateIntervalStopWord = new g.Symbol('date', 'interval', 'stop', 'word')
dateIntervalStopWord.addStopWord({
  stopWords: [ 'from|in' ]
})

// (repos created) <from> before this year
var prepBefore = new g.Symbol('date', 'interval', 'stop', 'word', 'prep', 'before')
prepBefore.addRule({ RHS: [ dateIntervalStopWord, preps.before ] })
var andPrepBefore = new g.Symbol('and', 'prep', 'before')
andPrepBefore.addRule({ RHS: [ conjunctions.and, prepBefore ] })

// (repos created) <from> after this year
var prepAfter = new g.Symbol('date', 'interval', 'stop', 'word', 'prep', 'after')
prepAfter.addRule({ RHS: [ dateIntervalStopWord, preps.after ] })
var andPrepAfter = new g.Symbol('and', 'prep', 'after')
andPrepAfter.addRule({ RHS: [ conjunctions.and, prepAfter ] })

// (repos created) <from> between last year and this year
var prepBetween = new g.Symbol('date', 'interval', 'stop', 'word', 'prep', 'between')
prepBetween.addRule({ RHS: [ dateIntervalStopWord, preps.between ] })


var dateInterval = new g.Symbol('date', 'interval')

// (repos created) before this year, [month] [year]
dateInterval.addRule({ RHS: [ prepBefore, dateValueOrPhrase ], semantic: dateBeforeSemantic })

// (repos created) after this year, [month] [year]
dateInterval.addRule({ RHS: [ prepAfter, dateValueOrPhrase ], semantic: dateAfterSemantic })

// (repos created) after [year] and before [year]
var prepAfterDatePresentOrPhrase = new g.Symbol('prep', 'after', 'date', 'value', 'or', 'phrase')
prepAfterDatePresentOrPhrase.addRule({ RHS: [ prepAfter, dateValueOrPhrase ], semantic: dateAfterSemantic })
var andPrepBeforeDatePresentOrPhrase = new g.Symbol('and', 'prep', 'before', 'date', 'value', 'or', 'phrase')
andPrepBeforeDatePresentOrPhrase.addRule({ RHS: [ andPrepBefore, dateValueOrPhrase ], semantic: dateBeforeSemantic })
dateInterval.addRule({ RHS: [ prepAfterDatePresentOrPhrase, andPrepBeforeDatePresentOrPhrase ] })

// (repos created) before [year] and after [year]
var prepBeforeDatePresentOrPhrase = new g.Symbol('prep', 'before', 'date', 'value', 'or', 'phrase')
prepBeforeDatePresentOrPhrase.addRule({ RHS: [ prepBefore, dateValueOrPhrase ], semantic: dateBeforeSemantic })
var andPrepAfterDatePresentOrPhrase = new g.Symbol('and', 'prep', 'after', 'date', 'value', 'or', 'phrase')
andPrepAfterDatePresentOrPhrase.addRule({ RHS: [ andPrepAfter, dateValueOrPhrase ], semantic: dateAfterSemantic })
dateInterval.addRule({ RHS: [ prepBeforeDatePresentOrPhrase, andPrepAfterDatePresentOrPhrase ] })

// (repos created) from [year] to [year]
var prepStartDatePresentOrPhrase = new g.Symbol('prep', 'start', 'date', 'value', 'or', 'phrase')
prepStartDatePresentOrPhrase.addRule({ RHS: [ preps.start, dateValueOrPhrase ], semantic: dateIntervalStartSemantic })
var prepEndDatePresentOrPhrase = new g.Symbol('prep', 'end', 'date', 'value', 'or', 'phrase')
prepEndDatePresentOrPhrase.addRule({ RHS: [ preps.end, dateValueOrPhrase ], semantic: dateIntervalEndSemantic })
dateInterval.addRule({ RHS: [ prepStartDatePresentOrPhrase, prepEndDatePresentOrPhrase ] })

// (repos created) between [year] and [year]
var prepBetweenDatePresentOrPhrase = new g.Symbol('prep', 'between', 'date', 'value', 'or', 'phrase')
prepBetweenDatePresentOrPhrase.addRule({ RHS: [ prepBetween, dateValueOrPhrase ], semantic: dateIntervalStartSemantic })
var andDatePresentOrPhrase = new g.Symbol('and', 'date', 'value', 'or', 'phrase')
andDatePresentOrPhrase.addRule({ RHS: [ conjunctions.and, dateValueOrPhrase ], semantic: dateIntervalEndSemantic })
dateInterval.addRule({ RHS: [ prepBetweenDatePresentOrPhrase, andDatePresentOrPhrase ] })


exports.general = new g.Symbol('date', 'general')
// (repos created) this year, in [year], in [month] [year]
var dateSemantic = g.newSemantic({ name: 'date', minParams: 1, maxParams: 3, cost: 0.5 })
exports.general.addRule({ RHS: [ dateStrict ], semantic: dateSemantic })
// (repos created) before/after [year], from [year] to [year], between [year] and [year]
exports.general.addRule({ RHS: [ dateInterval ] })