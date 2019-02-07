$(function() {

  var myCodeMirror, changeCountdown = null, bookNoteList, bidMap, nidMap, sMap;
  var AUTO_UPDATE_INTERVAL = 1000;

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
    $('#booklist').empty();
    bidMap = {};
    bookNoteList.books.forEach(function (book) {
      bidMap[book.bid] = $('<div>').text(book.name).attr('title', book.name)
        .addClass('book-choice choice cutoff')
        .droppable({
          accept: function (draggable) {
            if (!$(draggable).hasClass('note-choice')) return false;
            var offset = $(this).offset().top,
                height = $(this).outerHeight(),
                parentOffset = $('#booklist').offset().top,
                parentHeight = $('#booklist').innerHeight();
            return (offset + height > parentOffset &&
                    offset < parentOffset + parentHeight);
          },
          activeClass: 'ui-state-default',
          hoverClass: 'ui-state-hover',
          drop: function(event, ui) {
            if ($(this).hasClass('selected')) return;
            moveNote(ui.draggable.data('info').nid, book.bid);
          }
        })
        .data('info', book).appendTo('#booklist');
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
    $('.book-choice').removeClass('selected');
    bidMap[bid].addClass('selected');
    populateNoteList(nid);
  }

  function populateNoteList(nid) {
    var book = getCurrentBook();
    $('#notelist').empty();
    nidMap = {};
    book.notes.forEach(function (note) {
      nidMap[note.nid] = $('<div>').text(note.name).attr('title', note.name)
        .addClass('note-choice choice cutoff')
        .draggable({
          appendTo: 'body',
          helper: function () { return $('<img>').attr('src', 'static/icons/favicon-pad.png')[0]; },
          delay: 50,
          cursorAt: {'left': 18},
        })
        .data('info', note).appendTo('#notelist');
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
    $('.note-choice').removeClass('selected');
    nidMap[nid].addClass('selected');
    displayNote();
    window.location.hash = '#' + nid;
    // Need to refresh the favicon
    var href = $('link[rel="shortcut icon"]').remove().attr('href');
    $('head').append('<link type="image/x-icon" rel="shortcut icon" href="' + href + '">');
  }

  $('#booklist').on('click', '.book-choice', confirmAction(function () {
    selectBook($(this).data('info').bid);
  }));

  $('#notelist').on('click', '.note-choice', confirmAction(function () {
    selectNote($(this).data('info').nid);
  }));

  $(window).on('hashchange', function (e) {
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
    var dialog = $('<div>').dialog({
      autoOpen: false,
      modal: true,
      buttons: buttons,
      title: title,
      width: 420,
    }).append($('<img>').attr('src', 'static/icons/' + icon));
    var rightPane = $('<div class="right-pane">')
          .append($('<div class="dialog-text">')).appendTo(dialog);
    var input;
    if (type === 'prompt') {
      dialog.addClass('dialog-prompt');
      input = $('<input type="text" class="dialog-input">')
        .keyup(function (e) {
          if ((e.keyCode || e.which) === 13) {
            dialog.dialog('close');
            submit.fn(dialog.data('args'), input.val());
          } 
        }).appendTo(rightPane);
    } else if (type === 'switch') {
        dialog.addClass('dialog-switch');
    } else if (type === 'confirm') {
      dialog.addClass('dialog-confirm');
    } else if (type === 'alert') {
      dialog.addClass('dialog-alert');
    }

    var buttons = [];
    if (submit !== undefined) {
      buttons.push({
        text: submit.name,
        click: function () {
          dialog.dialog('close');
          submit.fn(dialog.data('args'), input && input.val());
        }
      });
    }
    if (ignore !== undefined) {
      buttons.push({
        text: ignore.name,
        click: function () {
          dialog.dialog('close');
          ignore.fn(dialog.data('args'), input && input.val());
        }
      });
    }
    buttons.push({
      text: 'Cancel',
      click: function() {dialog.dialog('close');}
    });
    dialog.dialog('option', 'buttons', buttons);

    DIALOGS[title] = dialog;
  }

  var switcher = null;
  function buildSwitcher() {
    if (switcher == null) {
      var dialog = $('<div>').dialog({
        autoOpen: false,
        modal: true,
        title: 'Note Switcher',
        width: 420,
        height: 400
      });
      
      input = $('<input type="text" class="dialog-input"><br/><br/>')
        .keyup(function (e) {
          if ((e.keyCode || e.which) == 40) {
            // down arrow key
            selectedItem = dialog.find('.selected');
            nextItem = selectedItem.next();
            if ( nextItem.hasClass('switch-book') ) {
              highlightSwitchBook(nextItem.data('book').bid);
            } else if ( nextItem.hasClass('switch-note') ) {
              highlightSwitchNote(nextItem.data('book').bid, nextItem.data('note').nid);
            }
          } else if ((e.keyCode || e.which) == 38) {
            // up arrow key
            selectedItem = dialog.find('.selected');
            prevItem = selectedItem.prev();
            if ( prevItem.hasClass('switch-book') ) {
              highlightSwitchBook(prevItem.data('book').bid);
            } else if ( prevItem.hasClass('switch-note') ) {
              highlightSwitchNote(prevItem.data('book').bid, prevItem.data('note').nid);
            }
          } else if ((e.keyCode || e.which) == 13) {
            // enter key
            selectedItem = dialog.find('.selected');
            if ( selectedItem.hasClass('switch-book') ) {
              selectSwitchBook(selectedItem.data('book').bid);
            } else if ( selectedItem.hasClass('switch-note') ) {
              selectSwitchNote(selectedItem.data('book').bid,
                       selectedItem.data('note').nid);
            }
            dialog.dialog('close');
          } else {
            repopulateSwitcher(input.val());
          }
        }).appendTo(dialog);
      
      var booklist = $('<div id="dialoglist" class="list">').appendTo(dialog);
      
      switcher = dialog;
    }
    
    repopulateSwitcher("");
  }

  function highlightBook(bid, nid) {
    $('.book-choice').removeClass('selected');
    bidMap[bid].addClass('selected');
  }
  
  function repopulateSwitcher(partialTitle) {
    // get books (and notes) with partial title
    $('#dialoglist').empty();
    sMap = {};
    var curBook = getCurrentBook();
    var curNote = getCurrentNote();

    var noteInList = false;
    
    bookNoteList.books.forEach(function (book) {
      if (book.name.toLowerCase().match(partialTitle.toLowerCase())) {
        sMap[book.bid] = $('<div>').text(book.name).attr('title', book.name)
          .addClass('switch-choice switch-book choice cutoff')
          .data('book', book).appendTo('#dialoglist');
      }

      if (partialTitle === '') {
        // wait for some text
        return;
      }

      // Also append the notes in the book if we have some more search information
      book.notes.forEach(function (note) {
        if (note.name.toLowerCase().match(partialTitle.toLowerCase())) {
          sMap[note.nid] = $('<div>').text('# ' + note.name).attr('title', note.name)
            .addClass('switch-choice switch-note choice cutoff')
            .data('note', note).data('book', book).appendTo('#dialoglist');
          
          if (note.nid === curNote.nid) {
            noteInList = true;
          }
        }
      });
    });

    if (noteInList === true) {
      highlightSwitchNote(curBook.bid, curNote.nid);
    } else {
      firstItem = switcher.find('#dialoglist').find('.choice').first();
      if ( firstItem.hasClass('switch-book') ) {
        highlightSwitchBook(firstItem.data('book').bid);
      } else if ( firstItem.hasClass('switch-note') ) {
        highlightSwitchNote(firstItem.data('book').bid, firstItem.data('note').nid);
      } else {
        console.log(firstItem);
      }
    }
  }

  function highlightSwitchBook(bid) {
      $('.switch-choice').removeClass('selected');
      sMap[bid].addClass('selected');
  }

  function selectSwitchBook(bid) {
      highlightSwitchBook(bid);
      selectBook(bid);
  }

  function highlightSwitchNote(bid, nid) {
      $('.switch-choice').removeClass('selected');
      sMap[nid].addClass('selected');
  }

  function selectSwitchNote(bid, nid) {
      highlightSwitchNote(bid, nid);
      selectBook(bid);
      selectNote(nid);
  }
    
  function openSwitcher() {
      switcher.dialog('open');
  }

  function openDialog(title, texts, args, defaultText) {
    var dialog = DIALOGS[title];
    var dialogText = dialog.find('.dialog-text').empty();
    texts.forEach(function (item) {
      dialogText.append($('<p>').text(item));
    });
    dialog.find('input').val(defaultText || '');
    dialog.data('args', args).dialog('open');
  }
  
  //================================================================
  // Add / Rename / Delete books

  var UNTITLED_BOOK = 'Untitled Book';

  function getCurrentBook() {
    return $('.book-choice.selected').data('info');
  }

  // Add a book named 'Untitled Book'
  buildDialog('Add Book', 'prompt', 'add.png', {
    name: 'Add',
    fn: function (args, name) {
      name = name || UNTITLED_BOOK;
      var data = {name: name};
      $.post('/book/new', data, function (data) {
        getLists(data.list, data.bid);
      }).fail(showError);
    }    
  });

  function addBook() {
    openDialog('Add Book', ['Enter the book\'s name:']);
  }

  // Rename a book
  buildDialog('Rename Book', 'prompt', 'rename.png', {
    name: 'Rename',
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
      showError('Cannot rename ' + book.name + '!');
      return;
    }
    openDialog('Rename Book',
               ['Current name: ' + book.name, 'Enter the new name:'],
               {book: book, note: note}, book.name);
  }

  // Delete a book
  buildDialog('Delete Book', 'confirm', 'delete.png', {
    name: 'Delete',
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
      showError('Cannot delete ' + book.name + '!');
      return;
    }
    openDialog('Delete Book', ['Delete book: ' + book.name + '?'],
               {book: book});
  }

  $('#book-add').button({icons: {primary: 'ui-icon-plusthick'}, text: false})
    .click(confirmAction(addBook));
  $('#book-rename').button({icons: {primary: 'ui-icon-pencil'}, text: false})
    .click(confirmAction(renameBook));
  $('#book-delete').button({icons: {primary: 'ui-icon-trash'}, text: false})
    .click(confirmAction(deleteBook));

  //================================================================
  // Add / Rename / Move / Delete notes

  var UNTITLED_NOTE = 'Untitled Note';

  function getCurrentNote() {
    var note = $('.note-choice.selected');
    if (note.length) {
      return note.data('info');
    }
    return null;
  }

  // Add a note named 'Untitled Note'
  buildDialog('Add Note', 'prompt', 'add.png', {
    name: 'Add',
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
    openDialog('Add Note', ['Enter the note\'s name:'], {book: book});
  }

  // Rename a note
  buildDialog('Rename Note', 'prompt', 'rename.png', {
    name: 'Rename',
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
    openDialog('Rename Note',
               ['Current name: ' + note.name, 'Enter the new name:'],
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
  buildDialog('Delete Note', 'confirm', 'delete.png', {
    name: 'Delete',
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
    openDialog('Delete Note', ['Delete note: ' + note.name + '?'],
               {note: note});
  }

  $('#note-add').button({icons: {primary: 'ui-icon-plusthick'}, text: false})
    .click(confirmAction(addNote));
  $('#note-rename').button({icons: {primary: 'ui-icon-pencil'}, text: false})
    .click(confirmAction(renameNote));
  $('#note-delete').button({icons: {primary: 'ui-icon-trash'}, text: false})
    .click(confirmAction(deleteNote));

  // Export a note
  buildDialog('Export Note', 'prompt', 'rename.png', {
    name: 'Export',
    fn: function (args, name) {
      if (!name) return;
      saveNote(function (data) {
        // Render Markdown + svgHack
        var div = $('<div>').appendTo('body')
          .css({'position': 'fixed', 'visibility': 'hidden'});
        renderMarkdown(div, data.raw, true);
        svgHack(div);
        // Submit to the server
        var submit_data = {action: 'export', content: div.html(), name: name};
        div.remove();
        $.post('/note/' + data.nid, submit_data, function () {
          showMessage('Exported!');
          window.open('/viewer/' + data.nid + '.html', '_blank');
        });

      });
    }
  });

  function exportNote() {
    var note = getCurrentNote();
    openDialog('Export Note',
               ['Enter a name for the exported note:'],
               {}, note.name);
  }
    
  $('#editor-export').button().click(exportNote);

  //================================================================
  // Display and edit note

  var currentBuffer = null;

  function displayNote(data, opts) {
    var defaultOpts = {keepEditor: false, oldScrollRatio: [0, 1], markClean: true};
    opts = (typeof(opts) === 'undefined') ? defaultOpts : $.extend(defaultOpts, opts);
    if (data) {
      // Has something to display
      if (typeof(data.name) !== 'undefined') {
        $('#content-name').text(data.name).attr('title', data.name);
        $('title').text(data.name + ' - a9');
      }
      var buffer = $('<div class=buffer>').appendTo('#content');
      currentBuffer = buffer;
      if (opts.quick) {
        MathJax.Hub.Queue(
            [renderMarkdown, buffer, data.raw],
            [flipBuffer, buffer],
            [scrollDisplay, opts.oldScrollRatio],
            [svgHack, buffer],
            ['Typeset', MathJax.Hub, buffer[0]],
            [scrollDisplay, opts.oldScrollRatio]);
      } else {
        MathJax.Hub.Queue(
            [renderMarkdown, buffer, data.raw],
            [svgHack, buffer],
            ['Typeset', MathJax.Hub, buffer[0]],
            [flipBuffer, buffer],
            [scrollDisplay, opts.oldScrollRatio]);
      }
      if (!opts.keepEditor) {
        myCodeMirror.setValue(data.raw);
        myCodeMirror.clearHistory();
      }
      if (opts.markClean) {
        myCodeMirror.markClean();
      }
      $('#cover').addClass('hidden');
    } else {
      // Ignore the options
      var note = getCurrentNote();
      if (!note) {
        // No note selected
        $('#content-name').empty().attr('title', '');
        $('#content').empty();
        myCodeMirror.setValue('');
        myCodeMirror.markClean();
        $('#cover').removeClass('hidden');
        $('title').text('a9');
      } else {
        // Loading
        $('.rendering').remove();
        $('#content-frame').prepend($('<div class=rendering>Loading ...</div>'));
        $.get('/note/' + note.nid, function (data) {
          displayNote(data, {quick: true});
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

  function renderMarkdown(div, rawMarkdown, isExport) {
    div.html(marked(rawMarkdown));
    div.find('a').attr('target', '_blank');
    div.find('a[href^="#"]').attr('target', null);
    div.find('img').each(function (i, x) {
      if ($(x).attr('alt')) {
        $(x).attr('title', $(x).attr('alt'));
      }
    });
    if (isExport) {
      div.find('a[href^="#"]').each(function (i, x) {
        $(x).attr('href', $(x).attr('href').replace(/^#/, '') + '.html');
      });
    }
    div.find('table').wrap('<div class=table-wrapper></div>');
  }

  function svgHack(div) {
    if (SVGHack !== undefined) {
      $(div).find('svg').each(function(i, elt) {
        SVGHack.process(elt);
      });
    }
  }

  function flipBuffer(div) {
    if (div !== currentBuffer) return;
    div.removeClass('buffer');
    $('#content > div').not(div).remove();
    $('#content-frame > .rendering').fadeOut('fast');
  }

  // Scroll Ratio = height over the fold : height under the fold
  // Return the fraction form to prevent division by 0
  function getScrollRatio() {
    var upperScroll = $('#content-frame').scrollTop(),
        lowerScroll = $('#content').outerHeight(true) -
          $('#content-frame').innerHeight() - upperScroll;
    if (lowerScroll <= 0) {
      return [1, 0];    // Default: scroll to bottom if possible
    } else {
      return [upperScroll, lowerScroll];
    }
  }

  function scrollDisplay(scrollRatio) {
    $('#content-frame').scrollTop(Math.max(0,
        ($('#content').outerHeight(true) - $('#content-frame').innerHeight())
        * scrollRatio[0] * 1. / (scrollRatio[0] + scrollRatio[1])));
  }

  function saveNote(callBack) {
    var note = getCurrentNote();
    var data = {action: 'save', content: myCodeMirror.getValue()};
    $.post('/note/' + note.nid, data, function (data) {
      showMessage('Saved!');
      if (typeof callBack === 'function') {
        callBack(data);
      }
    }).fail(showError);
    displayNote({raw: data.content}, {
      keepEditor: true,
      oldScrollRatio: getScrollRatio()
    });
  }

  $('#editor-save').button().click(saveNote);

  //================================================================
  // Layout / Resize

  var MARGIN_OFFSET = 6;
  var BIG_MARGIN_OFFSET = 16;

  function resize() {
    var wh = $(window).height();
    $('.lower-wrapper').height(function () {
      return wh - $(this).prev().height() - MARGIN_OFFSET;
    });
    $('.lower-wrapper > *').height(function () {
      return $(this).parent().height() - MARGIN_OFFSET;
    });
    $('.list').height(function () {
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
    $('#message').finish().text(message).show().delay(3000).fadeOut('slow');
  }

  function showError(message) {
    console.log(message);
    if (message.responseJSON) {
      message = message.responseJSON.error;
    } else if (message.status === 0) {
      message = 'Cannot connect to the server.';
      $('#cover').removeClass('hidden');
    }
    $('#error-message').text(message);
    $('#error').finish().show().delay(3000).fadeOut('slow');
  }
  
  
  function toggleSidebar() {
    $('body').toggleClass('hide-sidebar');
    resize();
  }
  $('#sidebar-toggler').click(toggleSidebar);

  //================================================================
  // Editor

    function initializeCodeMirror() {
    myCodeMirror = CodeMirror(
      document.getElementById('editor-lower-wrapper'), {
        mode: {
          name: 'markdown',
          underscoresBreakWords: false,
          fencedCodeBlocks: true,
        },
        indentUnit: 4,
        lineWrapping: true,
        matchBrackets: true,
        extraKeys: {
          'Ctrl-S': saveNote,
          'Shift-Ctrl-S': exportNote,
          'Ctrl-B': bolden,
          'Ctrl-I': italicize,
          'Ctrl-`': codify,
          'Ctrl-L': linkify,
          'Ctrl-/': superLinkify,
          'Shift-Ctrl-6': supify,
          'Ctrl-.': supify,
          'Shift-Ctrl--': subify,
          'Ctrl-,': subify,
          'Shift-Ctrl-B': bulletify,
          'Shift-Ctrl-8': bulletify,
          'Ctrl-A': alchemy,
          'Ctrl-\'': addCitation,
          'Tab': 'indentMore',
          'Shift-Tab': 'indentLess',
          'Home': 'goLineLeft',
          'End': 'goLineRight',
          'Alt-/': autoComplete,
          'Ctrl-N': autoComplete,
          'Ctrl-Alt-0': addPinyinTone0,
          'Ctrl-Alt-1': addPinyinTone1,
          'Ctrl-Alt-2': addPinyinTone2,
          'Ctrl-Alt-3': addPinyinTone3,
          'Ctrl-Alt-4': addPinyinTone4,
          'Ctrl-Alt-5': addPinyinTone5,
          'Ctrl-K': launchSwitcher,
        }
      });
    myCodeMirror.on('changes', setCountdown);
  }

  function checkChange() {
    return !myCodeMirror.isClean();
  }

  buildDialog('Note Modified', 'confirm', 'question.png', {
    name: 'Save',
    fn: function (args) {
      saveNote(function () {args.f.call(args.that);});
    }
  }, {
    name: 'Ignore',
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
        openDialog('Note Modified', ['Note modified. Save or ignore?'],
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
  var bolden = formatFunction('**');
  var italicize = formatFunction('_');
  var codify = formatFunction('`');
  var linkify = formatFunction('<', '>');
  var superLinkify = formatFunction('[', ']', formatFunction('(', ')'));
  var supify = formatFunction('<sup>', '</sup>');
  var subify = formatFunction('<sub>', '</sub>');

  function launchSwitcher() {
    buildSwitcher();
    openSwitcher();
    
    $('#dialoglist').on('click', '.switch-book', confirmAction(function () {
        selectSwitchBook($(this).data('book').bid);
        switcher.dialog('close');
    }));

    $('#dialoglist').on('click', '.switch-note', confirmAction(function () {
        selectSwitchNote($(this).data('book').bid, $(this).data('note').nid);
        switcher.dialog('close');
    }));
  }


    $(document).keydown(
        function(e) {
            if (e.ctrlKey && (e.keyCode || e.which) == 75) {
                e.preventDefault();
                launchSwitcher();
            }
        }
    );

  // f(content) -> new content
  function manupulateSelectedLinesFunction(f) {
    return function () {
      var start = myCodeMirror.getCursor('start');
      var end = myCodeMirror.getCursor('end');
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

  function alchemy() {
    myCodeMirror.openDialog('Ingredients: <input type=text>', function (ingredients) {
      if (ALCHEMY_KIT[ingredients] !== undefined) {
        myCodeMirror.replaceSelection(ALCHEMY_KIT[ingredients]);
      }
    });
  }

  function addCitation() {
    myCodeMirror.openDialog('Title / URL: <input type=text>', function (url) {
      $.get('/cite', {'url': url}, function (response) {
        myCodeMirror.replaceSelection('<cite>' + response.citation + '</cite>');
      }).fail(showError);
    });
  }

  //================================================================
  // Initialization

  (function() {
    initializeCodeMirror();
    resize();
    $(window).trigger('hashchange');
  })();
});
