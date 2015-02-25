var g = require('../grammar')

// (people) I (follow); (people followed by) me; (people who follow) me
this.plain = new g.Symbol(1, 'sg')
this.plain.addRule({ terminal: true, RHS: 'I', insertionCost: 0 })
this.plain.addRule({ terminal: true, RHS: 'me' })
this.plain.addRule({ terminal: true, RHS: 'myself' }) // rejected

// (people) I'm (following) -> (people) I (follow)
this.nom = new g.Symbol(1, 'sg', 'nom')
this.nom.addRule({ terminal: true, RHS: 'I' })
this.nom.addRule({ terminal: true, RHS: 'i\'d|i\'ll|i\'m|i\'ve|id|ill|im|ive' }) // rejected

// my (followers)
this.possOmissible = new g.Symbol(1, 'sg', 'poss', 'omissible')
this.possOmissible.addRule({ terminal: true, RHS: g.emptyTermSym })
this.possOmissible.addRule({ terminal: true, RHS: 'my' })