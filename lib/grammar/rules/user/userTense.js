var g = require('../../grammar')
var user = require('./user')


var everPastSemantic = g.newSemantic({
	name: g.hyphenate('ever', 'past'),
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})

var pastSemantic = g.newSemantic({
	name: 'past',
	cost: 0,
	minParams: 1,
	maxParams: 1,
})

var previously = g.newSymbol('previously').addWord({
	accepted: [ 'previously', 'formerly' ],
})


// Represents past actions for verbs for which the tense (i.e., time) is meaningful.
user.subjFilterPast = g.newSymbol(user.subjFilter.name, 'past')

// (people who) worked at `[companies+]`
user.subjFilter.addRule({
	rhs: [ user.subjFilterPast ],
	semantic: everPastSemantic,
})

// (people who) previously worked at `[companies+]`
user.subjFilter.addRule({
	rhs: [ previously, user.subjFilterPast ],
	// Enable transposition:
	//   "(people who) worked at `[companies+]` previously" -> "(people who) previously worked at `[companies+]`"
	transpositionCost: 1,
	semantic: pastSemantic,
})