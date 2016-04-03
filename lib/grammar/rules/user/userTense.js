var g = require('../../grammar')
var user = require('./user')


var everPastSemantic = g.newSemantic({
	name: g.hyphenate('ever', 'past'),
	cost: 0.3,
	minParams: 1,
	maxParams: 1,
})


// Represents past actions for verbs for which the tense (i.e., temporality) is meaningful.
user.subjFilterPast = g.newSymbol(user.subjFilter.name, 'past')

// (people who) worked at `[companies+]`
user.subjFilter.addRule({
	rhs: [ user.subjFilterPast ],
	semantic: everPastSemantic,
})