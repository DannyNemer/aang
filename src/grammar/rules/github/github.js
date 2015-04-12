var g = require('../../grammar')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var user = require('../user')
var conjunctions = require('../conjunctions.js')


var github = g.addWord({
	symbol: new g.Symbol('github'),
	accepted: [ 'GitHub' ]
})

// (my) |GitHub (repos)
this.termOpt = g.addNonterminalOpt(github)

// GitHub (users I follow)
user.company.addRule({ RHS: [ github ] })


this.created = g.addWord({
	symbol: new g.Symbol('created'),
	insertionCost: 0.5,
	accepted: [ 'created' ]
})

// (repos/pull-requests I) created
this.preVerbStopWordsCreated = new g.Symbol('pre', 'verb', 'stop', 'words', 'created')
this.preVerbStopWordsCreated.addRule({ RHS: [ stopWords.preVerbStopWords, this.created ] })

// (repos/pull-requests I) have created
var haveCreated = new g.Symbol('have', 'created')
haveCreated.addRule({ RHS: [ auxVerbs.have, this.created ] })
this.preVerbStopWordsHaveCreated = new g.Symbol('pre', 'verb', 'stop', 'words', 'have', 'created')
this.preVerbStopWordsHaveCreated.addRule({ RHS: [ stopWords.preVerbStopWords, haveCreated ] })

// creators of ([repositories]/[pull-requests])
this.creatorsOf = g.addWord({
	symbol: new g.Symbol('creators', 'of'),
	accepted: [ 'creators-of' ]
})


// (pull-requests/issues that) mention ([obj-users+])
this.mention = g.addWord({
	symbol: new g.Symbol('mention'),
	accepted: [ 'mention' ]
})

var mentionedIn = g.addWord({
	symbol: new g.Symbol('mentioned', 'in'),
	insertionCost: 2,
	accepted: [ 'mentioned-in' ]
})

// (pull-requests/issues) I-am/{user}-is/[users]-are mentioned in
var beGeneralMentionedIn = new g.Symbol('be', 'general', 'mentioned', 'in')
beGeneralMentionedIn.addRule({ RHS: [ auxVerbs.beGeneral, mentionedIn ] })
this.preVerbStopWordsBeGeneralMentionedIn = new g.Symbol('pre', 'verb', 'stop', 'words', 'be', 'general', 'mentioned', 'in')
this.preVerbStopWordsBeGeneralMentionedIn.addRule({ RHS: [ stopWords.preVerbStopWords, beGeneralMentionedIn ] })


var usersMentionedSemantic = new g.Semantic({ name: user.namePl + '-mentioned', cost: 0.5, minParams: 1, maxParams: 1 })
// (people mentioned) in [issues]/[pull-request]
this.mentioners = new g.Symbol('mentioners')
// (people mentioned) in [issues]/[pull-request] and/or [issues]/[pull-request]
var mentionersPlus = conjunctions.addForSymbol(this.mentioners)
// (people) mentioned in [mentioners+]; (people who are) mentioned in [mentioners+]
user.inner.addRule({ RHS: [ mentionedIn, mentionersPlus ], semantic: usersMentionedSemantic })


// Load GitHub-specific rules:
require('./repository')
require('./pullRequest')
require('./issue')