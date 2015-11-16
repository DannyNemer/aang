var g = require('../grammar')

var prepStr = 'prep'

var prepCommonSubtitution = g.newSymbol(prepStr, 'common', 'substitution').addBlankSet({
	terms: [ 'aboard', 'above', 'absent', 'across', 'afore', 'after', 'against', 'along', 'alongside', 'amid', 'amidst', 'among', 'amongst', 'around', 'aside', 'astride', 'athwart', 'atop', 'barring', 'before', 'behind', 'below', 'beneath', 'beside', 'besides', 'between', 'betwixt', 'beyond', 'but', 'despite', 'down', 'during', 'except', 'excluding', 'failing', 'following', 'given', 'including', 'inside', 'into', 'lest', 'like', 'minus', 'modulo', 'near', 'next', 'notwithstanding', 'off', 'onto', 'opposite', 'out', 'outside', 'over', 'pace', 'past', 'per', 'plus', 'pro', 'qua', 'sans', 'save', 'since', 'than', 'through', 'thru', 'throughout', 'thruout', 'till', 'times', 'toward', 'towards', 'under', 'underneath', 'unlike', 'until', 'unto', 'up', 'upon', 'versus', 'vs', 'via', 'with', 'within', 'without', 'worth' ],
})

// (people followed) by (me)
exports.agent = g.newSymbol(prepStr, 'agent').addWord({
	insertionCost: 0.5,
	accepted: [ 'by' ],
	substitutions: [
		{ symbol: g.newSymbol('from', 'substitution').addBlankSet({
			terms: [ 'from', 'via' ],
		}), costPenalty: 1 },
		{ symbol: 'of', costPenalty: 0.5 },
		{ symbol: g.newSymbol(prepStr, 'agent', 'substitution').addBlankSet({
			terms: [ 'aboard', 'above', 'absent', 'across', 'afore', 'after', 'against', 'along', 'alongside', 'amid', 'amidst', 'among', 'amongst', 'around', 'aside', 'astride', 'at', 'athwart', 'atop', 'barring', 'before', 'behind', 'below', 'beneath', 'beside', 'besides', 'between', 'betwixt', 'beyond', 'but', 'by', 'despite', 'down', 'during', 'except', 'excluding', 'failing', 'following', 'for', 'from', 'given', 'in', 'including', 'inside', 'into', 'lest', 'like', 'minus', 'modulo', 'near', 'next', 'notwithstanding', 'of', 'off', 'on', 'onto', 'opposite', 'out', 'outside', 'over', 'pace', 'past', 'per', 'plus', 'pro', 'qua', 'sans', 'save', 'since', 'than', 'through', 'thru', 'throughout', 'thruout', 'till', 'times', 'to', 'toward', 'towards', 'under', 'underneath', 'unlike', 'until', 'unto', 'up', 'upon', 'versus', 'vs', 'via', 'with', 'within', 'without', 'worth' ],
		}), costPenalty: 3 },
	],
})

// (followers) of (mine)
exports.possessor = g.newSymbol(prepStr, 'possessor').addWord({
	insertionCost: 0.5,
	accepted: [ 'of' ],
	substitutions: [
		{ symbol: 'with', costPenalty: 1 },
		{ symbol: 'to', costPenalty: 1 },
		{ symbol: prepCommonSubtitution, costPenalty: 2 },
	],
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
	substitutions: [
		{ symbol: g.newSymbol('alongside', 'substitution').addBlankSet({
			terms: [ 'alongside', 'of', 'to' ],
		}), costPenalty: 1 },
		{ symbol: g.newSymbol(prepStr, 'associative', 'substitution').addBlankSet({
			terms: [ 'aboard', 'above', 'absent', 'across', 'afore', 'after', 'against', 'along', 'alongside', 'amid', 'amidst', 'among', 'amongst', 'around', 'aside', 'astride', 'at', 'athwart', 'atop', 'barring', 'before', 'behind', 'below', 'beneath', 'beside', 'besides', 'between', 'betwixt', 'beyond', 'but', 'despite', 'down', 'during', 'except', 'excluding', 'failing', 'following', 'for', 'from', 'given', 'in', 'including', 'inside', 'into', 'lest', 'like', 'minus', 'modulo', 'near', 'next', 'notwithstanding', 'of', 'off', 'on', 'onto', 'opposite', 'out', 'outside', 'over', 'pace', 'past', 'per', 'plus', 'pro', 'qua', 'sans', 'save', 'since', 'than', 'through', 'thru', 'throughout', 'thruout', 'till', 'times', 'to', 'toward', 'towards', 'under', 'underneath', 'unlike', 'until', 'unto', 'up', 'upon', 'versus', 'vs', 'via', 'with', 'within', 'without', 'worth' ],
		}), costPenalty: 3 },
	],
})

// (repos wrriten) in ({language})
exports.language = g.newSymbol(prepStr, 'language').addWord({
	insertionCost: 0.5,
	accepted: [ 'in' ],
	substitutions: [
		{ symbol: 'with', costPenalty: 0.5 },
		{ symbol: 'using', costPenalty: 0.5 },
	],
})

