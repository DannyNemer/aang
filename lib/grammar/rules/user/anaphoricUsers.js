var g = require('../../grammar')
var user = require('./user')
var poss = require('./poss')
var followers = require('./followers')
var conjunctions = require('../conjunctions')

var anphoricUsers = g.newSymbol('anaphoric', user.namePl)

// Special semantic that instructs `semantic.reduce()` to copy the antecedent semantic.
var followersAnaphoricSemantic = [ {
	semantic: followers.semantic[0].semantic,
	children: [],
	anaphoric: true,
} ]

// The anaphor.
var userAndHisOrHer = g.newBinaryRule({
	rhs: [
		[ user.catSg, conjunctions.and ],
		g.newSymbol('his', 'or', 'her').addWord({ accepted: [ 'his', 'her' ] }),
	],
})

// The anaphor.
var userPluralAndTheir = g.newBinaryRule({
	rhs: [
		[ user.plural, conjunctions.and ],
		g.newSymbol('their').addWord({ accepted: [ 'their' ] }),
	],
})

var followersHeadUserRHS = g.newBinaryRule({ rhs: [ followers.possessable, user.rhs ] })
// {user} and his/her female followers I follow
anphoricUsers.addRule({
	rhs: [ userAndHisOrHer, followersHeadUserRHS ],
	semantic: followersAnaphoricSemantic,
})
// my followers and their female followers I follow
anphoricUsers.addRule({
	rhs: [ userPluralAndTheir, followersHeadUserRHS ],
	semantic: followersAnaphoricSemantic,
})

var followersHeadRelativeClause = g.newBinaryRule({ rhs: [ followers.possessable, user.relativeClause ] })
// {user} and his/her female followers who I follow
anphoricUsers.addRule({
	rhs: [ userAndHisOrHer, followersHeadRelativeClause ],
	semantic: followersAnaphoricSemantic,
})
// my followers and their female followers who I follow
anphoricUsers.addRule({
	rhs: [ userPluralAndTheir, followersHeadRelativeClause ],
	semantic: followersAnaphoricSemantic,
})

// (people who follow) {user} and his/her followers
user.objUsersPlus.addRule({ rhs: [ anphoricUsers	] })
// (people) {user} and his/her followers (follow)
user.nomUsersPlus.addRule({ rhs: [ anphoricUsers ], personNumber: 'pl' })
// (followers) {user} and his/her followers (have in common)
user.nomUsersPluralSubj.addRule({ rhs: [ anphoricUsers ], personNumber: 'pl' })
// (followers of) {user} and his/her followers
poss.usersPlus.addRule({ rhs: [ anphoricUsers ] })