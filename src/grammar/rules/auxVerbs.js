var g = require('../grammar')
var stopWords = require('./stopWords')

// (people who) are (followed by me)
this.beNon1Sg = g.addWord({
	symbol: new g.Symbol('be', 'non', '1', 'sg'),
	insertionCost: 1,
	accepted: [ 'are', 'were' ],
	substitutions: [ 'is|are|be being', 'being|been' ]
})

// (issues that are) <stop> (open/closed)
// (people who are) <stop> (followed by me)
this.beNon1SgSentenceAdverbial = new g.Symbol('be', 'non', '1', 'sg', 'sentence', 'adverbial')
this.beNon1SgSentenceAdverbial.addRule({ RHS: [ this.beNon1Sg, stopWords.sentenceAdverbial ] })

// (people who have) been (followed by me)
this.bePast = g.addWord({
	symbol: new g.Symbol('be', 'past'),
	insertionCost: 1,
	accepted: [ 'been' ]
})

// (pull requests I/{user}/[nom-users]) am/is/are (mentioned in)
this.beGeneral = g.addVerb({
	name: 'be-general',
	insertionCost: 1,
	one: [ 'am' ],
	pl: [ 'are', 'were' ],
	oneOrPl: [ 'have-been' ],
	threeSg: [ 'is', 'has-been' ],
	oneOrThreeSg: [ 'was' ],
	singleSymbol: true
})


// No past tense ('had') because it implies semantic no longer true; "had liked" -> no longer liked
var have = g.addVerb({
	name: 'have',
	insertionCost: 0.8,
	oneOrPl: [ 'have' ],
	threeSg: [ 'has' ],
	substitutions: [ 'had' ]
})

// (repos I) have (liked)
this.haveVerb = have.verb
// (people who) have (been followed by me)
this.havePlSubj = have.plSubj

// (repos I) have <stop> (contributed to)
this.haveVerbPreVerbStopWords = new g.Symbol('have', 'verb', 'pre', 'verb', 'stop', 'words')
this.haveVerbPreVerbStopWords.addRule({ RHS: [ this.haveVerb, stopWords.preVerb ] })

// (people who have) <stop> (been folllowed by me); (people who have) <stop> (been following me)
var havePlSubjSentenceAdverbial = new g.Symbol('have', 'pl', 'subj', 'sentence', 'adverbial')
havePlSubjSentenceAdverbial.addRule({ RHS: [ this.havePlSubj, stopWords.sentenceAdverbial ] })
this.havePlSubjSentenceAdverbialBePast = new g.Symbol('have', 'pl', 'subj', 'sentence', 'adverbial', 'be', 'past')
this.havePlSubjSentenceAdverbialBePast.addRule({ RHS: [ havePlSubjSentenceAdverbial, this.bePast ] })


// NEGATION:
this.notSemantic = new g.Semantic({ name: 'not', cost: 0.5, minParams: 1, maxParams: 1 })
var negation = g.addWord({
	symbol: new g.Symbol('negation'),
	accepted: [ 'not' ],
	substitutions: [ 'are|can|could|did|does|do|had|has|have|is|should|was|were|will|would not' ]
})

// (people who) do not (follow me)
var doTerm = g.addWord({
	symbol: new g.Symbol('do'),
	insertionCost: 0.2,
	accepted: [ 'do' ],
	substitutions: [ 'did', 'does' ]
})
this.doNegation = new g.Symbol('do', 'negation')
this.doNegation.addRule({ RHS: [ doTerm, negation ] })

// (people who) are not followers of mine
// (issues that) are not (open)
// (people who) are not (follwed by me)
this.beNon1SgNegation = new g.Symbol('be', 'non', '1', 'sg', 'negation')
this.beNon1SgNegation.addRule({ RHS: [ this.beNon1Sg, negation ] })

// (people who) have not been (follwed by me)
var havePlSubjNegation = new g.Symbol('have', 'pl', 'subj', 'negation')
havePlSubjNegation.addRule({ RHS: [ this.havePlSubj, negation ] })
this.havePlSubjNegationBePast = new g.Symbol('have', 'pl', 'subj', 'negation', 'be', 'past')
this.havePlSubjNegationBePast.addRule({ RHS: [ havePlSubjNegation, this.bePast ] })