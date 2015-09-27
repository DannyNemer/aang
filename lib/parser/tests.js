/**
 * Queries to test speed and various cases.
 *
 * If `test.exactMatch` is `true`, then check that the first result's display text is identical to `test.query`. Else, check that the first result's display text is different from `test.query` (i.e., parse edits occurred).
 *
 * @type Object[]
 */
module.exports = [
	{
		query: 'repos I have liked',
		exactMatch: true,
	}, {
		query: 'repos created by me and my followers',
		exactMatch: false,
	}, {
		query: 'repos I and my followers created',
		exactMatch: false,
	}, {
		query: 'people who like my repos liked by people who follow people I follow',
		exactMatch: true,
	}, {
		query: 'people who like repos',
		exactMatch: false,
	}, {
		query: 'repos been followers',
		exactMatch: false,
	}, {
		query: 'repos been followers people who like repos that I have',
		exactMatch: false,
	}, {
		query: 'repos people who like and created',
		exactMatch: false,
	}, {
		query: 'repos that have been created by people and like and I contributed to',
		exactMatch: false,
	}, {
		query: 'repos that are repos',
		exactMatch: false,
	}, {
		query: 'my followers who are my followers',
		exactMatch: false,
	}, {
		query: 'my followers who are followers of followers of mine',
		exactMatch: true,
	}, {
		query: 'my followers who are followers of followers of mine who liked that repos contributed to of mine',
		exactMatch: false,
	}, {
		query: 'repos',
		exactMatch: false,
	}, {
		query: 'people',
		exactMatch: false,
	}, {
		query: 'people who created my repos and my pull requests',
		exactMatch: false,
	}, {
		query: 'people pull requests like repos I like',
		exactMatch: false,
	}, {
		query: 'repos liked by followers of followers of mine',
		exactMatch: true,
	}, {
		query: 'repos liked by me and my followers',
		exactMatch: true,
	}, {
		query: 'repos liked by me and my followers and people who like JavaScript repos liked by me and my followers',
		exactMatch: true,
	}, {
		query: 'my repos that are JavaScript repos',
		exactMatch: true,
	}, {
		query: 'my JavaScript repos',
		exactMatch: true,
	}, {
		query: 'repos that are written in JavaScript',
		exactMatch: true,
	}, {
		// Should have some results
		query: 'my JavaScript repos that are written in JavaScript',
		exactMatch: false,
	}, {
		query: 'issues assigned to me I opened and am mentioned in',
		exactMatch: true,
	}, {
		query: 'people who are assigned to my issues and follow people who contributed to repos I created and are mentioned in pull requests of mine',
		exactMatch: true,
	}, {
		query: 'people who are mentioned in my issues and pull requests',
		exactMatch: true,
	}, {
		query: 'people who are assigned to my issues and my pull requests',
		exactMatch: true,
	}, {
		query: 'people mentioned in my issues and my pull requests',
		exactMatch: true,
	}, {
		query: 'my {left-stop-word} repos',
		exactMatch: false,
	}, {
		query: 'my {left-stop-word} JavaScript repos',
		exactMatch: false,
	}, {
		query: 'my JavaScript {left-stop-word} repos',
		exactMatch: false,
	}, {
		query: 'my {left-stop-word} JavaScript {left-stop-word} repos',
		exactMatch: false,
	}, {
		query: 'my {left-stop-word} {left-stop-word} repos',
		exactMatch: false,
	}, {
		query: 'open issues',
		exactMatch: true,
	}, {
		query: 'issues that are open',
		exactMatch: true,
	}, {
		query: 'people assigned to my closed issues',
		exactMatch: true,
	}, {
		query: 'contributors to my repos',
		exactMatch: true,
	}, {
		query: 'contributors to my repos and repos of mine',
		exactMatch: false,
	}, {
		query: 'likers of my repos',
		exactMatch: true,
	}, {
		query: 'creators of repos I like',
		exactMatch: true,
	}, {
		query: 'likers of repos I like and repos I contributed to',
		exactMatch: true,
	}, {
		query: 'creators of repos I like and repos I contributed to',
		exactMatch: true,
	}, {
		query: 'creators of repos I like and pull requests I am mentioned in',
		exactMatch: true,
	}, {
		query: 'openers of closed issues that mention people I and my followers follow',
		exactMatch: true,
	}, {
		query: 'people who are not followers of mine',
		exactMatch: true,
	}, {
		query: 'people who have not been followed by me',
		exactMatch: true,
	}, {
		query: 'issues that are not open',
		exactMatch: true,
	}, {
		query: 'people I do not follow',
		exactMatch: true,
	}, {
		query: 'people who follow me and do not follow Danny',
		exactMatch: true,
	}, {
		query: 'issues I am assigned to',
		exactMatch: true,
	}, {
		query: '{left-stop-word} open issues that are never assigned to people who {pre-filter-stop-word} follow me',
		exactMatch: false,
	}, {
		query: 'repos of people who follow me',
		exactMatch: true,
	}, {
		query: 'followers of mine and people who follow me',
		exactMatch: true,
	}, {
		query: 'repos of mine and people who follow me',
		exactMatch: false,
	}, {
		query: 'repos I like or my followers likes',
		exactMatch: false,
	}, {
		query: 'repos I or my followers likes',
		exactMatch: false,
	}, {
		query: 'repos created by people I follow and Danny follows',
		exactMatch: true,
	}, {
		query: 'repos created by people I and Danny follow',
		exactMatch: true,
	}, {
		query: 'people who follow people',
		exactMatch: false,
	}, {
		query: 'people followed by myself',
		exactMatch: false,
	}, {
		query: 'people who follow I',
		exactMatch: false,
	}, {
		query: 'people me follows',
		exactMatch: false,
	}, {
		query: 'openers of my closed issues that mention me people who follow me and my followers follow follow',
		exactMatch: true,
	}, {
		query: 'repos people my followers follow like',
		exactMatch: true,
	}, {
		query: 'people people Danny follows follow',
		exactMatch: true,
	}, {
		query: 'repos people people Danny follows follow created Danny likes',
		exactMatch: false,
	}, {
		query: 'followers of my followers who are followers of mine my followers who created repositories of my followers followers of mine who I follow like that are repos I contributed to follow',
		exactMatch: true,
	}, {
		query: 'repos contributed to by me',
		exactMatch: false,
	}, {
		query: 'repos to by me',
		exactMatch: false,
	}, {
		query: 'repos liked contributed to by me',
		exactMatch: false,
	}, {
		query: 'repos by me',
		exactMatch: false,
	}, {
		// transposition
		query: 'issues opened by me assigned to me',
		exactMatch: false,
	}, {
		query: 'issues with 22 comments',
		exactMatch: true,
	}, {
		query: 'issues assigned to me with 22 comments',
		exactMatch: true,
	}, {
		query: 'issues with 20 to 34 comments I opened',
		exactMatch: true,
	}, {
		// I do not like how that sounds. Might be ok.
		query: 'issues that are with between 20 comments and 34 comments',
		exactMatch: true,
	}, {
		query: 'issues with 3 comments to 3 comments',
		exactMatch: false,
	}, {
		query: 'issues with 3 to 3 comments',
		exactMatch: false,
	}, {
		query: 'issues with less than 2 > 4 comments',
		exactMatch: false,
	}, {
		query: 'JavaScript repos liked by me and my followers',
		exactMatch: true,
	}, {
		query: 'repos with between 22 and 23 likes',
		exactMatch: true,
	}, {
		query: 'repos created in 2014',
		exactMatch: true,
	}, {
		query: 'repos created 2014',
		exactMatch: false,
	}, {
		query: 'repos created in June 2014',
		exactMatch: true,
	}, {
		query: 'repos created in June 24 2014',
		exactMatch: false,
	}, {
		query: 'repos created this year',
		exactMatch: true,
	}, {
		query: 'repos created after this year',
		exactMatch: true,
	}, {
		query: 'repos created between last year and this year',
		exactMatch: true,
	}, {
		query: 'repos created from 2012 to 2014',
		exactMatch: true,
	}, {
		// perhaps could prevent because logically contradictory
		query: 'repos created before June 20 2000 and after this year',
		exactMatch: true,
	}, {
		query: 'people I and Danny follows',
		exactMatch: false,
	}, {
		query: 'people people Danny follow and Danny follows',
		exactMatch: false,
	}, {
		query: 'likers of my repos I contributed to that I like and my repos I contributed to',
		exactMatch: true,
	}, {
		// correct capitalization
		query: 'my GitHub repos liked by my github followers',
		exactMatch: false,
	}, {
		query: 'my followers\' repos',
		exactMatch: true,
	}, {
		query: 'my {left-stop-word} followers\' repos',
		exactMatch: false,
	}, {
		query: 'my {left-stop-word} followers\' {left-stop-word} repos',
		exactMatch: false,
	}, {
		query: 'Danny\'s followers\' followers',
		exactMatch: true,
	}, {
		query: 'repos of Danny\'s',
		exactMatch: true,
	}, {
		query: 'Danny\'s followers',
		exactMatch: true,
	}, {
		// perhaps -> "females"
		query: 'female people',
		exactMatch: true,
	}, {
		query: 'female people who are male',
		exactMatch: false,
	}, {
		query: 'male people who are not male',
		exactMatch: false,
	}, {
		query: 'my male followers',
		exactMatch: true,
	}, {
		query: 'Danny\'s male followers',
		exactMatch: true,
	}, {
		query: 'my followers\' female followers',
		exactMatch: true,
	}, {
		query: 'my female followers\' female followers',
		exactMatch: true,
	}, {
		query: 'my female followers\' female followers who are not male',
		exactMatch: true,
	}, {
		query: 'REPOS i LiKe',
		exactMatch: false,
	}, {
		// should be "were"
		query: 'repos that are not created today liked by me',
		exactMatch: false,
	}, {
		query: 'people who are not my followers',
		exactMatch: true,
	}, {
		query: 'repos not created today not liked by me',
		exactMatch: false,
	}, {
		query: 'women',
		exactMatch: true,
	}, {
		query: 'men I follow',
		exactMatch: true,
	}, {
		query: 'people who are male',
		exactMatch: true,
	}, {
		// or should it correct to 'male'
		query: 'people who are males',
		exactMatch: true,
	}, {
		query: 'male women',
		exactMatch: false,
	}, {
		query: 'female people who are women',
		exactMatch: false,
	}, {
		query: 'repos that are created by me and are not created by me',
		exactMatch: false,
	}, {
		query: 'repos that are not created by me and are created by me',
		exactMatch: false,
	}, {
		query: 'people people I follow who Danny follow and follow Danny follow',
		exactMatch: false,
	}, {
		query: 'repos people I follow created that Danny like',
		exactMatch: false,
	}, {
		query: 'issues assigned to me Danny opened and Aang are mentioned in',
		exactMatch: false,
	}, {
		// Intentionally fails. can't use entity name
		query: 'people {user} follows',
		exactMatch: false,
	}, {
		// Intentionally fails
		query: 'people I and {user} follow',
		exactMatch: false,
	}, {
		// Intentionally fails
		query: 'issues with <int> comments',
		exactMatch: false,
	}, {
		query: 'my repos me people who follow my followers have been and',
		exactMatch: false,
	}, {
		query: 'people my followers who created repositories of my followers followers of mine who I follow like follow',
		exactMatch: true,
	}, {
		query: 'contributors to my repos or repos I like or Danny likes',
		exactMatch: true,
	}, {
		query: 'repos I like or I created',
		exactMatch: true,
	}, {
		query: 'repos I or Danny like',
		exactMatch: true,
	}, {
		query: 'repos I or Danny or my followers like',
		exactMatch: true,
	}, {
		query: 'repos I or Danny and my followers like',
		exactMatch: true,
	}, {
		query: 'repos I or Danny created',
		exactMatch: true,
	}, {
		query: 'people never currently I follow',
		exactMatch: false,
	}, {
		query: 'people I have',
		exactMatch: false,
	}, {
		query: 'repos I have',
		exactMatch: false,
	}, {
		query: 'repos been liked by me',
		exactMatch: false,
	}, {
		query: 'people who not been followed by me',
		exactMatch: false,
	}, {
		query: 'repos I contributed to',
		exactMatch: true,
	}, {
		query: 'repos I to contributed to',
		exactMatch: false,
	}, {
		query: 'repos I to created',
		exactMatch: false,
	}, {
		query: 'repos I to have created',
		exactMatch: false,
	}, {
		query: 'repos I and Danny have contributed to',
		exactMatch: true,
	}, {
		query: 'repos I did create',
		exactMatch: false,
	}, {
		query: 'people who have liked my repos',
		exactMatch: true,
	}, {
		query: 'people who',
		exactMatch: false,
	}, {
		query: 'people who like',
		exactMatch: false,
	}, {
		query: 'people who have',
		exactMatch: false,
	}, {
		query: 'people who have been',
		exactMatch: false,
	}, {
		query: 'repos that',
		exactMatch: false,
	}, {
		query: 'repos that have',
		exactMatch: false,
	}, {
		query: 'repos that been',
		exactMatch: false,
	}, {
		query: 'repos that have been',
		exactMatch: false,
	}, {
		query: 'issues that',
		exactMatch: false,
	}, {
		query: 'issues that have',
		exactMatch: false,
	}, {
		query: 'issues that been',
		exactMatch: false,
	}, {
		query: 'issues that have been',
		exactMatch: false,
	}, {
		query: 'pull requests that',
		exactMatch: false,
	}, {
		query: 'pull requests that have',
		exactMatch: false,
	}, {
		query: 'pull requests that been',
		exactMatch: false,
	}, {
		query: 'pull requests that have been',
		exactMatch: false,
	}, {
		query: 'people who repos',
		exactMatch: false,
	}, {
		query: 'people who have repos',
		exactMatch: false,
	}, {
		query: 'people who have my repos',
		exactMatch: false,
	}, {
		query: 'people who issues',
		exactMatch: false,
	}, {
		query: 'people who have issues',
		exactMatch: false,
	}, {
		query: 'people who have my issues',
		exactMatch: false,
	}, {
		query: 'people who pull requests',
		exactMatch: false,
	}, {
		query: 'people who have pull requests',
		exactMatch: false,
	}, {
		query: 'people who have my pull requests',
		exactMatch: false,
	}, {
		query: 'repos who have liked my repos',
		exactMatch: false,
	}, {
		query: 'people who have issues pull requests',
		exactMatch: false,
	}, {
		query: 'people who have issues pull requests repos',
		exactMatch: false,
	}, {
		query: 'issues been',
		exactMatch: false,
	}, {
		query: 'issues opened by me that mention followers of people who like repos creators of Node contributed to',
		exactMatch: true,
	}, {
		query: 'issues opened by me that mention followers of people who like repos creators of Node contributed to and are assigned to pull requests I am not mentioned in',
		exactMatch: true,
	}, {
		query: 'issues opened me followers people repos creators of Node contributed to assigned to pull requests am not mentioned in',
		exactMatch: false,
	}, {
		query: 'people who do contributed to my repos',
		exactMatch: false,
	}, {
		query: 'people who do contributed not to my repos',
		exactMatch: false,
	}, {
		// needs some output
		query: 'issues with -20 to 34 comments I opened',
		exactMatch: false,
	}, {
		// needs som output
		query: 'repos created before June 0 2000 and July -2 3000',
		exactMatch: false,
	}, {
		// needs some output
		query: 'repos created before June 32 1940',
		exactMatch: false,
	}, {
		query: 'repos created before June 31 1950',
		exactMatch: true,
	}, {
		query: 'people who do not follow me',
		exactMatch: true,
	}, {
		query: 'people who people',
		exactMatch: false,
	}, {
		query: 'people who followers',
		exactMatch: false,
	}, {
		query: 'my pull requests assigned to me',
		exactMatch: true,
	}, {
		query: 'repos I do not like',
		exactMatch: true,
	}, {
		// I do not know, because "repos I did not star" is good
		query: 'repos I did not like',
		exactMatch: false,
	}, {
		query: 'repos Danny does not like',
		exactMatch: true,
	}, {
		query: 'repos Danny has not liked',
		exactMatch: true,
	}, {
		query: 'repos Danny has liked',
		exactMatch: true,
	}, {
		query: 'repos Danny have likes',
		exactMatch: false,
	}, {
		query: 'repos I have not liked',
		exactMatch: true,
	}, {
		query: 'repos I has not liked',
		exactMatch: false,
	}, {
		// enable transpositions?
		query: 'repos I not have liked',
		exactMatch: false,
	}, {
		query: 'repos people who follow me and I do not like',
		exactMatch: true,
	}, {
		query: 'repos people who follow me and me do not like',
		exactMatch: false,
	}, {
		query: 'repos people who follow me and I does not like',
		exactMatch: false,
	}, {
		query: 'repos people who follow me and I have not liked',
		exactMatch: true,
	}, {
		query: 'repos people who follow me and I has not likes',
		exactMatch: false,
	}, {
		query: 'repos people who have not liked Danny\'s repos created',
		exactMatch: true,
	}, {
		query: 'repos I did not have liked',
		exactMatch: false,
	}, {
		query: 'repos Danny and I do not like',
		exactMatch: true,
	}, {
		query: 'repos Danny and people who follow Danny have not liked',
		exactMatch: true,
	}, {
		query: 'repos that have been liked by me',
		exactMatch: true,
	}, {
		query: 'people who do not like my repos',
		exactMatch: true,
	}, {
		query: 'repos that have not been liked by me',
		exactMatch: true,
	}, {
		query: 'repos that not been liked by me',
		exactMatch: false,
	}, {
		query: 'repos not been liked by me',
		exactMatch: true,
	}, {
		query: 'people who have not liked my repos',
		exactMatch: true,
	}, {
		query: 'repos I and Danny do not liked',
		exactMatch: false,
	}, {
		query: 'repos I and Danny do not like',
		exactMatch: true,
	}, {
		query: 'repos I and Danny have not liked',
		exactMatch: true,
	}, {
		query: 'repos Danny does like',
		exactMatch: false,
	}, {
		query: 'repos I not liked',
		exactMatch: false,
	}, {
		query: 'repos Danny and Aang and I do not like',
		exactMatch: true,
	}, {
		query: 'repos Danny and has not liked',
		exactMatch: false,
	}, {
		query: 'repos Danny and Aang not have liked',
		exactMatch: false,
	}, {
		query: 'repos my followers have not liked',
		exactMatch: true,
	}, {
		query: 'repos my followers like',
		exactMatch: true,
	}, {
		query: 'my repositories people who created my repos created',
		exactMatch: false,
	}, {
		query: 'repos created today created yesterday',
		exactMatch: false,
	}, {
		// Should produce results
		query: 'people who like my repos liked by people who follow me that people I follow created',
		exactMatch: false,
	}, {
		query: 'repos Danny by me',
		exactMatch: false,
	}, {
		query: 'repos Danny by me Danny',
		exactMatch: false,
	}, {
		query: 'repos I not',
		exactMatch: false,
	}, {
		query: 'issues I not',
		exactMatch: false,
	}, {
		query: 'pull requests I not',
		exactMatch: false,
	}, {
		query: 'repos Danny contributed to and I like',
		exactMatch: true,
	}, {
		query: 'repos I and Danny have not contributed to',
		exactMatch: true,
	}, {
		query: 'repos people who do not like my repos have not contributed to',
		exactMatch: true,
	}, {
		query: 'people who have not contributed to my repos',
		exactMatch: true,
	}, {
		query: 'repos that are not JavaScript repos',
		exactMatch: true,
	}, {
		query: 'repos that are not written in JavaScript',
		exactMatch: true,
	}, {
		query: 'people who are not followed by me',
		exactMatch: true,
	}, {
		query: 'people not followed by me',
		exactMatch: true,
	}, {
		query: 'repos not written in JavaScript',
		exactMatch: true,
	}, {
		query: 'people not mentioned in my issues',
		exactMatch: true,
	}, {
		query: 'issues not assigned to me',
		exactMatch: true,
	}, {
		query: 'repos that are not my repos',
		exactMatch: true,
	}, {
		query: 'repos I create',
		exactMatch: false,
	}, {
		query: 'repos I created',
		exactMatch: true,
	}, {
		query: 'repos Danny has created',
		exactMatch: true,
	}, {
		query: 'repos I did not create',
		exactMatch: true,
	}, {
		query: 'repos Danny did not create',
		exactMatch: true,
	}, {
		query: 'repos Danny do not creates',
		exactMatch: false,
	}, {
		// Intentionally wrong, because it implies they can be created
		// Should be: 'repos I did not create'
		query: 'repos I have not created',
		exactMatch: false,
	}, {
		// Should be: 'repos Danny did create'
		query: 'repos Danny has not created',
		exactMatch: false,
	}, {
		query: 'repos I made',
		exactMatch: false,
	}, {
		query: 'repos I did not make',
		exactMatch: false,
	}, {
		query: 'issues I did not open',
		exactMatch: true,
	}, {
		query: 'issues I create',
		exactMatch: false,
	}, {
		query: 'issues I did not created',
		exactMatch: false,
	}, {
		query: 'people who do not created my repos',
		exactMatch: false,
	}, {
		query: 'people who did not create my repos',
		exactMatch: true,
	}, {
		query: 'people who do not have liked my repos',
		exactMatch: false,
	}, {
		query: 'people who do not have opened my issues',
		exactMatch: false,
	}, {
		query: 'issues that do not mention me',
		exactMatch: true,
	}, {
		query: 'issues that are not assigned to my followers',
		exactMatch: true,
	}, {
		query: 'issues that have not been assigned to me',
		exactMatch: true,
	}, {
		query: 'issues Danny is not assigned to',
		exactMatch: true,
	}, {
		query: 'pull requests my followers are not mentioned in',
		exactMatch: true,
	}, {
		query: 'pull requests that have not been assigned to me',
		exactMatch: true,
	}, {
		query: 'people who did not like',
		exactMatch: false,
	}, {
		query: 'people who like my',
		exactMatch: false,
	}, {
		query: 'that mention me',
		exactMatch: false,
	}, {
		query: 'that I contributed to',
		exactMatch: false,
	}, {
		query: 'people who did not contributed to my repos',
		exactMatch: false,
	}, {
		query: 'Danny\'s followers who do not follow me',
		exactMatch: true,
	}, {
		query: 'people who forked Node',
		exactMatch: true,
	}, {
		query: 'people who forked my repos',
		exactMatch: true,
	}, {
		query: 'repos I have not forked',
		exactMatch: true,
	}, {
		query: 'repos I forked pushed last year',
		exactMatch: false,
	}, {
		// perhaps, be can disallow this
		query: 'repos with greater than 20 forks and fewer than 0 forks',
		exactMatch: true,
	}, {
		query: 'repos Danny did not fork',
		exactMatch: true,
	}, {
		query: 'repos Danny has not forked',
		exactMatch: true,
	}, {
		// Maybe this should be forbidden for "people who have not"
		// Wait until more rules have been created to solve uncertainty
		query: 'people who do not contribute to my repos',
		exactMatch: true,
	}, {
		query: 'repos Danny does not contribute to',
		exactMatch: true,
	}, {
		query: 'repos Danny has not contributed to',
		exactMatch: true,
	}, {
		query: 'repos Danny or Aang do not contribute to',
		exactMatch: true,
	}, {
		query: 'contributors of repos I did not contribute to pushed last year',
		exactMatch: false,
	}, {
		// Returns no results, but would be good if it did (deletions?)
		query: 'people who contributed to issues I opened',
		exactMatch: false,
	}, {
		query: 'people I follow',
		exactMatch: true,
	}, {
		query: 'people Danny follows',
		exactMatch: true,
	}, {
		query: 'people I and Danny follow',
		exactMatch: true,
	}, {
		query: 'people Danny and I follow',
		exactMatch: true,
	}, {
		query: 'people people Danny follows and Danny follow',
		exactMatch: true,
	}, {
		query: 'issues assigned to me Danny opened and Aang is mentioned in',
		exactMatch: true,
	}, {
		query: 'repos people I follow created that Danny likes',
		exactMatch: true,
	}, {
		query: 'people people I follow who Danny follows and follow Danny follow',
		exactMatch: true,
	}, {
		query: 'repos that are liked by my followers',
		exactMatch: true,
	}, {
		query: 'repos that were liked by my followers',
		exactMatch: true,
	}, {
		query: 'people who did not contribute to my repos',
		exactMatch: true,
	},

	// 'followers my followers share',
	// 'followers I and Danny have in common',
	// 'followers I share', // intentionally wrong
	// 'followers I share with Danny',
	// 'followers I and Danny share with Aang',
	// 'followers I and Danny share with Aang and my followers',
	// 'followers Danny has in common with' // doesn't work

	// 'repos that I created I like', // intentionally wrong - unimplemented
	// 'people who I follow Danny follows', // intentionally wrong - unimplemented
	// 'pull requests of mine created by my followers' // no results, too slow. Look at parse stack
	// 'my followers who created pull requests of mine my followers who created repositories followers of mine mentioned in issues of my followers who I follow like that are repos created by me I contributed to am mentioned in that I am mentioned in', // really slow, but because of some rule - look at parse stack. Remove some ambiguous insertions
	// 'my' - no results, but should have some
]