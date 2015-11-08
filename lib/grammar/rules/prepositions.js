var g = require('../grammar')

var prepStr = 'prep'

// (people followed) by (me)
exports.agent = g.newSymbol(prepStr, 'agent').addWord({
	insertionCost: 0.5,
	accepted: [ 'by' ],
})

// (followers) of (mine)
exports.possessor = g.newSymbol(prepStr, 'possessor').addWord({
	insertionCost: 0.5,
	accepted: [ 'of' ],
})

// (likers) of ([repositories+])
exports.participant = g.newSymbol(prepStr, 'participant').addWord({
	insertionCost: 0.5,
	accepted: [ 'of' ],
})

// (contributors) to {[repositories+]}
exports.receiver = g.newSymbol(prepStr, 'receiver').addWord({
	insertionCost: 0.5,
	accepted: [ 'to', 'of' ],
})

// (followers {user} shares) with (me)
exports.associative = g.newSymbol(prepStr, 'associative').addWord({
	insertionCost: 0.5,
	accepted: [ 'with' ],
})

// (repos wrriten) in ({language})
exports.language = g.newSymbol(prepStr, 'language').addWord({
	insertionCost: 0.5,
	accepted: [ 'in' ],
	substitutions: [ 'with', 'using' ]
})

// (repos created) in ([year])
exports.container = g.newSymbol(prepStr, 'container').addWord({
	insertionCost: 0.5,
	accepted: [ 'in', 'within', 'during' ],
	substitutions: [ 'on' ],
})

// (repos created) on ([month] [day] [year])
exports.surface = g.newSymbol(prepStr, 'surface').addWord({
	insertionCost: 0.5,
	accepted: [ 'on' ],
	substitutions: [ 'in', 'within', 'during' ],
})

// (repos created) before ([year])
exports.before = g.newSymbol(prepStr, 'before').addWord({
	insertionCost: 0.5,
	accepted: [ 'before', 'until', 'earlier than', 'prior|up to', '<' ],
	substitutions: [
		{ symbol: 'after', costPenalty: 1 },
	],
})

// (repos created) after ([year])
exports.after = g.newSymbol(prepStr, 'after').addWord({
	insertionCost: 1,
	accepted: [ 'after', 'since', 'later than', 'subsequent to', '>' ],
	substitutions: [
		{ symbol: 'before', costPenalty: 1 },
	],
})

// (repos created) from ([year] to [year])
exports.start = g.newSymbol(prepStr, 'start').addWord({
	insertionCost: 0.8,
	accepted: [ 'from' ],
	substitutions: [ 'in' ],
})

// (repos created from [year]) to ([year])
// (issues with <int>) to (<int> comments)
exports.end = g.newSymbol(prepStr, 'end').addWord({
	insertionCost: 0.5,
	accepted: [ 'to' ],
})

// (issues) with (<int> comments)
exports.possessed = g.newSymbol(prepStr, 'possessed').addWord({
	insertionCost: 0.5,
	accepted: [ 'with' ],
	substitutions: [ 'have|having|containing' ],
})

// (issues with) between (<int> and <int> comments)
exports.between = g.newSymbol(prepStr, 'between').addWord({
	insertionCost: 2,
	accepted: [ 'between' ],
})

// (issues with) over (<int> comments)
exports.over = g.newSymbol(prepStr, 'over').addWord({
	insertionCost: 0.5,
	accepted: [ 'over', 'above|beyond', 'greater|more than', '>' ],
})

// (issues with) under (<int> comments)
exports.under = g.newSymbol(prepStr, 'under').addWord({
	insertionCost: 0.5,
	accepted: [ 'under', 'below', 'fewer|less than', '<' ],
})