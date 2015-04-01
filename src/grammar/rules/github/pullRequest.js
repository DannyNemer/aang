var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')
var stopWords = require('../stopWords')

var pullRequest = new Category({ sg: 'pull-request', pl: 'pull-requests' })

var pullRequestsTerm = g.addWord({
	name: pullRequest.namePl + '-term',
	insertionCost: 3.5,
	accepted: [ 'pull-requests' ]
})

// |Github pull requests (I created)
pullRequest.headMayPoss.addRule({ RHS: [ github.termOpt, pullRequestsTerm ] })


// my pull requests
pullRequest.noRelativePossessive.addRule({ RHS: [ poss.determiner, pullRequest.possessible ]})
// pull requests of mine
pullRequest.head.addRule({ RHS: [ pullRequest.headMayPoss, poss.ofPossUsers ] })


// CREATED:
// (pull requests) created by me
pullRequest.passive.addRule({ RHS: [ github.created, user.byObjUsers ] })
// (pull requests) I created
pullRequest.objFilter.addRule({ RHS: [ user.nomUsers, github.created ] })
// (pull requests) I have created
pullRequest.objFilter.addRule({ RHS: [ user.nomUsers, github.preVerbStopWordsHaveCreated ] })
// (people who) created pull requests ...
user.subjFilter.addRule({ RHS: [ github.created, pullRequest.catPl ] })
// (people who) have created pull requests ...
var createdPullRequests = new g.Symbol('created', pullRequest.namePl)
createdPullRequests.addRule({ RHS: [ github.created, pullRequest.catPl ] }) // not [pull-requests+] because 'by'
user.subjFilter.addRule({ RHS: [ auxVerbs.have, createdPullRequests ], personNumber: 'pl' })


// MENTION:
var mention = g.addWord({
	name: 'mention',
	accepted: [ 'mention' ]
})

// (pull requests that) mention me
pullRequest.subjFilter.addRule({ RHS: [ mention, user.objUsersPlus ] })

var mentionedIn = g.addWord({
	name: 'mentioned-in',
	insertionCost: 2,
	accepted: [ 'mentioned-in' ]
})

var beGeneralMentionedIn = new g.Symbol('be', 'general', 'mentioned', 'in')
beGeneralMentionedIn.addRule({ RHS: [ auxVerbs.beGeneral, mentionedIn ] })
var preVerbStopWordsBeGeneralMentionedIn = new g.Symbol('pre', 'verb', 'stop', 'words', 'be', 'general', 'mentioned', 'in')
preVerbStopWordsBeGeneralMentionedIn.addRule({ RHS: [ stopWords.preVerbStopWords, beGeneralMentionedIn ] })
// (pull requests) I-am/{user}-is/[users]-are mentioned in
pullRequest.objFilter.addRule({ RHS: [ user.nomUsers, preVerbStopWordsBeGeneralMentionedIn ] })

// (pull requests) I am mentioned in

// pull requests that mention me
// pull requests I am mentioned in
// pull requests where I am mentioned
// pull requests mentioning me
// pull requests that have mention of me

// people who follow me
// people who follow me

// photos that interest me
// [tag-verb]? posts tagged with me
// places I am tagged in