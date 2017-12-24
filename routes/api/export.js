"use strict";

const express = require('express');
const router = express.Router();
const rimraf = require('rimraf');
const fs = require('fs');
const sql = require('../../services/sql');
const data_dir = require('../../services/data_dir');
const html = require('html');
const auth = require('../../services/auth');

router.get('/:noteId/to/:directory', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;
    const directory = req.params.directory.replace(/[^0-9a-zA-Z_-]/gi, '');

    if (!fs.existsSync(data_dir.EXPORT_DIR)) {
        fs.mkdirSync(data_dir.EXPORT_DIR);
    }

    const completeExportDir = data_dir.EXPORT_DIR + '/' + directory;

    if (fs.existsSync(completeExportDir)) {
        rimraf.sync(completeExportDir);
    }

    fs.mkdirSync(completeExportDir);

    const noteTreeId = await sql.getFirstValue('SELECT note_tree_id FROM notes_tree WHERE note_id = ?', [noteId]);

    await exportNote(noteTreeId, completeExportDir);

    res.send({});
});

async function exportNote(noteTreeId, dir) {
    const noteTree = await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [noteTreeId]);
    const note = await sql.getFirst("SELECT * FROM notes WHERE note_id = ?", [noteTree.note_id]);

    const pos = (noteTree.note_position + '').padStart(4, '0');

    fs.writeFileSync(dir + '/' + pos + '-' + note.note_title + '.html', html.prettyPrint(note.note_text, {indent_size: 2}));

    const children = await sql.getAll("SELECT * FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0", [note.note_id]);

    if (children.length > 0) {
        const childrenDir = dir + '/' + pos + '-' + note.note_title;

        fs.mkdirSync(childrenDir);

        for (const child of children) {
            await exportNote(child.note_tree_id, childrenDir);
        }
    }
}

module.exports = router;