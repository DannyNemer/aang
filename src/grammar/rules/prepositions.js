var g = require('../grammar')

var prepStr = 'prep'

// (people followed) by (me)
exports.agent = g.newSymbol(prepStr, 'agent')
exports.agent.addWord({
	insertionCost: 0.5,
	accepted: [ 'by' ]
})

// (followers) of (mine)
exports.possessor = g.newSymbol(prepStr, 'possessor')
exports.possessor.addWord({
	insertionCost: 0.5,
	accepted: [ 'of' ]
})

// (repos) of (mine)
// Same as [prep-possessor], without insertion cost
exports.possessorSpecial = g.newSymbol(prepStr, 'possessor', 'special')
exports.possessorSpecial.addWord({
	accepted: [ 'of' ]
})

// (repos created) in ([year])
exports.container = g.newSymbol(prepStr, 'container')
exports.container.addWord({
	insertionCost: 0.5,
	accepted: [ 'in', 'within', 'during' ],
	substitutions: [ 'on' ]
})

// (repos created) on ([month] [day] [year])
exports.surface = g.newSymbol(prepStr, 'surface')
exports.surface.addWord({
	insertionCost: 0.5,
	accepted: [ 'on' ],
	substitutions: [ 'in', 'within', 'during' ]
})

// (repos created) before ([year])
exports.before = g.newSymbol(prepStr, 'before')
exports.before.addWord({
	insertionCost: 1,
	accepted: [ 'before', 'earlier than', 'prior|up to', '<' ]
})

// (repos created) after ([year])
exports.after = g.newSymbol(prepStr, 'after')
exports.after.addWord({
	insertionCost: 0.5,
	accepted: [ 'after', 'later than', 'subsequent to', '>' ]
})

// (repos created) from ([year] to [year])
exports.start = g.newSymbol(prepStr, 'start')
exports.start.addWord({
	insertionCost: 0.8,
	accepted: [ 'from' ],
	substitutions: [ 'in' ]
})

// (repos created from [year]) to ([year])
// (issues with <int>) to (<int> comments)
exports.end = g.newSymbol(prepStr, 'end')
exports.end.addWord({
	insertionCost: 0.5,
	accepted: [ 'to' ]
})

// (issues) with (<int> comments)
exports.possessed = g.newSymbol(prepStr, 'possessed')
exports.possessed.addWord({
	insertionCost: 0.5,
	accepted: [ 'with' ],
	substitutions: [ 'have|having|containing' ]
})

// (issues with) between (<int> and <int> comments)
exports.between = g.newSymbol(prepStr, 'between')
exports.between.addWord({
	insertionCost: 2,
	accepted: [ 'between' ]
})

// (issues with) over (<int> comments)
exports.over = g.newSymbol(prepStr, 'over')
exports.over.addWord({
	insertionCost: 0.5,
	accepted: [ 'over', 'above|beyond', 'more than', '>' ]
})

// (issues with) under (<int> comments)
exports.under = g.newSymbol(prepStr, 'under')
exports.under.addWord({
	insertionCost: 0.5,
	accepted: [ 'under', 'below', 'less than', '<' ]
})