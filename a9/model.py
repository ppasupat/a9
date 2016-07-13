#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys, os, re
from threading import Lock, RLock
from codecs import open

class Model(object):
    WHITESPACE = re.compile(r"\s+", re.MULTILINE)

    def __init__(self, basedir, paranoid=True):
        self.basedir = basedir
        self.datadir = os.path.join(basedir, 'data')
        # run_simple runs with 1 thread and 1 process, but for safety ...
        self.lock = RLock()
        self.names_lock = Lock()
        self.paranoid = paranoid
        self.paranoid_count = 0

    def sanitize_name(self, name):
        name = Model.WHITESPACE.sub(" ", name).strip()
        if not name:
            raise ForbiddenOperationError("name cannot be empty")
        return name
    
    def _read_names(self):
        print >> sys.stderr, 'INFO: _read_names called'
        with self.names_lock:
            with open(os.path.join(self.datadir, 'names'), 'r', 'utf8') as fin:
                books, notes = {}, {}
                for linum, line in enumerate(fin):
                    if not line.strip():
                        continue
                    line = line.strip().split('\t')
                    if line[0] not in ('B', 'N'):
                        raise NamesFileError("Incorrect line prefix %s" % line[0], linum)
                    if line[0] == 'B':
                        if len(line) != 3:
                            raise NamesFileError("Book needs 3 arguments; got %d" % len(line), linum)
                        if not line[1].isdigit():
                            raise NamesFileError("Book id %s is not a number" % line[1], linum)
                        bid, name = int(line[1]), line[2]
                        if bid in books:
                            raise NamesFileError("Repeated book id %d" % bid, linum)
                        books[bid] = name
                    else:
                        if len(line) != 4:
                            raise NamesFileError("Note needs 4 arguments; got %d" % len(line), linum)
                        if not line[1].isdigit():
                            raise NamesFileError("Note id %s is not a number" % line[1], linum)
                        if not line[2].isdigit():
                            raise NamesFileError("Book id %s is not a number" % line[2], linum)
                        nid, bid, name = int(line[1]), int(line[2]), line[3]
                        if nid in notes:
                            raise NamesFileError("Repeated note id %d" % bid, linum)
                        notes[nid] = [bid, name]
                self._check_names(books, notes)
                return books, notes

    def _write_names(self, books, notes):
        with self.names_lock:
            self._check_names(books, notes)
            with open(os.path.join(self.datadir, 'names'), 'w', 'utf8') as fout:
                for bid, name in sorted(books.iteritems()):
                    fout.write('B\t%d\t%s\n' % (bid, name))
                for nid, (bid, name) in sorted(notes.iteritems()):
                    fout.write('N\t%d\t%d\t%s\n' % (nid, bid, name))

    def _check_names(self, books, notes):
        for nid, (bid, name) in notes.iteritems():
            if bid not in books:
                raise NamesFileError("Note %d is in non-existing book %d" % (nid, bid))
            if self.paranoid:
                if self.paranoid_count % 5 == 0:
                    if not os.path.isfile(self._get_note_path(nid)):
                        raise NamesFileError("Cannot find note %d in directory" % nid)
                self.paranoid_count += 1

    ################
    # Book

    def add_empty_book(self, name):
        """Return (new book bid, (books, notes))"""
        with self.lock:
            books, notes = self._read_names()
            bid = 1
            while bid in books:
                bid += 1
            books[bid] = self.sanitize_name(name)
            self._write_names(books, notes)
            return bid, (books, notes)

    def rename_book(self, bid, new_name):
        """Return (books, notes) if succeed.
        Note that Book 0 (Unsorted Notes) cannot be renamed.
        """
        with self.lock:
            books, notes = self._read_names()
            if bid == 0:
                raise ForbiddenOperationError("Cannot rename book 0")
            if bid not in books:
                raise ForbiddenOperationError("Book %d not found" % bid)
            books[bid] = self.sanitize_name(new_name)
            self._write_names(books, notes)
            return (books, notes)

    def delete_book(self, bid):
        """Return (books, notes) if succeed.
        Move all the notes in the deleted book to Book 0.
        Note that Book 0 (Unsorted Notes) cannot be deleted.
        """
        with self.lock:
            books, notes = self._read_names()
            if bid == 0:
                raise ForbiddenOperationError("Cannot delete book 0")
            if bid not in books:
                raise ForbiddenOperationError("Book %d not found" % bid)
            del books[bid]
            for nid in notes.iterkeys():
                if notes[nid][0] == bid:
                    notes[nid][0] = 0
            self._write_names(books, notes)
            return (books, notes)

    def get_book_and_note_list(self):
        with self.lock:
            books, notes = self._read_names()
            return books, notes

    ################
    # Note

    def _get_note_path(self, nid):
        return os.path.join(self.datadir, str(nid) + '.md')

    def _get_next_available_nid(self):
        max_id = 999
        for x in os.listdir(self.datadir):
            if x.endswith('.md') and x[:-3].isdigit():
                max_id = max(int(x[:-3]), max_id)
        nid = max_id + 1
        if os.path.exists(self._get_note_path(nid)):
            raise ForbiddenOperationError("Race condition (?) while adding Note %d" % nid)
        return nid

    def add_empty_note(self, bid, name):
        """Return the (new note nid, (books, notes))"""
        with self.lock:
            books, notes = self._read_names()
            if bid not in books:
                raise ForbiddenOperationError("Book %d not found" % bid)
            nid = self._get_next_available_nid()
            if nid in notes:
                raise NamesFileError("Note %d found in names but not in directory" % nid)
            notes[nid] = [bid, self.sanitize_name(name)]
            with open(self._get_note_path(nid), 'w', 'utf8') as fout:
                pass    # Clean the file
            self._write_names(books, notes)
            return nid, (books, notes)
        
    def rename_note(self, nid, new_name):
        """Return (books, notes) if succeed."""
        with self.lock:
            books, notes = self._read_names()
            if nid not in notes:
                raise ForbiddenOperationError("Note %d not found" % nid)
            notes[nid] = [notes[nid][0], self.sanitize_name(new_name)]
            self._write_names(books, notes)
            return (books, notes)

    def move_note(self, nid, new_bid):
        """Return (books, notes) if succeed.
        The origin and the destination have to be different.
        """
        with self.lock:
            books, notes = self._read_names()
            if nid not in notes:
                raise ForbiddenOperationError("Note %d not found" % nid)
            if new_bid not in books:
                raise ForbiddenOperationError("Book %d not found" % new_bid)
            old_bid = notes[nid][0]
            if old_bid == new_bid:
                raise ForbiddenOperationError("The destination book %d is the same as the origin" % new_bid)
            notes[nid] = [new_bid, notes[nid][1]]
            self._write_names(books, notes)
            return (books, notes)

    def delete_note(self, nid):
        """Return (books, notes) if succeed.
        The note file still remains but can be overwritten later.
        """
        with self.lock:
            books, notes = self._read_names()
            if nid not in notes:
                raise ForbiddenOperationError("Note %d not found" % nid)
            del notes[nid]
            self._write_names(books, notes)
            return (books, notes)

    def get_note_content(self, nid):
        with self.lock:
            with open(self._get_note_path(nid), 'r', 'utf8') as fin:
                return fin.read()

    def save_note_content(self, nid, content):
        with self.lock:
            with open(self._get_note_path(nid), 'w', 'utf8') as fout:
                fout.write(content)

    def export_note(self, nid, **kwargs):
        template_path = os.path.join(self.basedir, 'viewer', 'template')
        output_path = os.path.join(self.basedir, 'viewer', str(nid) + '.html')
        with open(template_path, 'r', 'utf8') as fin:
            with open(output_path, 'w', 'utf8') as fout:
                fout.write(fin.read().format(nid=nid, **kwargs))

################
# Exceptions

class NamesFileError(Exception):
    def __init__(self, value, linum=None):
        self.value = value
        self.linum = linum
    def __str__(self):
        if self.linum is not None:
            return 'Line %d: %s' % (self.linum, self.value)
        else:
            return '%s' % self.value

class ForbiddenOperationError(Exception):
    def __init__(self, value):
        self.value = value
    def __str__(self):
        return repr(self.value)
