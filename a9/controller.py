#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, json, traceback
from werkzeug.wrappers import Request, Response
from model import Model, NamesFileError, ForbiddenOperationError
from formatter import markdown_to_html

class Controller(object):
    def __init__(self, basedir):
        self.basedir = basedir
        self.model = Model(basedir)

    def yay(self, data=None):
        if not data:
            data = {}
        data["status"] = "success"
        return Response(json.dumps(data), mimetype='application/json')

    def fail(self, e):
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback.print_tb(exc_traceback, file=sys.stdout)
        message = json.dumps({"status": "failure", "error": str(e),
                              "type": str(type(e))})
        if isinstance(e, NamesFileError):
            return Response(message, mimetype='application/json', status=500)
        elif isinstance(e, ForbiddenOperationError):
            return Response(message, mimetype='application/json', status=403)
        else:
            # What is this I don't even
            raise e

    def _get_names(self, only_bid=None, only_nid=None, loaded_list=None):
        """Return format:
        <answer> = {"books": [<book>, <book>, ...]}
          <book> = {"bid": <int>, "name": <string>, "notes": [<note>, <note>, ...]}
          <note> = {"nid": <int>, "name": <string>, "bid": <int>}
        The lists are sorted by name.
        """
        if loaded_list is not None:
            books, notes = loaded_list
        else:
            books, notes = self.model.get_book_and_note_list()
        books = sorted(books.iteritems(), key=lambda (bid,name): (name,bid))
        notes = sorted(notes.iteritems(), key=lambda (nid,(bid,name)): (name,nid,bid))
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

    def get_book_and_note_list(self, request=None):
        try:
            return self.yay(self._get_names())
        except Exception, e:
            return self.fail(e)
        
    ################
    # Book

    def new_book(self, request):
        try:
            name = request.form['name']
            bid, loaded_list = self.model.add_empty_book(name)
            return self.yay({"bid": bid,
                             "list": self._get_names(loaded_list=loaded_list)})
        except Exception, e:
            return self.fail(e)

    def process_book(self, request, bid):
        try:
            if request.method == 'POST':
                action = request.form.get('action')
                if action == 'rename':
                    return self._rename_book(bid, request.form.get('name', ''))
                elif action == 'delete':
                    return self._delete_book(bid)
                else:
                    raise ForbiddenOperationError("Unknown action %s" % action)
            elif request.method == 'DELETE':
                return self._delete_book(bid)
            else:   # GET
                return self._get_book(bid)
        except Exception, e:
            return self.fail(e)

    def _get_book(self, bid):
        return self.yay(self._get_names(only_bid=bid))

    def _rename_book(self, bid, new_name):
        loaded_list = self.model.rename_book(bid, new_name)
        return self.yay(self._get_names(loaded_list=loaded_list))

    def _delete_book(self, bid):
        loaded_list = self.model.delete_book(bid)
        return self.yay(self._get_names(loaded_list=loaded_list))

    ################
    # Note

    def new_note(self, request):
        try:
            bid = int(request.form['bid'])
            name = request.form['name']
            nid,  loaded_list = self.model.add_empty_note(bid, name)
            return self.yay({"bid": bid, "nid": nid,
                             "list": self._get_names(loaded_list=loaded_list)})
        except Exception, e:
            return self.fail(e)

    def process_note(self, request, nid):
        try:
            if request.method == 'POST':
                action = request.form.get('action')
                if action == 'rename':
                    return self._rename_note(nid, request.form.get('name', ''))
                elif action == 'delete':
                    return self._delete_note(nid)
                elif action == 'save':
                    return self._save_note(nid, request.form['content'])
                elif action == 'preview':
                    return self._preview_note(nid, request.form['content'])
                elif action == 'move':
                    return self._move_note(nid, request.form['dest'])
                else:
                    raise ForbiddenOperationError("Unknown action %s" % action)
            elif request.method == 'DELETE':
                return self._delete_note(nid)
            else:   # GET
                return self._get_note(nid)
        except Exception, e:
            return self.fail(e)

    def _get_note(self, nid, raw_content=None):
        containing_book = self._get_names(only_nid=nid)
        bid = containing_book['bid']
        book_name = containing_book['name']
        note_name = containing_book['notes'][0]['name']
        if raw_content is None:
            raw_content = self.model.get_note_content(nid)
        html_content = markdown_to_html(raw_content)
        return self.yay({"book": {"bid": bid, "name": book_name}, "nid": nid,
                    "name": note_name, "html": html_content, "raw": raw_content})

    def _save_note(self, nid, content):
        self.model.save_note_content(nid, content)
        html_content = markdown_to_html(content)
        return self.yay({"nid": nid, "html": html_content, "raw": content})

    def _preview_note(self, nid, content):
        html_content = markdown_to_html(content)
        return self.yay({"nid": nid, "html": html_content, "raw": content})

    def _rename_note(self, nid, new_name):
        loaded_list = self.model.rename_note(nid, new_name)
        return self.yay(self._get_names(loaded_list=loaded_list))

    def _move_note(self, nid, dest):
        loaded_list = self.model.move_note(nid, int(dest))
        return self.yay(self._get_names(loaded_list=loaded_list))

    def _delete_note(self, nid):
        loaded_list = self.model.delete_note(nid)
        return self.yay(self._get_names(loaded_list=loaded_list))
