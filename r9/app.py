#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, os
from werkzeug.wrappers import Request, Response
from werkzeug.serving import run_simple
from werkzeug.wsgi import SharedDataMiddleware

from router import Router
from controller import Controller

class Application(object):
    def __init__(self, basedir):
        self.controller = Controller(basedir)
        self.router = Router(self.controller)

    def __call__(self, environ, start_response):
        request = Request(environ)
        response = self.router.dispatch_request(request)
        return response(environ, start_response)

def init_directories(basedir):
    if not os.path.isdir(os.path.join(basedir, 'data')):
        os.mkdir(os.path.join(basedir, 'data'))
        print >> sys.stderr, 'Created "data" directory'
    if not os.path.isfile(os.path.join(basedir, 'data', 'names')):
        with open(os.path.join(basedir, 'data', 'names'), 'w') as fout:
            fout.write('B\t0\tUnsorted Notes\n')
        print >> sys.stderr, 'Created "data/notes" file'

def run(port, basedir):
    init_directories(basedir)
    app = SharedDataMiddleware(Application(basedir), {
        '/static': os.path.join(basedir, 'static'),
        '/uploads': os.path.join(basedir, 'uploads'),
        '/index.html': os.path.join(basedir, 'index.html'),
        })
    run_simple('localhost', port, app, use_debugger=True) #, use_reloader=True)
