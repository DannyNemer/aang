var g = require('../grammar')

var prepStr = 'prep'

// (people followed) by (me)
this.agent = new g.Symbol(prepStr, 'agent')
this.agent.addRule({ terminal: true, RHS: 'by', insertionCost: 0.5 })

// (followers) of (mine)
this.possessor = new g.Symbol(prepStr, 'possessor')
this.possessor.addRule({ terminal: true, RHS: 'of', insertionCost: 0.5 })