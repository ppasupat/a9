$(function() {

  //================================================================
  // Display note

  var currentBuffer = null;

  function displayNote(data) {
    $('#content-name').text(data.name).attr('title', data.name);
    $('title').text(data.name + ' - a9');
    $('#content-time').text('Exported: ' + data.time);
    var buffer = $('<div class=buffer>').appendTo('#content');
    currentBuffer = buffer;
    MathJax.Hub.Queue(
        [renderMarkdown, buffer, data.raw],
        [flipBuffer, buffer],
        [scrollDisplay],
        [svgHack, buffer],
        ['Typeset', MathJax.Hub, buffer[0]],
        [scrollDisplay],
        [removeCover]);
  }

  function renderMarkdown(div, rawMarkdown) {
    div.html(marked(rawMarkdown));
    div.find('a').attr('target', '_blank');
    div.find('a[href^="#"]').attr('target', null);
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
    $('#content-frame').show();
    div.removeClass('buffer');
    $('#content > div').not(div).remove();
    $('#content-frame > .rendering').fadeOut('fast');
  }

  function scrollDisplay() {
    $('#content-frame').scrollTop(0);
  }

  function removeCover() {
    $('#cover').addClass('hidden');
  }

  function showError(message) {
    console.log(message);
    if (message.responseJSON) {
      message = message.responseJSON.error;
    } else if (message.status === 0) {
      message = 'Cannot connect to the server.';
      $('#cover').removeClass('hidden');
    } else if (message.status === 404) {
      message = 'Note not found.';
    }
    $('#error-message').text(message);
    $('#error').show();
  }
  
  //================================================================
  // Initialization

  // Retrieve the GET parameter
  function gup(name) {
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
    var results = regex.exec(window.location.href);
    if (results === null) {
      return "";
    } else {
      return decodeURIComponent(results[1]);
    }
  }

  function loadData(nid) {
    if (!nid) {
      // No note selected
      $('#content-name').empty().attr('title', '');
      $('#content').empty();
      $('#cover').removeClass('hidden');
      $('title').text('a9');
    } else {
      // Loading
      $('#cover').addClass('loading').removeClass('hidden');
      $.getJSON('data/' + nid + '.json', displayNote).fail(showError);
    }
  }

  loadData(gup('nid'));
});
