var g = require('../grammar')

var prepStr = 'prep'

// (people followed) by (me)
this.agent = new g.Symbol(prepStr, 'agent')
this.agent.addWord({
	insertionCost: 0.5,
	accepted: [ 'by' ]
})

// (followers) of (mine)
this.possessor = new g.Symbol(prepStr, 'possessor')
this.possessor.addWord({
	insertionCost: 0.5,
	accepted: [ 'of' ]
})

// (repos) of (mine)
// Same as [prep-possessor], without insertion cost
this.possessorSpecial = new g.Symbol(prepStr, 'possessor', 'special')
this.possessorSpecial.addWord({
	accepted: [ 'of' ]
})

// (issues) with (n comments)
	insertionCost: 0.5,
	accepted: [ 'with' ],
	substitutions: [ 'have|having|containing' ]
})

// (issues with n) to (i comments)
this.end = new g.Symbol(prepStr, 'end')
this.end.addWord({
	insertionCost: 0.5,
	accepted: [ 'to' ]
})

this.possessed = new g.Symbol(prepStr, 'possessed')
this.possessed.addWord({
// (issues with) between (n and i comments)
this.between = new g.Symbol(prepStr, 'between')
this.between.addWord({
	insertionCost: 2,
	accepted: [ 'between' ]
})

// (issues with) over (n comments)
this.over = new g.Symbol(prepStr, 'over')
this.over.addWord({
	insertionCost: 0.5,
	accepted: [ 'over', 'above|beyond', 'more than', '>' ]
})

// (issues with) under (n comments)
this.under = new g.Symbol(prepStr, 'under')
this.under.addWord({
	insertionCost: 0.5,
	accepted: [ 'under', 'below', 'less than', '<' ]
})