var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')
var auxVerbs = require('../auxVerbs')

var pullRequest = new Category({ sg: 'pull-request', pl: 'pull-requests' })

var pullRequestsTerm = g.addWord({
	name: pullRequest.namePl + '-term',
	insertionCost: 3.9,
	accepted: [ 'pull requests' ]
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
user.subjFilter.addRule({ RHS: [ auxVerbs.have, createdPullRequests ], personNumber: 'oneOrPl' })