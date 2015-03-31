var g = require('../../grammar')
var user = require('../user')

var github = g.addWord({
	name: 'github',
	accepted: [ 'GitHub' ]
})

// (my) |GitHub (repos)
this.termOpt = g.addNonterminalOpt(github)

// GitHub (users I follow)
user.company.addRule({ RHS: [ github ] })

// Load GitHub-specific rules:
require('./repository')