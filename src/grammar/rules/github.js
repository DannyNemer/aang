var g = require('../grammar')
var user = require('./user')

var github = g.addWord({
	name: 'github',
	accepted: [ 'GitHub' ]
})

// (my) |GitHub (repos)
this.termOpt = new g.Symbol('github', 'opt')
this.termOpt.addRule({ RHS: [ github ] })
this.termOpt.addRule({ terminal: true, RHS: g.emptyTermSym })

// GitHub (users I follow)
user.company.addRule({ RHS: [ github ] })

// Load GitHub-specific rules:
require('./repository')