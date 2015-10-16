#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, os, traceback
from model import Model, NamesFileError, ForbiddenOperationError
from bottle import Bottle, static_file, request, redirect
app = Bottle()

def init_directories():
    if not os.path.isdir(os.path.join(BASEDIR, 'data')):
        os.mkdir(os.path.join(BASEDIR, 'data'))
        print >> sys.stderr, 'Created "data" directory'
    if not os.path.isfile(os.path.join(BASEDIR, 'data', 'names')):
        with open(os.path.join(BASEDIR, 'data', 'names'), 'w') as fout:
            fout.write('B\t0\tUnsorted Notes\n')
        print >> sys.stderr, 'Created "data/notes" file'

################################
# Static files

@app.route('/')
def hello():
    return redirect("/index.html", code=302)

@app.route('/index.html')
def server_static():
    return static_file('index.html', root=BASEDIR)

@app.route('/static/<p:path>')
def server_static(p):
    return static_file(os.path.join('static', p), root=BASEDIR)

@app.route('/uploads/<p:path>')
def server_static(p):
    return static_file(os.path.join('uploads', p), root=BASEDIR)

################################
# Responses

def yay(data=None):
    if not data:
        data = {}
    data['status'] = 'success'
    return data

def fail(e):
    exc_type, exc_value, exc_traceback = sys.exc_info()
    traceback.print_tb(exc_traceback, file=sys.stdout)
    message = {'status': 'failure', 'error': str(e), 'type': str(type(e))}
    if isinstance(e, NamesFileError):
        abort(500, message)
    elif isinstance(e, ForbiddenOperationError):
        abort(403, message)
    else:   # What is this I don't even
        raise e

@app.error(500)
def error(e):
    fail(e)

################################
# Get Names

def get_names(only_bid=None, only_nid=None, loaded_list=None):
    """Return format:
    <answer> = {"books": [<book>, <book>, ...]}
      <book> = {"bid": <int>, "name": <string>, "notes": [<note>, <note>, ...]}
      <note> = {"nid": <int>, "name": <string>, "bid": <int>}
    The lists are sorted by name.
    """
    if loaded_list is not None:
        books, notes = loaded_list
    else:
        books, notes = MODEL.get_book_and_note_list()
    books = sorted(books.items(), key=lambda (bid,name): (name,bid))
    notes = sorted(notes.items(), key=lambda (nid,(bid,name)): (name,nid,bid))
    if only_bid is not None:
        assert only_nid is None
        books = [x for x in books if x[0] == only_bid]
        if len(books) != 1:
            raise ForbiddenOperationError("Book %d not found" % only_bid)
    if only_nid is not None:
        assert only_bid is None
        notes = [x for x in notes if x[0] == only_nid]
        if len(notes) != 1:
            raise ForbiddenOperationError("Note %d not found" % only_nid)
        books = [x for x in books if x[0] == notes[0][1][0]]
    bid_to_notes = {}
    for nid, (bid, name) in notes:
        if bid not in bid_to_notes:
            bid_to_notes[bid] = []
        bid_to_notes[bid].append({"nid": nid, "name": name, "bid": bid})
    answer = {"books": 
              [{"bid": bid, "name": name, "notes": bid_to_notes.get(bid, [])}
               for (bid, name) in books]}
    if only_bid is not None or only_nid is not None:
        return answer["books"][0]
    return answer

@app.get('/list/')
def get_book_and_note_list():
    try:
        return yay(get_names())
    except Exception, e:
        return fail(e)

################################
# Book

@app.post('/book/new')
def new_book():
    name = request.forms.name
    bid, loaded_list = MODEL.add_empty_book(name)
    return yay({'bid': bid, 'list': get_names(loaded_list=loaded_list)})

@app.get('/book/<bid:int>')
def get_book(bid):
    return yay(get_names(only_bid=bid))

@app.post('/book/<bid:int>')
def post_book(bid):
    action = request.forms.action
    if action == 'rename':
        name = request.forms.name
        return yay(get_names(loaded_list=MODEL.rename_book(bid, name)))
    if action == 'delete':
        return yay(get_names(loaded_list=MODEL.delete_book(bid)))
    else:
        raise ForbiddenOperationError('Unknown action %s' % action)

@app.delete('/book/<bid:int>')
def delete_book(bid):
    return yay(get_names(loaded_list=MODEL.delete_book(bid)))

################################
# Note

@app.post('/note/new')
def new_note():
    bid = int(request.forms.bid)
    name = request.forms.name
    nid, loaded_list = MODEL.add_empty_note(bid, name)
    return yay({'bid': bid, 'nid': nid,
                'list': get_names(loaded_list=loaded_list)})

@app.get('/note/<nid:int>') 
def get_note(nid):
    containing_book = get_names(only_nid=nid)
    bid = containing_book['bid']
    book_name = containing_book['name']
    note_name = containing_book['notes'][0]['name']
    raw_content = MODEL.get_note_content(nid)
    return yay({"book": {"bid": bid, "name": book_name}, "nid": nid,
                "name": note_name, "raw": raw_content})

@app.post('/note/<nid:int>')
def post_note(nid):
    action = request.forms.action
    if action == 'rename':
        name = request.forms.name
        yay(get_names(loaded_list=MODEL.rename_note(nid, name)))
    elif action == 'delete':
        yay(get_names(loaded_list=MODEL.delete_note(nid)))
    elif action == 'save':
        content = request.forms.content
        MODEL.save_note_content(nid, content)
        return yay({"nid": nid, "raw": content})
    elif action == 'move':
        dest = int(request.forms.dest)
        return yay(get_names(loaded_list=MODEL.move_note(nid, dest)))
    else:
        raise ForbiddenOperationError("Unknown action %s" % action)

@app.delete('/note/<nid:int>')
def delete_note(nid):
    yay(get_names(loaded_list=MODEL.delete_note(nid)))

################################
# Entry Point

def start(port, basedir):
    global BASEDIR, MODEL
    BASEDIR = basedir
    MODEL = Model(BASEDIR)
    init_directories()
    app.run(port=port)
    print '\nGood bye!'
