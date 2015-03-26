$(function() {
  
  var myCodeMirror, changeCountdown = null, bookNoteList, bidMap, nidMap;
  var AUTO_UPDATE_INTERVAL = 1500;

  //================================================================
  // Retrieving book and note lists
  
  // Get the book/note lists
  function getLists(data, bid, nid) {
    if (data) {
      bookNoteList = data;
      populateBookList(bid, nid);
    } else {
      $.get('/list/', function (data) {
        getLists(data, bid, nid);
      }).fail(showError);
    }
  }

  function populateBookList(bid, nid) {
    $("#booklist").empty();
    bidMap = {};
    bookNoteList.books.forEach(function (book) {
      bidMap[book.bid] = $("<div>").text(book.name).attr("title", book.name)
        .addClass("book-choice choice cutoff")
        .droppable({
          accept: ".note-choice",
          activeClass: "ui-state-default",
          hoverClass: "ui-state-hover",
          drop: function(event, ui) {
            moveNote(ui.draggable.data("info").nid, book.bid);
          }
        })
        .data("info", book).appendTo("#booklist");
    });
    if (bid == undefined && nid !== undefined) {
      bookNoteList.books.forEach(function (book) {
        book.notes.forEach(function (note) {
          if (note.nid === nid) bid = book.bid;
        });
      });
      if (bid === undefined) {
        showError('Note #' + nid + ' not found.');
      }
    }
    if (bid !== undefined) {
      selectBook(bid, nid);
    } else {
      selectBook(bookNoteList.books[0].bid);
    }
  }

  function selectBook(bid, nid) {
    $(".book-choice").removeClass("selected");
    bidMap[bid].addClass("selected");
    populateNoteList(nid);
  }

  function populateNoteList(nid) {
    var book = getCurrentBook();
    $("#notelist").empty();
    nidMap = {};
    book.notes.forEach(function (note) {
      nidMap[note.nid] = $("<div>").text(note.name).attr("title", note.name)
        .addClass("note-choice choice cutoff")
        .draggable({
          appendTo: "body",
          helper: "clone",
          delay: 500
        })
        .data("info", note).appendTo("#notelist");
    });
    if (nid !== undefined) {
      selectNote(nid);
    } else if (book.notes.length > 0) {
      selectNote(book.notes[0].nid);
    } else {
      displayNote();
    }
  }

  function selectNote(nid) {
    $(".note-choice").removeClass("selected");
    nidMap[nid].addClass("selected");
    displayNote();
    window.location.hash = '#' + nid;
    // Need to refresh the favicon
    var href = $('link[rel="shortcut icon"]').remove().attr('href');
    $('head').append('<link type="image/x-icon" rel="shortcut icon" href="' + href + '">');
  }

  $("#booklist").on("click", ".book-choice", confirmAction(function () {
    selectBook($(this).data("info").bid);
  }));

  $("#notelist").on("click", ".note-choice", confirmAction(function () {
    selectNote($(this).data("info").nid);
  }));

  $(window).on("hashchange", function (e) {
    var nid = +window.location.hash.slice(1);
    if (!nid) {
      getLists();
    } else if (nid !== (getCurrentNote() || {}).nid) {
      getLists(undefined, undefined, nid);
    }
  });

  //================================================================
  // Dialogs
  
  var DIALOGS = {};
  
  function buildDialog(title, type, icon, submit, ignore) {
    var dialog = $("<div>").dialog({
      autoOpen: false,
      modal: true,
      buttons: buttons,
      title: title,
      width: 420,
    }).append($("<img>").attr("src", "static/icons/" + icon));
    var rightPane = $('<div class="right-pane">')
          .append($('<div class="dialog-text">')).appendTo(dialog);
    var input;
    if (type === "prompt") {
      dialog.addClass("dialog-prompt");
      input = $('<input type="text" class="dialog-input">')
        .keyup(function (e) {
          if ((e.keyCode || e.which) === 13) {
            dialog.dialog("close");
            submit.fn(dialog.data("args"), input.val());
          }
        }).appendTo(rightPane);
    } else if (type === "confirm") {
      dialog.addClass("dialog-confirm");
    } else if (type === "alert") {
      dialog.addClass("dialog-alert");
    }

    var buttons = [];
    if (submit !== undefined) {
      buttons.push({
        text: submit.name,
        click: function () {
          dialog.dialog("close");
          submit.fn(dialog.data("args"), input && input.val());
        }
      });
    }
    if (ignore !== undefined) {
      buttons.push({
        text: ignore.name,
        click: function () {
          dialog.dialog("close");
          ignore.fn(dialog.data("args"), input && input.val());
        }
      });
    }
    buttons.push({
      text: "Cancel",
      click: function() {dialog.dialog("close");}
    });
    dialog.dialog("option", "buttons", buttons);

    DIALOGS[title] = dialog;
  }

  function openDialog(title, texts, args, defaultText) {
    var dialog = DIALOGS[title];
    var dialogText = dialog.find(".dialog-text").empty();
    texts.forEach(function (item) {
      dialogText.append($("<p>").text(item));
    });
    dialog.find("input").val(defaultText || "");
    dialog.data("args", args).dialog("open");
  }
  
  //================================================================
  // Add / Rename / Delete books

  var UNTITLED_BOOK = "Untitled Book";

  function getCurrentBook() {
    return $(".book-choice.selected").data("info");
  }

  // Add a book named "Untitled Book"
  buildDialog("Add Book", "prompt", "add.png", {
    name: "Add",
    fn: function (args, name) {
      name = name || UNTITLED_BOOK;
      var data = {name: name};
      $.post('/book/new', data, function (data) {
        getLists(data.list, data.bid);
      }).fail(showError);
    }    
  });

  function addBook() {
    openDialog("Add Book", ["Enter the book's name:"]);
  }

  // Rename a book
  buildDialog("Rename Book", "prompt", "rename.png", {
    name: "Rename",
    fn: function (args, name) {
      var book = args.book, note = args.note;
      if (!name) return;
      var data = {action: 'rename', name: name};
      $.post('/book/' + book.bid, data, function (data) {
        getLists(data, book.bid, note && note.nid);
      }).fail(showError);
    }
  });

  function renameBook() {
    var book = getCurrentBook(), note = getCurrentNote();
    if (book.bid === 0) {
      showError("Cannot rename " + book.name + "!");
      return;
    }
    openDialog("Rename Book",
               ["Current name: " + book.name, "Enter the new name:"],
               {book: book, note: note}, book.name);
  }

  // Delete a book
  buildDialog("Delete Book", "confirm", "delete.png", {
    name: "Delete",
    fn: function (args) {
      var book = args.book;
      var data = {action: 'delete'};
      $.post('/book/' + book.bid, data, function (data) {
        getLists(data);
      }).fail(showError);
    }
  });

  function deleteBook() {
    var book = getCurrentBook();
    if (book.bid === 0) {
      showError("Cannot delete " + book.name + "!");
      return;
    }
    openDialog("Delete Book", ["Delete book: " + book.name + "?"],
               {book: book});
  }

  $("#book-add").button({icons: {primary: "ui-icon-plusthick"}, text: false})
    .click(confirmAction(addBook));
  $("#book-rename").button({icons: {primary: "ui-icon-pencil"}, text: false})
    .click(confirmAction(renameBook));
  $("#book-delete").button({icons: {primary: "ui-icon-trash"}, text: false})
    .click(confirmAction(deleteBook));

  //================================================================
  // Add / Rename / Move / Delete notes

  var UNTITLED_NOTE = "Untitled Note";

  function getCurrentNote() {
    var note = $(".note-choice.selected");
    if (note.length) {
      return note.data("info");
    }
    return null;
  }

  // Add a note named "Untitled Note"
  buildDialog("Add Note", "prompt", "add.png", {
    name: "Add",
    fn: function (args, name) {
      var book = args.book;
      name = name || UNTITLED_NOTE;
      var data = {name: name, bid: book.bid};
      $.post('/note/new', data, function (data) {
        getLists(data.list, data.bid, data.nid);
      }).fail(showError);
    }    
  });

  function addNote() {
    var book = getCurrentBook();
    openDialog("Add Note", ["Enter the note's name:"], {book: book});
  }

  // Rename a note
  buildDialog("Rename Note", "prompt", "rename.png", {
    name: "Rename",
    fn: function (args, name) {
      var note = args.note;
      if (!name) return;
      var data = {action: 'rename', name: name};
      $.post('/note/' + note.nid, data, function (data) {
        getLists(data, note.bid, note.nid);
      }).fail(showError);
    }
  });

  function renameNote() {
    var note = getCurrentNote();
    openDialog("Rename Note",
               ["Current name: " + note.name, "Enter the new name:"],
               {note: note}, note.name);
  }

  // Move a note
  function moveNote(nid, bid) {
    var note = getCurrentNote();
    var data = {action: 'move', dest: bid};
    $.post('/note/' + nid, data=data, function (data) {
      if (note && note.nid === nid) {
        getLists(data, bid, nid);
      } else {
        getLists(data, note.bid, note.nid);
      }
    }).fail(showError);
  }

  // Delete a note
  buildDialog("Delete Note", "confirm", "delete.png", {
    name: "Delete",
    fn: function (args) {
      var note = args.note;
      var data = {action: 'delete'};
      $.post('/note/' + note.nid, data=data, function (data) {
        getLists(data, note.bid);
      }).fail(showError);
    }
  });

  function deleteNote() {
    var note = getCurrentNote();
    openDialog("Delete Note", ["Delete note: " + note.name + "?"],
               {note: note});
  }

  $("#note-add").button({icons: {primary: "ui-icon-plusthick"}, text: false})
    .click(confirmAction(addNote));
  $("#note-rename").button({icons: {primary: "ui-icon-pencil"}, text: false})
    .click(confirmAction(renameNote));
  $("#note-delete").button({icons: {primary: "ui-icon-trash"}, text: false})
    .click(confirmAction(deleteNote));

  //================================================================
  // Display and edit note

  var currentBuffer = null;

  function displayNote(data, opts) {
    var defaultOpts = {keepEditor: false, oldScrollRatio: [0, 1], markClean: true};
    opts = (typeof(opts) === "undefined") ? defaultOpts : $.extend(defaultOpts, opts);
    if (data) {
      // Has something to display
      if (!(typeof(data.name) === "undefined")) {
        $("#content-name").text(data.name).attr("title", data.name);
        $("title").text(data.name + " - a9");
      }
      var buffer = $("<div class=buffer>")
        .html(marked(data.raw)).appendTo('#content');
      currentBuffer = buffer;
      buffer.find("a").attr("target", "_blank");
      buffer.find("a[href^='#']").attr("target", null);
      buffer.find("table").wrap("<div class=table-wrapper></div>");
      MathJax.Hub.Queue([svgHack, buffer],
                        ["Typeset", MathJax.Hub, buffer[0]],
                        [flipBuffer, buffer, opts.oldScrollRatio]);
      if (!opts.keepEditor) {
        myCodeMirror.setValue(data.raw);
        myCodeMirror.clearHistory();
      }
      if (opts.markClean) {
        myCodeMirror.markClean();
      }
      $("#cover").addClass("hidden");
    } else {
      // Ignore the options
      var note = getCurrentNote();
      if (!note) {
        // No note selected
        $("#content-name").empty().attr("title", "");
        $("#content").empty();
        myCodeMirror.setValue("");
        myCodeMirror.markClean();
        $("#cover").removeClass("hidden");
        $("title").text("a9");
      } else {
        // Loading
        $("#content").empty().append($("<div class=rendering>Loading ...</div>"));
        $.get('/note/' + note.nid, function (data) {
          displayNote(data);
        }).fail(showError);
      }
    }
    setCountdown(false);
  }

  function setCountdown(enable) {
    if (changeCountdown !== null) {
      window.clearTimeout(changeCountdown);
    }
    if (enable) {
      var currentId = window.setTimeout(function () {
        if (changeCountdown === currentId) {
          displayNote({raw: myCodeMirror.getValue()}, {
            keepEditor: true,
            oldScrollRatio: getScrollRatio(),
            markClean: false
          });
        }
      }, AUTO_UPDATE_INTERVAL);
      changeCountdown = currentId;
    }
  }

  function svgHack(div) {
    if (SVGHack !== undefined) {
      $(div).find('svg').each(function(i, elt) {
        SVGHack.process(elt);
      });
    }
  }

  function flipBuffer(div, oldScrollRatio) {
    if (div !== currentBuffer) return;
    div.removeClass('buffer');
    $('#content > div').not(div).remove();
    scrollDisplay(oldScrollRatio);
  }

  // Scroll Ratio = height over the fold : height under the fold
  // Return the fraction form to prevent division by 0
  function getScrollRatio() {
    var upperScroll = $("#content-frame").scrollTop(),
        lowerScroll = $("#content").outerHeight() -
          $("#content-frame").innerHeight() - upperScroll;
    if (lowerScroll <= 0) {
      return [1, 0];    // Default: scroll to bottom if possible
    } else {
      return [upperScroll, lowerScroll];
    }
  }

  function scrollDisplay(scrollRatio) {
    $("#content-frame").scrollTop(Math.max(0,
        ($("#content").outerHeight() - $("#content-frame").innerHeight())
        * scrollRatio[0] * 1. / (scrollRatio[0] + scrollRatio[1])));
  }

  function saveNote(callBack) {
    if (!checkChange()) return;
    var note = getCurrentNote();
    var data = {action: 'save', content: myCodeMirror.getValue()};
    $.post('/note/' + note.nid, data, function (data) {
      showMessage("Saved!");
      if (typeof callBack === "function") {
        callBack();
      }
    }).fail(showError);
    if (typeof callBack !== "function") {
      displayNote({raw: data.content}, {
        keepEditor: true,
        oldScrollRatio: getScrollRatio()
      });
    }
  }

  $("#editor-save").button().click(saveNote);

  //================================================================
  // Layout / Resize

  var MARGIN_OFFSET = 6;
  var BIG_MARGIN_OFFSET = 16;

  function resize() {
    var wh = $(window).height();
    $("#lists-wrapper").height(wh);
    $(".lower-wrapper").height(function () {
      return wh - $(this).prev().height() - MARGIN_OFFSET;
    });
    $(".lower-wrapper > *").height(function () {
      return $(this).parent().height() - MARGIN_OFFSET;
    });
    $(".list").height(function () {
      return ($(this).parent().parent().height()
              - $(this).prev().height() - BIG_MARGIN_OFFSET);
    });
  }

  $(window).resize(resize);

  window.onbeforeunload = function (e) {
    if (checkChange()) {
      e.preventDefault();
    }
  };

  function showMessage(message) {
    $("#message").finish().text(message).show().delay(3000).fadeOut("slow");
  }

  function showError(message) {
    console.log(message);
    if (message.responseJSON) {
      message = message.responseJSON.error;
    } else if (message.status === 0) {
      message = "Cannot connect to the server.";
      $("#cover").removeClass("hidden");
    }
    $("#error-message").text(message);
    $("#error").finish().show().delay(3000).fadeOut("slow");
  }
  
  
  function toggleSidebar() {
    $("body").toggleClass("hide-sidebar");
    resize();
  }
  $("#sidebar-toggler").click(toggleSidebar);

  //================================================================
  // Editor

  function initializeCodeMirror() {
    myCodeMirror = CodeMirror(
      document.getElementById("editor-lower-wrapper"), {
        mode: {
          name: "markdown",
          underscoresBreakWords: false,
          fencedCodeBlocks: true,
        },
        indentUnit: 4,
        lineWrapping: true,
        matchBrackets: true,
        extraKeys: {
          "Ctrl-S": saveNote,
          "Ctrl-B": bolden,
          "Ctrl-I": italicize,
          "Ctrl-`": codify,
          "Ctrl-L": linkify,
          "Ctrl-/": superLinkify,
          "Shift-Ctrl-B": bulletify,
          "Ctrl-A": alchemy,
          "Tab": "indentMore",
          "Shift-Tab": "indentLess",
          "Home": "goLineLeft",
          "End": "goLineRight",
          "Ctrl-W": function () {},   // Prevent accidental close
          "Alt-/": autoComplete,
          "Ctrl-N": autoComplete,
          "Ctrl-Alt-0": addPinyinTone0,
          "Ctrl-Alt-1": addPinyinTone1,
          "Ctrl-Alt-2": addPinyinTone2,
          "Ctrl-Alt-3": addPinyinTone3,
          "Ctrl-Alt-4": addPinyinTone4,
          "Ctrl-Alt-5": addPinyinTone5
        }
      });
    myCodeMirror.on("changes", setCountdown);
  }

  function checkChange() {
    return !myCodeMirror.isClean();
  }

  buildDialog("Note Modified", "confirm", "question.png", {
    name: "Save",
    fn: function (args) {
      saveNote(function () {args.f.call(args.that);});
    }
  }, {
    name: "Ignore",
    fn: function (args) {
      args.f.call(args.that);
    }
  });     

  function confirmAction(f) {
    return function () {
      var that = this;
      if (!checkChange()) {
        f.call(that);
      } else {
        openDialog("Note Modified", ["Note modified. Save or ignore?"],
                   {f: f, that: that});
      }
    };
  }

  function formatFunction(symbolBefore, symbolAfter, hook) {
    if (typeof symbolAfter === 'undefined')
      symbolAfter = symbolBefore;
    return function () {
      var selected = myCodeMirror.getSelection(),
          ss = selected.length,
          sb = symbolBefore.length,
          sa = symbolAfter.length;
      if (myCodeMirror.somethingSelected()) {
        if (selected.substr(0, sb) === symbolBefore &&
            selected.substr(ss - sa, sa) === symbolAfter) {
          selected = selected.substr(sb, ss - sb - sa);
          myCodeMirror.replaceSelection(selected);
        } else {
          selected = symbolBefore + selected + symbolAfter;
          myCodeMirror.replaceSelection(selected, 'end');
          if (hook) hook();
        }
      } else {
        var currentPos = myCodeMirror.getCursor();
        myCodeMirror.replaceSelection(symbolBefore + symbolAfter);
        myCodeMirror.setCursor({line: currentPos.line, ch: currentPos.ch + sb});
      }
    };
  }
  var bolden = formatFunction("**");
  var italicize = formatFunction("_");
  var codify = formatFunction("`");
  var linkify = formatFunction("<", ">");
  var superLinkify = formatFunction("[", "]", formatFunction("(", ")"));

  // f(content) -> new content
  function manupulateSelectedLinesFunction(f) {
    return function () {
      var start = myCodeMirror.getCursor("start");
      var end = myCodeMirror.getCursor("end");
      var endLength = myCodeMirror.getLine(end.line).length;
      myCodeMirror.extendSelection({line: start.line, ch: 0},
                                   {line: end.line, ch: endLength});
      myCodeMirror.replaceSelection(f(myCodeMirror.getSelection()));
    };
  }

  var bulletify = manupulateSelectedLinesFunction(function (content) {
    return content.replace(/^( *)(.+)$/mg, '$1* $2');
  });
  var indentBlock = manupulateSelectedLinesFunction(function (content) {
    return content.replace(/^(.+)$/mg, '    $1');
  });
  var unindentBlock = manupulateSelectedLinesFunction(function (content) {
    return content.replace(/^    (.+)$/mg, '$1');
  });
  
  function autoComplete() {
    CodeMirror.showHint(myCodeMirror, CodeMirror.hint.anyword, {
      word: /[^ !-/:-@[-`{-~]+/
    });
  }

  var PINYIN_NORMAL_TO_TONED = {
    'a': 'aāáǎàa',
    'e': 'eēéěèe',
    'i': 'iīíǐìi',
    'o': 'oōóǒòo',
    'u': 'uūúǔùu',
    'v': 'vǖǘǚǜü',
    'A': 'AĀÁǍÀA',
    'E': 'EĒÉĚÈE',
    'I': 'IĪÍǏÌI',
    'O': 'OŌÓǑÒO',
    'U': 'UŪÚǓÙU',
    'V': 'VǕǗǙǛÜ'
  };
  var PINYIN_TONED_TO_NORMAL = {};
  (function () {
    for (var x in PINYIN_NORMAL_TO_TONED) {
      var chars = PINYIN_NORMAL_TO_TONED[x];
      for (var i = 0; i < chars.length; i++) {
        PINYIN_TONED_TO_NORMAL[chars[i]] = x;
      }
    }
  })();

  function addPinyinToneFunction(tone) {
    return function() {
      // Get character before the cursor
      var pos = myCodeMirror.getCursor();
      if (pos.ch == 0) return;
      var prev = {line: pos.line, ch: pos.ch - 1};
      var c = myCodeMirror.getRange(prev, pos);
      if ((c = PINYIN_TONED_TO_NORMAL[c]) === undefined) return;
      myCodeMirror.replaceRange(PINYIN_NORMAL_TO_TONED[c][tone], prev, pos);
    };
  }
  var addPinyinTone0 = addPinyinToneFunction(0);
  var addPinyinTone1 = addPinyinToneFunction(1);
  var addPinyinTone2 = addPinyinToneFunction(2);
  var addPinyinTone3 = addPinyinToneFunction(3);
  var addPinyinTone4 = addPinyinToneFunction(4);
  var addPinyinTone5 = addPinyinToneFunction(5);

  var ALCHEMY_KIT = {};
  function _alchemy_fixed(stuff) {
    stuff.forEach(function (x) {
      if (!x) return;
      for (var i = 0; i < x.length - 1; i++)
        ALCHEMY_KIT[x[i]] = x[x.length - 1];
    });
  }
  function _alchemy_flexible(stuff) {
    stuff.forEach(function (x) {
      if (!x) return;
      for (var i = 0; i < x[0].length; i++)
        for (var j = 0; j < x[1].length; j++)
          ALCHEMY_KIT[x[0][i] + x[1][j]] = ALCHEMY_KIT[x[1][j] + x[0][i]] = x[2];
    });
  }
  (function () {
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

  function alchemy() {
    myCodeMirror.openDialog('Ingredients: <input type=text>', function (ingredients) {
      if (ALCHEMY_KIT[ingredients] !== undefined) {
        myCodeMirror.replaceSelection(ALCHEMY_KIT[ingredients]);
      }
    });
  }

  //================================================================
  // Initialization

  (function() {
    initializeCodeMirror();
    resize();
    $(window).trigger("hashchange");
  })();
});
