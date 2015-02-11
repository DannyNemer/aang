var util = require('./util')
var g = require('./grammar')

var photosLHS = new g.Symbol('photos-lhs')
var photosRHS = new g.Symbol('photos-rhs')

var start = new g.Symbol('start')
start.addRule({ RHS: [ photosLHS, photosRHS ] })

util.log(start)