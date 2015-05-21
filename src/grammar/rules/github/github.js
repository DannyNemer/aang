var g = require('../../grammar')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var user = require('../user')
var conjunctions = require('../conjunctions.js')


var github = new g.Symbol('github')
github.addWord({
	accepted: [ 'GitHub' ]
})

// (my) |GitHub (repos)
this.termOpt = github.createNonterminalOpt()

// GitHub (users I follow); (my) GitHub (followers)
user.company.addRule({ RHS: [ github ] })


this.created = new g.Symbol('created')
this.created.addWord({
	insertionCost: 0.5,
	accepted: [ 'created' ]
})

// (repos/pull-requests I) created
this.preVerbStopWordsCreated = new g.Symbol('pre', 'verb', 'stop', 'words', 'created')
this.preVerbStopWordsCreated.addRule({ RHS: [ stopWords.preVerb, this.created ] })

// (repos/pull-requests I) have created
// (people who) have created ([repos]/[pull-requests])
this.haveCreated = new g.Symbol('have', 'created')
this.haveCreated.addRule({ RHS: [ auxVerbs.have, this.created ] })

// creators of ([repositories]/[pull-requests])
this.creatorsOf = new g.Symbol('creators', 'of')
this.creatorsOf.addWord({
	accepted: [ 'creators of' ]
})


// (pull-requests/issues that) mention ([obj-users+])
this.mention = new g.Symbol('mention')
this.mention.addWord({
	accepted: [ 'mention' ]
})

var mentionedIn = new g.Symbol('mentioned', 'in')
mentionedIn.addWord({
	insertionCost: 2,
	accepted: [ 'mentioned in' ]
})

// (pull-requests/issues) I-am/{user}-is/[users]-are mentioned in
var beGeneralMentionedIn = new g.Symbol('be', 'general', 'mentioned', 'in')
beGeneralMentionedIn.addRule({ RHS: [ auxVerbs.beGeneral, mentionedIn ] })
this.preVerbStopWordsBeGeneralMentionedIn = new g.Symbol('pre', 'verb', 'stop', 'words', 'be', 'general', 'mentioned', 'in')
this.preVerbStopWordsBeGeneralMentionedIn.addRule({ RHS: [ stopWords.preVerb, beGeneralMentionedIn ] })


var usersMentionedSemantic = g.newSemantic({ name: user.namePl + '-mentioned', cost: 0.5, minParams: 1, maxParams: 1 })
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