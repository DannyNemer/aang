var g = require('../grammar')
var user = require('./user')
var stopwords = require('./stopWords')
var poss = require('./poss')

var follow = g.addVerb({
	name: 'follow',
	oneOrPl: [ 'follow', 'subscribe to' ],
	threeSg: [ 'follows' ],
	past: [ 'followed' ],
	substitutions: [
		'have followed',
		'following',
		'have|has|had been following',
		'am|is|are|were|was|be following',
		'subscribed to'
	]
})

// (people) followed by me
user.passive.addRule({ RHS: [ follow, user.byObjUsers ], verbForm: 'past' })
// (people) I follow
var stopwordFollow = new g.Symbol('stopword', 'follow')
stopwordFollow.addRule({ RHS: [ stopwords.preVerbStopwords, follow ] })
user.objFilter.addRule({ RHS: [ user.nomUsersPlus, stopwordFollow ] })
// (people who) follow me
user.subjFilter.addRule({ RHS: [ follow, user.objUsersPlus ], personNumber: 'oneOrPl' })



var followersTerm = g.addWord({
	name: 'followers-term',
	accepted: [ 'followers' ]
})

// (my) followers; followers (of mine)
var userFollowersHead = new g.Symbol(user.nameSg, 'followers', 'head')
userFollowersHead.addRule({ RHS: [ user.github, followersTerm ] })

// (my) followers
var userFollowersPossessible = new g.Symbol(user.nameSg, 'followers', 'possessible')
userFollowersPossessible.addRule({ RHS: [ user.lhs, userFollowersHead ] })
// my followers
user.noRelativePossessive.addRule({ RHS: [ poss.determinerOmissible, userFollowersPossessible ] })

// followers of mine
user.head.addRule({ RHS: [ userFollowersHead, poss.ofPossUsers ] })