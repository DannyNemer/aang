var g = require('../grammar')

var prepStr = 'prep'

this.agent = new g.Symbol(prepStr, 'agent')
this.agent.addRule({ RHS: [ 'by' ]})