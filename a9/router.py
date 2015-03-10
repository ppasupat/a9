#!/usr/bin/env python
# -*- coding: utf-8 -*-

from werkzeug.wrappers import Request, Response
from werkzeug.routing import Map, Rule
from werkzeug.exceptions import HTTPException
from werkzeug.utils import redirect

class Router(object):
    def __init__(self, controller):
        self.controller = controller
        self.url_map = Map([
            Rule('/', endpoint='home', methods=['GET']),
            Rule('/list/', endpoint='list', methods=['GET']),
            Rule('/book/<int:bid>', endpoint='book',
                 methods=['GET', 'POST', 'DELETE']),
            Rule('/book/new', endpoint='book/new', methods=['POST']),
            Rule('/note/<int:nid>', endpoint='note',
                 methods=['GET', 'POST', 'DELETE']),
            Rule('/note/new', endpoint='note/new', methods=['POST']),
            ])
        self.endpoint_map = {
            'home': lambda x: redirect('/index.html'),
            'list': controller.get_book_and_note_list,
            'book': controller.process_book,
            'book/new': controller.new_book,
            'note': controller.process_note,
            'note/new': controller.new_note,
            }

    def dispatch_request(self, request):
        adapter = self.url_map.bind_to_environ(request.environ)
        try:
            endpoint, kwargs = adapter.match()
            return self.endpoint_map[endpoint](request, **kwargs)
        except HTTPException, e:
            return e

