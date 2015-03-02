var g = require('../grammar')

// (people) who (follow me)
this.who = new g.Symbol('who')
this.who.addRule({ terminal: true, RHS: 'who', insertionCost: 0.1 })
this.who.addRule({ terminal: true, RHS: 'that' }) // accept?

// (repos) that (are liked by me)
this.that = new g.Symbol('that')
this.that.addRule({ terminal: true, RHS: 'that', insertionCost: 0.1 })