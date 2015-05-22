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

// (repos created) in ([year])
this.container = new g.Symbol(prepStr, 'container')
this.container.addWord({
	insertionCost: 0.5,
	accepted: [ 'in', 'within', 'during' ],
	substitutions: [ 'on' ]
})

// (repos created) on ([month] [day] [year])
this.surface = new g.Symbol(prepStr, 'surface')
this.surface.addWord({
	insertionCost: 0.5,
	accepted: [ 'on' ],
	substitutions: [ 'in', 'within', 'during' ]
})

// (repos created) before ([year])
this.before = new g.Symbol(prepStr, 'before')
this.before.addWord({
	insertionCost: 1,
	accepted: [ 'before', 'earlier than', 'prior|up to', '<' ]
})

// (repos created) after ([year])
this.after = new g.Symbol(prepStr, 'after')
this.after.addWord({
	insertionCost: 0.5,
	accepted: [ 'after', 'later than', 'subsequent to', '>' ]
})

// (repos created) from ([year] to [year])
this.start = new g.Symbol(prepStr, 'start')
this.start.addWord({
	insertionCost: 0.8,
	accepted: [ 'from' ],
	substitutions: [ 'in' ]
})

// (repos created from [year]) to ([year])
// (issues with <int>) to (<int> comments)
this.end = new g.Symbol(prepStr, 'end')
this.end.addWord({
	insertionCost: 0.5,
	accepted: [ 'to' ]
})

// (issues) with (<int> comments)
this.possessed = new g.Symbol(prepStr, 'possessed')
this.possessed.addWord({
	insertionCost: 0.5,
	accepted: [ 'with' ],
	substitutions: [ 'have|having|containing' ]
})

// (issues with) between (<int> and <int> comments)
this.between = new g.Symbol(prepStr, 'between')
this.between.addWord({
	insertionCost: 2,
	accepted: [ 'between' ]
})

// (issues with) over (<int> comments)
this.over = new g.Symbol(prepStr, 'over')
this.over.addWord({
	insertionCost: 0.5,
	accepted: [ 'over', 'above|beyond', 'more than', '>' ]
})

// (issues with) under (<int> comments)
this.under = new g.Symbol(prepStr, 'under')
this.under.addWord({
	insertionCost: 0.5,
	accepted: [ 'under', 'below', 'less than', '<' ]
})