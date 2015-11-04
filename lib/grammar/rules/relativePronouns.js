var g = require('../grammar')


// (people) who (follow me)
exports.who = g.newSymbol('who').addWord({
	insertionCost: 0.1,
	accepted: [ 'who', 'that' ],
	substitutions: [ 'at|about|by|for|from|in|of|on|to|with that|what|when|where|which|who|whom|whose|why' ],
})

// (repos) that (are liked by me)
exports.that = g.newSymbol('that').addWord({
	insertionCost: 0.1,
	accepted: [ 'that', 'which' ],
	substitutions: [ 'at|about|by|for|from|in|of|on|to|with that|what|when|where|which|who|whom|whose|why' ],
})