var g = require('../grammar')

var prepStr = 'prep'

// (people followed) by (me)
this.agent = g.addWord({
	symbol: new g.Symbol(prepStr, 'agent'),
	insertionCost: 0.5,
	accepted: [ 'by' ]
})

// (followers) of (mine)
this.possessor = g.addWord({
	symbol: new g.Symbol(prepStr, 'possessor'),
	insertionCost: 0.5,
	accepted: [ 'of' ]
})

// (repos) of (mine)
// Same as [prep-possessor], without insertion cost
this.possessorSpecial = g.addWord({
	symbol: new g.Symbol(prepStr, 'possessor', 'special'),
	accepted: [ 'of' ]
})