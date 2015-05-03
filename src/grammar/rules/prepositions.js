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

// (issues) with (n comments)
this.possessed = g.addWord({
	symbol: new g.Symbol(prepStr, 'possessed'),
	insertionCost: 0.5,
	accepted: [ 'with' ],
	substitutions: [ 'have|having|containing' ]
})

// (issues with n) to (i comments)
this.end = g.addWord({
	symbol: new g.Symbol(prepStr, 'end'),
	insertionCost: 0.5,
	accepted: [ 'to' ]
})

// (issues with) between (n and i comments)
this.between = g.addWord({
	symbol: new g.Symbol(prepStr, 'between'),
	insertionCost: 2,
	accepted: [ 'between' ]
})

// (issues with) over (n comments)
this.over = g.addWord({
	symbol: new g.Symbol(prepStr, 'over'),
	insertionCost: 0.5,
	accepted: [ 'over', 'above|beyond', 'more than', '>' ]
})

// (issues with) under (n comments)
this.under = g.addWord({
	symbol: new g.Symbol(prepStr, 'under'),
	insertionCost: 0.5,
	accepted: [ 'under', 'below', 'less than', '<' ]
})