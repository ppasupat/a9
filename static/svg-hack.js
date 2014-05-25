// Hacks for processing SVGs
// Requires JQuery

window.SVGHack = (function () {

  ////////////////////////////////////////////////////////////////
  // Constants & Helper Functions

  var CIRCLE_NODE_RADIUS = 16;
  var SQUARE_NODE_RADIUS = 14;
  var NONE_NODE_RADIUS = 30;
  var SPACING = 60;
  var EPSILON = 0.1;
  var FRAME_PADDING = 3;

  var DIRECTIONS = {
    N: [ 0, -1], U: [ 0, -1],
    S: [ 0,  1], D: [ 0,  1],
    E: [ 1,  0], R: [ 1,  0],
    W: [-1,  0], L: [-1,  0],
    NE: [ 1, -1], UR: [ 1, -1],
    NW: [-1, -1], UL: [-1, -1],
    SE: [ 1,  1], DR: [ 1,  1],
    SW: [-1,  1], DL: [-1,  1]
  };

  /** Generate a tag in SVG namespace */
  function S(tag, attr) {
    return $(document.createElementNS(
      "http://www.w3.org/2000/svg", tag.replace(/[<>]/g, '')))
      .attr(attr || {});
  }

  /** Parse the location string

   Syntax: one of the following
   (1) x y
   (2) refName step1 step2 ...
       - refName = name of node
       - step:
         > (optional size +) N S E W U D L R
         > (optional size +) NE NW SE SW UR UL DR DL
   
   Return: an object with fields
   - x, y
   - ref (reference node or null)
   - isRef (whether (x,y) is the coordinate of ref)

   TODO: Take rotation / scaling into account
   */
  function parseLocation(spec, parentNode, nodes) {
    var tokens = spec.split(/\s+/), refName = tokens[0], answer;
    // Simple coordinate: x y
    if (tokens.length == 2 && $.isNumeric(tokens[0]) && $.isNumeric(tokens[1])) {
      return {x: +tokens[0], y: +tokens[1], ref: null, isRef: false};
    }
    if (typeof nodes[refName] === 'undefined') {
      answer = {x: 0, y: 0, ref: null, isRef: false};
    } else {
      answer = {ref: nodes[refName], isRef: true};
      var fromMatrix = answer.ref.o[0].getCTM();
      answer.x = fromMatrix.e;
      answer.y = fromMatrix.f;
    }
    var i, t, a = SPACING;
    for (i = 1; i < tokens.length; i++) {
      t = tokens[i];
      if ($.isNumeric(t)) {
        a = (+t);
      } else {
        var d = DIRECTIONS[t.toUpperCase()];
        if (typeof d !== 'undefined') {
          answer.x += d[0] * a;
          answer.y += d[1] * a;
          answer.isRef = false;
        }
        a = SPACING;
      }
    }
    var toMatrix = parentNode[0].getCTM();
    if (toMatrix) {
      answer.x -= toMatrix.e;
      answer.y -= toMatrix.f;
    }
    return answer;
  }

  /** Parse the alignment string */
  function parseAlign(text) {
    var hAlign = 'center', vAlign = 'middle';
    text.toUpperCase().split('').forEach(function (c) {
      if (c === 'N' || c === 'U') {
        vAlign = 'top';
      } else if (c === 'S' || c === 'D') {
        vAlign = 'bottom';
      } else if (c === 'E' || c === 'R') {
        hAlign = 'right';
      } else if (c === 'W' || c === 'L') {
        hAlign = 'left';
      }
    });
    return {hAlign: hAlign, vAlign: vAlign};
  }

  function translateArg(x, y) {
    return 'translate(' + (+x) + ',' + (+y) + ')';
  }

  function rotateArg(angle) {
    return 'rotate(' + (angle * 180 / Math.PI) + ')';
  }

  /** compute the angle in range (-PI <= value < PI) */
  function normalizeAngle(angle) {
    while (angle < -Math.PI) angle += 2 * Math.PI;
    while (angle >= Math.PI) angle -= 2 * Math.PI;
    return angle;
  }

  /** Compute the angle from point a to b (-PI <= value < PI)
   where the y-axis points down (SVG)
   */
  function computeAngle(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  /** Compute the intersection point between
   - ray from the center of "from" with angle "angle", and
   - the boundary of "from"
   */
  function computeCutPoint(from, angle) {
    if (!from.isRef)
      return {x: from.x, y: from.y};
    if (from.ref.type === 'circle') {
      // Circle
      return {
        x: from.x + from.ref.r * Math.cos(angle),
        y: from.y + from.ref.r * Math.sin(angle)
      };
    } else {
      // Rectangle
      angle = normalizeAngle(angle);
      var theta = Math.atan2(from.ref.h, from.ref.w),
          offset = normalizeAngle(angle - theta),
          x = from.x, y = from.y;
      if (offset > Math.PI - 2 * theta) {
        // Left
        x -= from.ref.w / 2;
        y -= Math.tan(angle) * from.ref.w / 2;
      } else if (offset > 0) {
        // Top
        x += Math.tan(Math.PI/2 - angle) * from.ref.h / 2;
        y += from.ref.h / 2;
      } else if (offset > - 2 * theta) {
        // Right
        x += from.ref.w / 2;
        y += Math.tan(angle) * from.ref.w / 2;
      } else {
        // Bottom
        x -= Math.tan(Math.PI/2 - angle) * from.ref.h / 2;
        y -= from.ref.h / 2;
      }
      return {x: x, y: y};
    }
  }

  ////////////////////////////////////////////////////////////////
  // Create elements

  ////////////////
  // Node

  /** Create a node.

   Tag Arguments:
   - type: either 'circle', 'square', or 'none'
   - x, y: absolute location
   - l: relative location (overrides x and y)
   - r: radius
   - w, h: width and height (overrides r)
   - fill: fill color
   - name: name for future reference
   - text: node text
   */
  function createNode(elt, nodes, type) {
    elt = $(elt);
    var node = {
      x: +elt.attr('x'),
      y: +elt.attr('y'),
      r: +elt.attr('r'),
      fill: elt.attr('fill') || 'white',
      stroke: elt.attr('stroke') || null,
      type: elt.attr('type') || type || 'circle',
      name: elt.attr('name'),
      text: elt.attr('text'),
      o: S('<g>')
    };
    if (!node.r) {
      if (node.type === 'circle')
        node.r = CIRCLE_NODE_RADIUS;
      else if (node.type === 'square')
        node.r = SQUARE_NODE_RADIUS;
      else
        node.r = NONE_NODE_RADIUS;
    }
    node.w = +elt.attr('w') || node.r * 2;
    node.h = +elt.attr('h') || node.r * 2;
    // Location
    if (typeof elt.attr('l') !== 'undefined') {
      var location = parseLocation(elt.attr('l'), elt.parent(), nodes);
      node.x = location.x;
      node.y = location.y;
    }
    if (Number.isNaN(node.x)) node.x = 0;
    if (Number.isNaN(node.y)) node.y = 0;
    node.o.attr('transform', translateArg(node.x, node.y));
    // Enclosure
    if (node.type === 'circle') {
      node.o.append(S('<circle>', {
        'r': node.r,
        'fill': node.fill,
        'stroke': node.stroke
      }));
    } else if (node.type === 'none') {
      // Do nothing ...
    } else if (node.type === 'square' || node.type === 'rect') {
      node.o.append(S('<rect>', {
        'x': - node.w / 2,
        'y': - node.h / 2,
        'width': node.w,
        'height': node.h,
        'fill': node.fill,
        'stroke': node.stroke
      }));
    }
    // Label
    if (node.text) {
      node.o.append(S('<foreignObject>', {
        'x': - node.w / 2,
        'y': - node.h / 2,
        'width': node.w,
        'height': node.h
      }).append($('<div>').css({
        'line-height': '' + node.h + 'px',
        'text-align': 'center'
      }).html(node.text)));
    }
    // Update
    elt.replaceWith(node.o);
    if (typeof node.name !== 'undefined') {
      nodes[node.name] = node;
    }
  }

  ////////////////
  // Edge

  /** Create an edge.

   Tag Arguments:
   - type: either '--' or '->'
   - from, to: edge endpoints (either a node name or a relative location)
   - stroke: edge color
   */
  function createEdge(elt, nodes, type) {
    elt = $(elt);
    var edge = {
      from: parseLocation(elt.attr('from'), elt.parent(), nodes),
      to: parseLocation(elt.attr('to'), elt.parent(), nodes),
      type: elt.attr('type') || type || '--',
      stroke: elt.attr('stroke') || "black",
      o: S('<g>')
    };
    edge.angle = computeAngle(edge.from, edge.to);
    edge.aFrom = computeCutPoint(edge.from, edge.angle);
    edge.aTo = computeCutPoint(edge.to, edge.angle - Math.PI);
    edge.o.append(S('<line>', {
      x1: edge.aFrom.x,
      y1: edge.aFrom.y,
      x2: edge.aTo.x,
      y2: edge.aTo.y,
      stroke: edge.stroke
    }));
    if (edge.type === '->') {
      // Add the arrowhead
      edge.o.append(S('<polygon>', {
        points: "0,0 -6,3 -6,-3",
        stroke: "none",
        fill: edge.stroke,
        transform: (translateArg(edge.aTo.x, edge.aTo.y)
                    + ' ' + rotateArg(edge.angle))
      }));
    }
    // Update
    elt.replaceWith(edge.o);
  }

  ////////////////
  // Frame

  /** Create a frame.

   Tag Arguments:
   - x, y: absolute location of TOP LEFT CORNER
   - l: relative location of CENTER (overrides x and y)
   - w, h: width and height
   - fill: fill color
   - stroke: stroke color
   - text: node text
   - align: text alignment
   - padding: amount of padding
   */
  function createFrame(elt, nodes) {
    elt = $(elt);
    var frame = {
      x: +elt.attr('x'),
      y: +elt.attr('y'),
      w: +elt.attr('w'),
      h: +elt.attr('h'),
      fill: elt.attr('fill') || 'white',
      stroke: elt.attr('stroke') || null,
      align: parseAlign(elt.attr('align') || ""),
      padding: +(elt.attr('padding') || FRAME_PADDING),
      text: elt.attr('text'),
      o: S('<g>')
    };
    // Location
    if (typeof elt.attr('l') !== 'undefined') {
      var location = parseLocation(elt.attr('l'), elt.parent(), nodes);
      frame.x = location.x - frame.w / 2;
      frame.y = location.y - frame.h / 2;
    }
    if (Number.isNaN(frame.x)) frame.x = 0;
    if (Number.isNaN(frame.y)) frame.y = 0;
    frame.o.attr('transform', translateArg(frame.x, frame.y));
    // Enclosure
    frame.o.append(S('<rect>', {
      'x': 0,
      'y': 0,
      'width': frame.w,
      'height': frame.h,
      'fill': frame.fill,
      'stroke': frame.stroke
    }));
    // Label
    if (frame.text) {
      frame.o.append(S('<foreignObject>', {
        'x': 0,
        'y': 0,
        'width': frame.w,
        'height': frame.h
      }).append($('<div>').css({
        'display': 'table-cell',
        'width': frame.w,
        'height': frame.h - 2 * frame.padding,
        'text-align': frame.align.hAlign,
        'vertical-align': frame.align.vAlign,
        'padding': '' + frame.padding + 'px'
      }).html(frame.text)));
    }
    // Update
    elt.replaceWith(frame.o);
  }

  ////////////////
  // For Loop

  /** Process a for-loop shorthand tag
   
   Template variables can be defined by adding arguments:
   (1) _KEY="VALUE0|VALUE1|VALUE2"
       --> KEY[0] = VALUE0, KEY[1] = VALUE1, KEY[2] = VALUE2
   (2) __KEY="NUMSTEP|STEPSIZE|STARTVALUE"
       --> KEY[i] = STARTVALUE + (i - 1) * STEPSIZE
           for i = 0, ..., (NUMSTEP - 1)
       NUMSTEP is defaulted to 1
       STEPSIZE is defaulted to 1
       STARTVALUE is defaulted to 0
   
   Any occurrence of "#{KEY}" in a child tag's argument value
   will be replaced with the KEY[i] in iteration i

   If template variables have unequal number of values,
   the shorter value lists will be padded with empty strings.
   */
  function processForLoop(elt) {
    var copies = [],
        attributes = elt[0].attributes,
        mappings = [],
        sep = elt.attr('sep') || '|',
        n = 1, i, j;
    // Parse attributes
    for (i = 0; i < attributes.length; i++) {
      var name = attributes[i].nodeName || '', values,
          tokens = (attributes[i].nodeValue || '').split(sep);
      if (name[0] === '_') {
        if (name[1] === '_') {
          name = name.slice(2);
          values = [];
          var numSteps = tokens[0] ? +tokens[0] : 1,
              stepSize = tokens[1] ? +tokens[1] : 1,
              startValue = tokens[2] ? +tokens[2] : 0;
          for (j = 0; j < numSteps; j++) {
            values.push("" + (j * stepSize + startValue));
          }
        } else {
          name = name.slice(1);
          values = tokens;
        }
        mappings.push(["#{" + name + "}", values]);
        n = Math.max(n, values.length);
      }
    }
    // Make copies
    for (i = 0; i < n; i++) {
      var copy = S('<g>');
      elt.children().each(function (j, x) {
        copy.append(x.cloneNode(true));
      });
      copies.push(copy);
      copy.find('*').each(function (j, x) {
        var attributes = x.attributes;
        for (var k = 0; k < attributes.length; k++) {
          var name = attributes[k].nodeName || '',
              value = attributes[k].nodeValue || '';
          mappings.forEach(function (keyvalue) {
            value = value.replace(
              keyvalue[0], keyvalue[1][Math.min(keyvalue[1].length - 1, i)]);
          });
          $(x).attr(name, value);
        }
      });
    }
    elt.replaceWith(copies);
  }

  ////////////////////////////////////////////////////////////////
  // Processing
  
  return {
    process: function (root) {
      root = $(root);
      try {
        // Set defaults
        root.attr({
          'stroke': root.attr('stroke') || 'black',
          'fill': root.attr('fill') || 'white'
        });
        // For loop
        while (root.find('for').length) {
          processForLoop(root.find('for').first());
        }
        // Tweak elements
        var nodes = {};
        root.find('*').each(function (i, elt) {
          var tagName = elt.tagName.toLowerCase();
          if (tagName === "node") {
            createNode(elt, nodes);
          } else if (tagName === "label") {
            createNode(elt, nodes, "none");
          } else if (tagName === "frame") {
            createFrame(elt, nodes);
          } else if (tagName === "edge") {
            createEdge(elt, nodes);
          } else if (tagName === "arrow") {
            createEdge(elt, nodes, "->");
          }
        });
      } catch (error) {
        root.replaceWith($('<div class="svg-error">')
                         .text('SVG Hack Error: ' + error));
        console.log(error);     // For debugging
      }
    }
  };

})();
