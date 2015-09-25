/**
 * Queries to test speed and various cases.
 *
 * If `test.exactMatch` is `true`, then check that the first result's display text is identical to `test.query`.
 *
 * @type Object[]
 */
module.exports = [
	{
		query: 'repos I have liked',
		exactMatch: true,
	}, {
		query: 'repos created by me and my followers',
	}, {
		query: 'repos I and my followers created',
	}, {
		query: 'people who like my repos liked by people who follow people I follow',
	}, {
		query: 'people who like repos',
	}, {
		query: 'repos been followers',
	}, {
		query: 'repos been followers people who like repos that I have',
	}, {
		query: 'repos people who like and created',
	}, {
		query: 'repos that have been created by people and like and I contributed to',
	}, {
		query: 'repos that are repos',
	}, {
		// Intentionally wrong
		query: 'my followers who are my followers',
	}, {
		query: 'my followers who are followers of followers of mine',
	}, {
		query: 'my followers who are followers of followers of mine who liked that repos contributed to of mine',
	}, {
		query: 'repos',
	}, {
		query: 'people',
	}, {
		query: 'people who created my repos and my pull requests',
	}, {
		query: 'people pull requests like repos I like',
	}, {
		query: 'repos liked by followers of followers of mine',
	}, {
		query: 'repos liked by me and my followers',
	}, {
		query: 'repos liked by me and my followers and people who like JavaScript repos liked by me and my followers',
	}, {
		query: 'my repos that are JavaScript repos',
	}, {
		query: 'my JavaScript repos',
	}, {
		query: 'repos that are written in JavaScript',
	}, {
		// Intentionally fails
		query: 'my JavaScript repos that are written in JavaScript',
	}, {
		query: 'issues assigned to me I opened and am mentioned in',
	}, {
		query: 'people who are assigned to my issues and follow people who contributed to repos I created and are mentioned in pull requests of mine',
	}, {
		query: 'people who are mentioned in my issues and pull requests',
	}, {
		query: 'people who are assigned to my issues and my pull requests',
	}, {
		query: 'people mentioned in my issues and my pull requests',
	}, {
		query: 'my {left-stop-word} repos',
	}, {
		query: 'my {left-stop-word} JavaScript repos',
	}, {
		query: 'my JavaScript {left-stop-word} repos',
	}, {
		query: 'my {left-stop-word} JavaScript {left-stop-word} repos',
	}, {
		query: 'my {left-stop-word} {left-stop-word} repos',
	}, {
		query: 'open issues',
	}, {
		query: 'issues that are open',
	}, {
		query: 'people assigned to my closed issues',
	}, {
		query: 'contributors to my repos',
	}, {
		query: 'contributors to my repos and repos of mine',
	}, {
		query: 'likers of my repos',
	}, {
		query: 'creators of repos I like',
	}, {
		query: 'likers of repos I like and repos I contributed to',
	}, {
		query: 'creators of repos I like and repos I contributed to',
	}, {
		// Unimplemented
		query: 'creators of repos I like and pull requests I am mentioned in',
	}, {
		query: 'openers of closed issues that mention people I and my followers follow',
	}, {
		query: 'people who are not followers of mine',
	}, {
		query: 'people who have not been followed by me',
		exactMatch: true,
	}, {
		query: 'issues that are not open',
	}, {
		query: 'people I do not follow',
		exactMatch: true,
	}, {
		query: 'people who follow me and do not follow Danny',
	}, {
		query: 'issues I am assigned to',
	}, {
		query: '{left-stop-word} open issues that are never assigned to people who {pre-filter-stop-word} follow me',
	}, {
		query: 'repos of people who follow me',
	}, {
		query: 'followers of mine and people who follow me',
	}, {
		query: 'repos of mine and people who follow me',
	}, {
		query: 'repos I like or my followers likes',
	}, {
		query: 'repos I or my followers likes',
	}, {
		query: 'repos created by people I follow and Danny follows',
	}, {
		query: 'repos created by people I and Danny follow',
	}, {
		query: 'people who follow people',
	}, {
		query: 'people followed by myself',
	}, {
		query: 'people who follow I',
	}, {
		query: 'people me follows',
	}, {
		query: 'openers of my closed issues that mention me people who follow me and my followers follow follow',
	}, {
		query: 'repos people my followers follow like',
	}, {
		query: 'people people Danny follows follow',
		exactMatch: true,
	}, {
		query: 'repos people people Danny follows follow created Danny likes',
	}, {
		query: 'followers of my followers who are followers of mine my followers who created repositories of my followers followers of mine who I follow like that are repos I contributed to follow',
	}, {
		query: 'repos contributed to by me',
	}, {
		// Intentionally wrong
		query: 'repos to by me',
	}, {
		// Intentionally wrong
		query: 'repos liked contributed to by me',
	}, {
		query: 'repos by me',
	}, {
		// transposition
		query: 'issues opened by me assigned to me',
	}, {
		query: 'issues with 22 comments',
	}, {
		query: 'issues assigned to me with 22 comments',
	}, {
		query: 'issues with 20 to 34 comments I opened',
	}, {
		query: 'issues that are with between 20 comments and 34 comments',
	}, {
		query: 'issues with 3 comments to 3 comments',
	}, {
		query: 'issues with 3 to 3 comments',
	}, {
		query: 'issues with less than 2 > 4 comments',
	}, {
		query: 'JavaScript repos liked by me and my followers',
	}, {
		query: 'repos with between 22 and 23 likes',
	}, {
		query: 'repos created in 2014',
	}, {
		query: 'repos created 2014',
	}, {
		query: 'repos created in June 2014',
	}, {
		query: 'repos created in June 24 2014',
	}, {
		query: 'repos created this year',
	}, {
		query: 'repos created after this year',
	}, {
		query: 'repos created between last year and this year',
	}, {
		query: 'repos created from 2012 to 2014',
	}, {
		query: 'repos created before June 20 2000 and after this year',
	}, {
		// Intentionally wrong
		query: 'people I and Danny follows',
	}, {
		// Intentionally wrong
		query: 'people people Danny follow and Danny follows',
	}, {
		query: 'likers of my repos I contributed to that I like and my repos I contributed to',
	}, {
		query: 'my GitHub repos liked by my github followers',
	}, {
		query: 'my followers\' repos',
	}, {
		query: 'my {left-stop-word} followers\' repos',
	}, {
		query: 'my {left-stop-word} followers\' {left-stop-word} repos',
	}, {
		query: 'Danny\'s followers\' followers',
	}, {
		query: 'repos of Danny\'s',
	}, {
		query: 'Danny\'s followers',
	}, {
		query: 'people who are male',
	}, {
		query: 'female people',
	}, {
		query: 'female people who are male',
	}, {
		query: 'male people who are not male',
	}, {
		query: 'my male followers',
	}, {
		query: 'Danny\'s male followers',
	}, {
		query: 'my followers\' female followers',
	}, {
		query: 'my female followers\' female followers',
	}, {
		query: 'my female followers\' female followers who are not male',
	}, {
		query: 'REPOS i LiKe',
	}, {
		query: 'repos that are not created today liked by me',
	}, {
		query: 'people who are not my followers',
	}, {
		// should produce results
		query: 'repos not created today not liked by me',
	}, {
		query: 'women',
	}, {
		query: 'men I follow',
	}, {
		query: 'people who are males',
	}, {
		query: 'male women',
	}, {
		query: 'female people who are women',
	}, {
		query: 'repos that are created by me and are not created by me',
	}, {
		query: 'repos that are not created by me and are created by me',
	}, {
		query: 'people people I follow who Danny follow and follow Danny follow',
	}, {
		query: 'repos people I follow created that Danny like',
	}, {
		query: 'issues assigned to me Danny opened and Aang are mentioned in',
	}, {
		// Intentionally fails
		query: 'people {user} follows',
	}, {
		// Intentionally fails
		query: 'people I and {user} follow',
	}, {
		// Intentionally fails
		query: 'issues with <int> comments',
	}, {
		query: 'my repos me people who follow my followers have been and',
	}, {
		query: 'people my followers who created repositories of my followers followers of mine who I follow like follow',
	}, {
		query: 'contributors to my repos or repos I like or Danny likes',
	}, {
		query: 'repos I like or I created',
	}, {
		query: 'repos I or Danny like',
	}, {
		query: 'repos I or Danny or my followers like',
	}, {
		query: 'repos I or Danny and my followers like',
	}, {
		query: 'repos I or Danny created',
	}, {
		query: 'people never currently I follow',
	}, {
		query: 'people I have',
	}, {
		query: 'repos I have',
	}, {
		query: 'repos been liked by me',
	}, {
		query: 'people who not been followed by me',
	}, {
		query: 'repos I contributed to',
	}, {
		query: 'repos I to contributed to',
	}, {
		query: 'repos I to created',
	}, {
		query: 'repos I to have created',
	}, {
		query: 'repos I and Danny have contributed to',
	}, {
		query: 'repos I did create',
	}, {
		query: 'people who have liked my repos',
		exactMatch: true,
	}, {
		query: 'people who',
	}, {
		query: 'people who like',
	}, {
		query: 'people who have',
	}, {
		query: 'people who have been',
	}, {
		query: 'repos that',
	}, {
		query: 'repos that have',
	}, {
		query: 'repos that been',
	}, {
		query: 'repos that have been',
	}, {
		query: 'issues that',
	}, {
		query: 'issues that have',
	}, {
		query: 'issues that been',
	}, {
		query: 'issues that have been',
	}, {
		query: 'pull requests that',
	}, {
		query: 'pull requests that have',
	}, {
		query: 'pull requests that been',
	}, {
		query: 'pull requests that have been',
	}, {
		query: 'people who repos',
	}, {
		query: 'people who have repos',
	}, {
		query: 'people who have my repos',
	}, {
		query: 'people who issues',
	}, {
		query: 'people who have issues',
	}, {
		query: 'people who have my issues',
	}, {
		query: 'people who pull requests',
	}, {
		query: 'people who have pull requests',
	}, {
		query: 'people who have my pull requests',
	}, {
		query: 'repos who have liked my repos',
	}, {
		query: 'people who have issues pull requests',
	}, {
		query: 'people who have issues pull requests repos',
	}, {
		query: 'issues been',
	}, {
		query: 'issues opened by me that mention followers of people who like repos creators of Node contributed to',
	}, {
		query: 'issues opened by me that mention followers of people who like repos creators of Node contributed to and are assigned to pull requests I am not mentioned in',
	}, {
		query: 'issues opened me followers people repos creators of Node contributed to assigned to pull requests am not mentioned in',
	}, {
		query: 'people who do contributed to my repos',
	}, {
		query: 'people who do contributed not to my repos',
	}, {
		// Intentionally fails
		query: 'issues with -20 to 34 comments I opened',
	}, {
		// Intentionally fails
		query: 'repos created before June 0 2000 and July -2 3000',
	}, {
		// Intentionally fails
		query: 'repos created before June 32 1940',
	}, {
		query: 'repos created before June 31 1950',
	}, {
		query: 'people who do not follow me',
		exactMatch: true,
	}, {
		query: 'people who people',
	}, {
		query: 'people who followers',
	}, {
		query: 'my pull requests assigned to me',
	}, {
		query: 'repos I do not like',
		exactMatch: true,
	}, {
		query: 'repos I did not like',
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
	}, {
		query: 'repos I have not liked',
		exactMatch: true,
	}, {
		query: 'repos I has not liked',
	}, {
		// enable transpositions?
		query: 'repos I not have liked',
	}, {
		query: 'repos people who follow me and I do not like',
		exactMatch: true,
	}, {
		query: 'repos people who follow me and me do not like',
	}, {
		query: 'repos people who follow me and I does not like',
	}, {
		query: 'repos people who follow me and I have not liked',
		exactMatch: true,
	}, {
		query: 'repos people who follow me and I has not likes',
	}, {
		query: 'repos people who have not liked Danny\'s repos created',
	}, {
		query: 'repos I did not have liked',
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
	}, {
		query: 'repos not been liked by me',
	}, {
		query: 'people who have not liked my repos',
		exactMatch: true,
	}, {
		query: 'repos I and Danny do not liked',
	}, {
		query: 'repos I and Danny do not like',
		exactMatch: true,
	}, {
		query: 'repos I and Danny have not liked',
		exactMatch: true,
	}, {
		query: 'repos Danny does like',
	}, {
		query: 'repos I not liked',
	}, {
		query: 'repos Danny and Aang and I do not like',
		exactMatch: true,
	}, {
		query: 'repos Danny and has not liked',
	}, {
		query: 'repos Danny and Aang not have liked',
	}, {
		query: 'repos my followers have not liked',
		exactMatch: true,
	}, {
		query: 'repos my followers like',
		exactMatch: true,
	}, {
		// Intentionally wrong
		query: 'my repositories people who created my repos created',
	}, {
		// Should fail
		query: 'repos created today created yesterday',
	}, {
		// Intentionally wrong, but should produce results
		query: 'people who like my repos liked by people who follow me that people I follow created',
	}, {
		query: 'repos Danny by me',
	}, {
		query: 'repos Danny by me Danny',
	}, {
		query: 'repos I not',
	}, {
		query: 'issues I not',
	}, {
		query: 'pull requests I not',
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
	}, {
		query: 'repos that are not JavaScript repos',
	}, {
		query: 'repos that are not written in JavaScript',
	}, {
		query: 'people who are not followed by me',
	}, {
		// Only allowing "people who are not followed by me"
		query: 'people not followed by me',
	}, {
		// Not allowing
		query: 'repos not written in JavaScript',
	}, {
		// Not allowing
		query: 'people not mentioned in my issues',
	}, {
		query: 'issues not assigned to me',
	}, {
		query: 'repos that are not my repos',
	}, {
		query: 'repos I create',
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
	}, {
		// Intentionally wrong, because it implies they can be created
		query: 'repos I have not created',
	}, {
		query: 'repos Danny has not created',
	}, {
		query: 'repos I made',
	}, {
		query: 'repos I did not make',
	}, {
		query: 'issues I did not open',
	}, {
		// Intentionally wrong
		query: 'issues I create',
	}, {
		// Intentionally wrong
		query: 'issues I did not created',
	}, {
		// Should not accept
		query: 'people who do not created my repos',
	}, {
		query: 'people who did not create my repos',
		test: true
	}, {
		// Should not accept
		query: 'people who do not have liked my repos',
	}, {
		// Should not accept
		query: 'people who do not have opened my issues',
	}, {
		query: 'issues that do not mention me',
		exactMatch: true,
	}, {
		query: 'issues that are not assigned to my followers',
	}, {
		query: 'issues that have not been assigned to me',
	}, {
		query: 'issues Danny is not assigned to',
		exactMatch: true,
	}, {
		query: 'pull requests my followers are not mentioned in',
		exactMatch: true,
	}, {
		query: 'pull requests that have not been assigned to me',
	}, {
		query: 'people who did not like',
	}, {
		query: 'people who like my',
	}, {
		query: 'that mention me',
	}, {
		query: 'that I contributed to',
	}, {
		query: 'people who did not contributed to my repos',
	}, {
		query: 'Danny\'s followers who do not follow me',
	}, {
		query: 'people who forked Node',
	}, {
		query: 'people who forked my repos',
	}, {
		query: 'repos I have not forked',
	}, {
		query: 'repos I forked pushed last year',
	}, {
		query: 'repos with greater than 20 forks and fewer than 0 forks',
	}, {
		query: 'repos Danny did not fork',
		exactMatch: true,
	}, {
		query: 'repos Danny has not forked',
		exactMatch: true,
	}, {
		query: 'people who do not contribute to my repos',
	}, {
		query: 'repos Danny does not contribute to',
		exactMatch: true,
	}, {
		query: 'repos Danny has not contributed to',
		exactMatch: true,
	}, {
		query: 'repos Danny or Aang do not contribute to',
	}, {
		query: 'contributors of repos I did not contribute to pushed last year',
	}, {
		// Returns no results, but would be good if it did (deletions?)
		query: 'people who contributed to issues I opened',
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