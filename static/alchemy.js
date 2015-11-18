/* Insert symbols using shorthands */

var ALCHEMY_KIT = {};
(function () {

  // Fixed order
  function _alchemy_fixed(stuff) {
    stuff.forEach(function (x) {
      if (!x) return;
      for (var i = 0; i < x.length - 1; i++)
        ALCHEMY_KIT[x[i]] = x[x.length - 1];
    });
  }

  // Flexible order
  function _alchemy_flexible(stuff) {
    stuff.forEach(function (x) {
      if (!x) return;
      for (var i = 0; i < x[0].length; i++)
        for (var j = 0; j < x[1].length; j++)
          ALCHEMY_KIT[x[0][i] + x[1][j]] = ALCHEMY_KIT[x[1][j] + x[0][i]] = x[2];
    });
  }

  // Common Symbols
  _alchemy_fixed([
    ['!!', '¡'], ['??', '¿'], ['<<', '«'], ['>>', '»'],
    ['-,', 'not', '¬'], ['oo', '^o', '^O', 'deg', '°'],
    ['+-', 'pm', '±'], ['xx', 'times', '×'],
    ['1/4', '14', '¼'], ['1/2', '12', '½'], ['3/4', '34', '¾'],
    ['..', '...', '…'], ['--.', '--', '–'], ['---', '—'],
    [':)', '☺'], [':(', '☹'], ['<3', '♥'], ['No', 'NO', '№'],
    ['<-', '<--', 'left', '←'], ['->', '-->', 'right', '→'],
    ['|^', 'up', '↑'], ['|v', 'down', '↓'], ['<->', '<-->', '↔'],
    ['~~', 'approx', '≈'], ['-=', '=-', '==', '≡'], ['inf', 'infty', '∞'],
    ['<=', '≤'], ['>=', '≥'], ['music', 'song', '♪'],
    null]);
  _alchemy_flexible([
    ['|/', 'Cc', '¢'], ['-', 'Ll', '£'], ['-=', 'Yy', '¥'], ['=', 'CEce', '€'],
    ['Ss', 'Ss', '§'], ['Oo', 'Cc', '©'], ['Oo', 'Rr', '®'],
    ['-', ':', '÷'], ['=', '/', '≠'],
    null]);

  // Greek
  var LATIN = 'ABCDEZHQIKLMNJOPRSTUFXYWabcdezhqiklmnjoprstufxyw';
  var GREEK = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω';
  for (var i = 0; i < GREEK.length; i++) {
    ALCHEMY_KIT['G' + LATIN[i]] = ALCHEMY_KIT['g' + LATIN[i]] = GREEK[i];
  }

  // Macros
  _alchemy_fixed([
    ['al', '$$\\begin{align*}\n\n\\end{align*}$$'],
    ['op', '$$\\begin{align*}\n& \\underset{x}{\\text{minimize}}\n&& f_0(x) \\\\\n' +
           '& \\text{subject to}\n&& f_i(x) \\leq b_i\n&& (i = 1,\\dots, m)\n\\end{align*}$$'],
    null]);

})();
