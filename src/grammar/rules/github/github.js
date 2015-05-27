var g = require('../../grammar')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')
var user = require('../user')
var conjunctions = require('../conjunctions.js')


var github = g.newSymbol('github')
github.addWord({
	accepted: [ 'GitHub' ]
})

// (my) |GitHub (repos)
exports.termOpt = github.createNonterminalOpt()

// GitHub (users I follow); (my) GitHub (followers)
user.company.addRule({ RHS: [ github ] })


exports.created = g.newSymbol('created')
exports.created.addWord({
	insertionCost: 0.5,
	accepted: [ 'created' ]
})

// (repos/pull-requests I) have created
// (people who) have created ([repos]/[pull-requests])
exports.haveCreated = g.newSymbol('have', 'created')
exports.haveCreated.addRule({ RHS: [ auxVerbs.have, exports.created ] })

// creators of ([repositories]/[pull-requests])
exports.creatorsOf = g.newSymbol('creators', 'of')
exports.creatorsOf.addWord({
	accepted: [ 'creators of' ]
})


// (pull-requests/issues that) mention ([obj-users+])
exports.mention = g.newSymbol('mention')
exports.mention.addWord({
	accepted: [ 'mention' ]
})

var mentionedIn = g.newSymbol('mentioned', 'in')
mentionedIn.addWord({
	insertionCost: 2,
	accepted: [ 'mentioned in' ]
})

// (pull-requests/issues) I-am/{user}-is/[users]-are mentioned in
var beGeneralMentionedIn = g.newSymbol('be', 'general', 'mentioned', 'in')
beGeneralMentionedIn.addRule({ RHS: [ auxVerbs.beGeneral, mentionedIn ] })
exports.preVerbStopWordsBeGeneralMentionedIn = g.newSymbol('pre', 'verb', 'stop', 'words', 'be', 'general', 'mentioned', 'in')
exports.preVerbStopWordsBeGeneralMentionedIn.addRule({ RHS: [ stopWords.preVerb, beGeneralMentionedIn ] })


var usersMentionedSemantic = g.newSemantic({ name: user.namePl + '-mentioned', cost: 0.5, minParams: 1, maxParams: 1 })
// (people mentioned) in [issues]/[pull-request]
exports.mentioners = g.newSymbol('mentioners')
// (people mentioned) in [issues]/[pull-request] and/or [issues]/[pull-request]
var mentionersPlus = conjunctions.addForSymbol(exports.mentioners)
// (people) mentioned in [mentioners+]; (people who are) mentioned in [mentioners+]
user.inner.addRule({ RHS: [ mentionedIn, mentionersPlus ], semantic: usersMentionedSemantic })


// Load GitHub-specific rules:
require('./repository')
require('./pullRequest')
require('./issue')