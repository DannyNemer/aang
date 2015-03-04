var g = require('../grammar')

// (people who) are (followed by me)
this.beNon1Sg = g.addWord({
	name: 'be-non-1sg',
	insertionCost: 1,
	accepted: [ 'are' ],
	substitutions: [ 'is|are|be being', 'being|been' ]
})

// (people who have) been (followed by me)
this.bePast = g.addWord({
	name: 'be-past',
	insertionCost: 1,
	accepted: [ 'been' ]
})

// (people who) have (been followed by me)
this.have = g.addWord({
	name: 'have',
	insertionCost: 0.8,
	accepted: [ 'have' ]
})