$(function() {
  
  var myCodeMirror, bookNoteList, bidMap, nidMap;

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
  }

  $("#booklist").on("click", ".book-choice", confirmAction(function () {
    selectBook($(this).data("info").bid);
  }));

  $("#notelist").on("click", ".note-choice", confirmAction(function () {
    selectNote($(this).data("info").nid);
  }));

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

  function displayNote(data, opts) {
    var defaultOpts = {keepEditor: false, oldScrollTop: 0, markClean: true};
    opts = (typeof(opts) === "undefined") ? defaultOpts : $.extend(defaultOpts, opts);
    if (data) {
      if (!(typeof(data.name) === "undefined")) {
        $("#content-name").text(data.name).attr("title", data.name);
        $("title").text(data.name + " - r9");
      }
      $("#content").html(data.html);
      $("#content a").attr("target", "_blank");
      $("#content table").wrap("<div class=table-wrapper></div>");
      MathJax.Hub.Queue([svgHack, "#content"],
                        ["Typeset", MathJax.Hub, "content"],
                        [scrollDisplay, opts.oldScrollTop]);
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
        $("#content-name").empty().attr("title", "");
        $("#content").empty();
        myCodeMirror.setValue("");
        myCodeMirror.markClean();
        $("#cover").removeClass("hidden");
        $("title").text("r9");
      } else {
        $("#cover").addClass("loading").removeClass("hidden");
        $.get('/note/' + note.nid, function (data) {
          $("#cover").removeClass("loading");
          displayNote(data);
        }).fail(showError);
      }
    }
  }

  function saveNote(callBack) {
    if (!checkChange()) return;
    var note = getCurrentNote();
    var data = {action: 'save', content: myCodeMirror.getValue()};
    $.post('/note/' + note.nid, data, function (data) {
      showMessage("Saved!");
      var oldScrollTop = $("#content-frame").scrollTop();
      if (typeof callBack === "function") {
        callBack();
      } else {
        displayNote(data, {
          keepEditor: true,
          oldScrollTop: oldScrollTop
        });
      }
    }).fail(showError);
  }

  function previewNote(callBack) {
    if (!checkChange()) return;
    var note = getCurrentNote();
    var data = {action: 'preview', content: myCodeMirror.getValue()};
    $.post('/note/' + note.nid, data, function (data) {
      var oldScrollTop = $("#content-frame").scrollTop();
      if (typeof callBack === "function") {
        callBack();
      } else {
        displayNote(data, {
          keepEditor: true,
          oldScrollTop: oldScrollTop,
          markClean: false
        });
      }
    }).fail(showError);
  }

  function svgHack(div) {
    if (SVGHack !== undefined) {
      $(div).find('svg').each(function(i, elt) {
        SVGHack.process(elt);
      });
    }
  }

  function scrollDisplay(scrollTop) {
    $("#content-frame").scrollTop(scrollTop);
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
          "Ctrl-Q": previewNote,
          "Ctrl-L": linkify,
          "Ctrl-/": superLinkify,
          "Ctrl-U": repeatCharacters,
          "Shift-Ctrl-B": bulletify,
          "Tab": "indentMore",
          "Shift-Tab": "indentLess",
          "Ctrl-A": "goLineStart",
          "Ctrl-E": "goLineEnd",
          "Ctrl-W": function () {},   // Prevent accidental close
          "Ctrl-H": addHorizontalLine,
          "Alt-/": autoComplete,
          "Ctrl-Alt-0": addPinyinTone0,
          "Ctrl-Alt-1": addPinyinTone1,
          "Ctrl-Alt-2": addPinyinTone2,
          "Ctrl-Alt-3": addPinyinTone3,
          "Ctrl-Alt-4": addPinyinTone4,
          "Ctrl-Alt-5": addPinyinTone5
        }
      });
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

  function repeatCharacters() {
    var pos = myCodeMirror.getCursor();
    if (pos.line > 0) {
      var prevLen = myCodeMirror.getLine(pos.line - 1).length;
      var curLine = myCodeMirror.getLine(pos.line), newCurLine = curLine;
      if (!curLine) return;
      while (newCurLine.length < prevLen) newCurLine += curLine;
      myCodeMirror.setLine(pos.line, newCurLine);
    }
  }

  function addHorizontalLine() {
    myCodeMirror.setLine(myCodeMirror.getCursor().line,
                         "--------------------------------" + 
                         "--------------------------------");
  }

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

  //================================================================
  // Initialization

  (function() {
    initializeCodeMirror();
    resize();
    getLists();
  })();
});
