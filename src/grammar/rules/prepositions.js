var g = require('../grammar')

var prepStr = 'prep'

this.agent = new g.Symbol(prepStr, 'agent')
this.agent.addRule({ terminal: true, RHS: 'by', insertionCost: 0.5 })