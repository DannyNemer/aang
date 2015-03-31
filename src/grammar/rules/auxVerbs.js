var g = require('../grammar')

// (people who) are (followed by me)
this.beNon1Sg = g.addWord({
	name: 'be-non-1sg',
	insertionCost: 1,
	accepted: [ 'are', 'were' ],
	substitutions: [ 'is|are|be being', 'being|been' ]
})

// (people who have) been (followed by me)
this.bePast = g.addWord({
	name: 'be-past',
	insertionCost: 1,
	accepted: [ 'been' ]
})

// (people who) have (been followed by me)
// - No past tense ('had') because it implies semantic no longer true; "had liked" -> no longer liked
this.have = g.addVerb({
	name: 'have',
	insertionCost: 0.8,
	oneOrPl: [ 'have' ],
	threeSg: [ 'has' ],
	substitutions: [ 'had' ]
})