var g = require('../grammar')

// Stopwords that preceed verbs: [stop] follow
this.preVerbStopwords = new g.Symbol('pre', 'verb', 'stopwords')
this.preVerbStopwords.addRule({ RHS: [ g.emptyTermSym ] })