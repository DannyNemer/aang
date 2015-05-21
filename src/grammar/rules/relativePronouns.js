var g = require('../grammar')

// (people) who (follow me)
this.who = new g.Symbol('who')
this.who.addWord({
	insertionCost: 0.1,
	accepted: [ 'who', 'that' ]
})

// (repos) that (are liked by me)
this.that = new g.Symbol('that')
this.that.addWord({
	insertionCost: 0.1,
	accepted: [ 'that', 'which' ]
})