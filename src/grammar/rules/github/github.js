var g = require('../../grammar')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')

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


// Load GitHub-specific rules:
require('./repository')
require('./pullRequest')