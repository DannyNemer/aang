var g = require('../grammar')

// (people) I (follow); (people followed by) me; (people who follow) me
this.plain = new g.Symbol(1, 'sg')
this.plain.addRule({ terminal: true, RHS: 'I', gramCase: 'nom', insertionCost: 0 })
this.plain.addRule({ terminal: true, RHS: 'me', gramCase: 'obj' })
this.plain.addRule({ terminal: true, RHS: 'myself' }) // rejected

// my (repositories)
this.poss = new g.Symbol(1, 'sg', 'poss')
this.poss.addRule({ terminal: true, RHS: 'my' })

// my (followers)
this.possOmissible = new g.Symbol(1, 'sg', 'poss', 'omissible')
this.possOmissible.addRule({ terminal: true, RHS: g.emptyTermSym })
this.possOmissible.addRule({ terminal: true, RHS: 'my' })