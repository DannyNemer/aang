var g = require('../../grammar')
var Category = require('../Category')
var github = require('./github')
var poss = require('../poss')
var user = require('../user')


var pullRequest = new Category({ sg: 'pull-request', pl: 'pull-requests' })

var pullRequestsTerm = g.addWord({
	symbol: new g.Symbol(pullRequest.namePl, 'term'),
	insertionCost: 3.5,
	accepted: [ 'pull-requests' ]
})

// |Github pull requests (I created)
pullRequest.headMayPoss.addRule({ RHS: [ github.termOpt, pullRequestsTerm ] })


var pullRequestsCreatedSemantic = new g.Semantic({ name: pullRequest.namePl + '-created', cost: 0.5, minParams: 1, maxParams: 1, preventDups: true })
var pullRequestCreatorsSemantic = new g.Semantic({ name: pullRequest.nameSg + '-creators', cost: 0.5, minParams: 1, maxParams: 1 })

// my pull requests
pullRequest.noRelativePossessive.addRule({ RHS: [ poss.determiner, pullRequest.possessible ], semantic: pullRequestsCreatedSemantic })
// pull requests of mine
pullRequest.head.addRule({ RHS: [ pullRequest.headMayPoss, poss.ofPossUsersPlus ], semantic: pullRequestsCreatedSemantic })


// CREATED:
// (pull requests) created by me
pullRequest.passive.addRule({ RHS: [ github.created, user.byObjUsers ], semantic: pullRequestsCreatedSemantic })
// (pull requests) I <stop> created
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.created ], semantic: pullRequestsCreatedSemantic })
// (pull requests) I <stop> have created
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPreVerbStopWords, github.haveVerbCreated ], semantic: pullRequestsCreatedSemantic })
// (people who) created pull requests ...
user.subjFilter.addRule({ RHS: [ github.created, pullRequest.catPl ], semantic: pullRequestCreatorsSemantic })
// (people who) have created pull requests ... - not [pull-requests+] because 'by'
user.subjFilter.addRule({ RHS: [ github.havePlSubjCreated, pullRequest.catPl ], semantic: pullRequestCreatorsSemantic })
// creators of [pull-requests]
user.head.addRule({ RHS: [ github.creatorsOf, pullRequest.catPl ], semantic: pullRequestCreatorsSemantic })


// MENTION:
var pullRequestsMentionedSemantic = new g.Semantic({ name: pullRequest.namePl + '-mentioned', cost: 0.5, minParams: 1, maxParams: 1 })
// (pull requests that) mention me
pullRequest.subjFilter.addRule({ RHS: [ github.mention, user.objUsersPlus ], semantic: pullRequestsMentionedSemantic })
// (pull requests) I-am/{user}-is/[users]-are mentioned in
pullRequest.objFilter.addRule({ RHS: [ user.nomUsersPlus, github.preVerbStopWordsBeGeneralMentionedIn ], semantic: pullRequestsMentionedSemantic })
// (people mentioned in) [pull-requests]
github.mentioners.addRule({ RHS: [ pullRequest.catPl ] })