// (repos created) in ([year])
exports.container = g.newSymbol(prepStr, 'container').addWord({
	insertionCost: 0.5,
	accepted: [ 'in', 'within', 'during' ],
	substitutions: [
		{ symbol: 'on', costPenalty: 0.8 },
		{ symbol: 'from', costPenalty: 0.8 },
		{ symbol: 'of', costPenalty: 1 },
		{ symbol: [
			g.newSymbol('inside', 'substitution').addBlankSet({ terms: [ 'inside' ] }),
			g.newSymbol('of', 'opt', 'substitution').addBlankSet({ optional: true, terms: [ 'of' ] }),
		], costPenalty: 1 },
		{ symbol: 'into', costPenalty: 1 },
		{ symbol: g.newSymbol(prepStr, 'container', 'substitution').addBlankSet({
			terms: [ 'aboard', 'about', 'above', 'absent', 'across', 'afore', 'after', 'against', 'along', 'alongside', 'amid', 'amidst', 'among', 'amongst', 'around', 'aside', 'astride', 'at', 'athwart', 'atop', 'barring', 'before', 'behind', 'below', 'beneath', 'beside', 'besides', 'between', 'betwixt', 'beyond', 'but', 'by', 'despite', 'down', 'during', 'except', 'excluding', 'failing', 'following', 'for', 'from', 'given', 'in', 'including', 'inside', 'into', 'lest', 'like', 'minus', 'modulo', 'near', 'notwithstanding', 'off', 'on', 'onto', 'opposite', 'out', 'outside', 'over', 'pace', 'past', 'per', 'plus', 'pro', 'qua', 'sans', 'save', 'since', 'than', 'through', 'thru', 'throughout', 'thruout', 'till', 'times', 'to', 'toward', 'towards', 'under', 'underneath', 'unlike', 'until', 'unto', 'up', 'upon', 'versus', 'vs', 'via', 'with', 'within', 'without', 'worth' ],
		}), costPenalty: 2 },
	],
})

// (repos created) on ([month] [day] [year])
exports.day = g.newSymbol(prepStr, 'day').addWord({
	insertionCost: 0.5,
	accepted: [ 'on' ],
	substitutions: [
		{ symbol: 'in', costPenalty: 0.5 },
		{ symbol: 'within', costPenalty: 0.5 },
		{ symbol: 'during', costPenalty: 0.5 },
	],
})

// (repos created) before ([year])
exports.before = g.newSymbol(prepStr, 'before').addWord({
	insertionCost: 0.5,
	accepted: [ 'before', 'until', 'earlier than', 'prior|up to', '<' ],
	substitutions: [
		{ symbol: prepCommonSubtitution, costPenalty: 2 },
	],
})

// (repos created) after ([year])
exports.after = g.newSymbol(prepStr, 'after').addWord({
	insertionCost: 1,
	accepted: [ 'after', 'since', 'later than', 'subsequent to', '>' ],
	substitutions: [
		{ symbol: prepCommonSubtitution, costPenalty: 2 },
	],
})

// (repos created) from ([year] to [year])
exports.start = g.newSymbol(prepStr, 'start').addWord({
	insertionCost: 0.8,
	accepted: [ 'from' ],
	substitutions: [
		{ symbol: 'in', costPenalty: 1 },
		{ symbol: prepCommonSubtitution, costPenalty: 2 },
	],
})

// (repos created from [year]) to ([year])
// (issues with <int>) to (<int> comments)
exports.end = g.newSymbol(prepStr, 'end').addWord({
	insertionCost: 0.5,
	accepted: [ 'to' ],
	substitutions: [
		{ symbol: prepCommonSubtitution, costPenalty: 2 },
	],
})

// (issues) with (<int> comments)
exports.possessed = g.newSymbol(prepStr, 'possessed').addWord({
	insertionCost: 0.5,
	accepted: [ 'with' ],
	substitutions: [
		{ symbol: g.newSymbol('have', 'substitution').addBlankSet({
			terms: [ 'have', 'having', 'containing' ],
		}), costPenalty: 1 },
		{ symbol: prepCommonSubtitution, costPenalty: 2 },
	],
})

// (issues with) between (<int> and <int> comments)
exports.between = g.newSymbol(prepStr, 'between').addWord({
	insertionCost: 2,
	accepted: [ 'between' ],
	substitutions: [
		{ symbol: g.newSymbol(prepStr, 'between', 'substitution').addBlankSet({
			terms: [ 'aboard', 'above', 'absent', 'across', 'afore', 'after', 'against', 'along', 'alongside', 'amid', 'amidst', 'among', 'amongst', 'around', 'aside', 'astride', 'athwart', 'atop', 'barring', 'before', 'behind', 'below', 'beneath', 'beside', 'besides', 'between', 'betwixt', 'beyond', 'but', 'despite', 'down', 'during', 'except', 'excluding', 'failing', 'following', 'from', 'given', 'including', 'inside', 'into', 'lest', 'like', 'minus', 'modulo', 'near', 'next', 'notwithstanding', 'off', 'onto', 'opposite', 'out', 'outside', 'over', 'pace', 'past', 'per', 'plus', 'pro', 'qua', 'sans', 'save', 'since', 'than', 'through', 'thru', 'throughout', 'thruout', 'till', 'times', 'toward', 'towards', 'under', 'underneath', 'unlike', 'until', 'unto', 'up', 'upon', 'versus', 'vs', 'via', 'with', 'within', 'without', 'worth' ],
		}), costPenalty: 2 },
	],
})

// (issues with) over (<int> comments)
exports.over = g.newSymbol(prepStr, 'over').addWord({
	insertionCost: 0.5,
	accepted: [ 'over', 'above|beyond', 'greater|more than', '>' ],
	substitutions: [
		{ symbol: prepCommonSubtitution, costPenalty: 2 }
	],
})

// (issues with) under (<int> comments)
exports.under = g.newSymbol(prepStr, 'under').addWord({
	insertionCost: 0.5,
	accepted: [ 'under', 'below', 'fewer|less than', '<' ],
	substitutions: [
		{ symbol: prepCommonSubtitution, costPenalty: 2 }
	],
})