var g = require('./grammar')

this.emptyTermSym = '<empty>'

// Stopwords that preceed verbs: [stop] follow
this.preVerbStopwords = new g.Symbol('pre', 'verb', 'stopwords')
this.preVerbStopwords.addRule({ RHS: [ this.emptyTermSym ] })