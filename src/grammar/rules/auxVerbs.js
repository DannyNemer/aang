var g = require('../grammar')

// (people who) are (followed by me)
this.beNon1Sg = g.addWord({
	symbol: new g.Symbol('be', 'non', '1sg'),
	insertionCost: 1,
	accepted: [ 'are', 'were' ],
	substitutions: [ 'is|are|be being', 'being|been' ]
})

// (people who have) been (followed by me)
this.bePast = g.addWord({
	symbol: new g.Symbol('be', 'past'),
	insertionCost: 1,
	accepted: [ 'been' ]
})

// (pull requests I/{user}/[users]) am/is/are (mentioned in)
this.beGeneral = g.addVerb({
	symbol: new g.Symbol('be', 'general'),
	insertionCost: 1,
	one: [ 'am' ],
	pl: [ 'are', 'were' ],
	oneOrPl: [ 'have-been' ],
	threeSg: [ 'is', 'has-been' ],
	oneOrThreeSg: [ 'was' ]
})

// (people who) have (been followed by me)
// - No past tense ('had') because it implies semantic no longer true; "had liked" -> no longer liked
this.have = g.addVerb({
	symbol: new g.Symbol('have'),
	insertionCost: 0.8,
	oneOrPl: [ 'have' ],
	threeSg: [ 'has' ],
	substitutions: [ 'had' ]
})