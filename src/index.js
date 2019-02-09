require('./index.scss');
import $ from 'jquery';
import _ from 'lodash';
import { EventEmitter } from './eventEmitter';

import registerServiceWorker from '@henderea/static-site-builder/registerServiceWorker';
registerServiceWorker();

class QuickTableColumn extends EventEmitter {
    constructor(quickTable, index) {
        super();
        this._quickTable = quickTable;
        this._index = index;
    }

    get quickTable() {
        return this._quickTable;
    }

    get index() {
        return this._index;
    }

    get $head() {
        return this.quickTable.$table.find(`thead tr th:nth-child(${this.index + 1}), thead tr td:nth-child(${this.index + 1})`);
    }

    get $body() {
        return this.quickTable.$table.find(`tbody tr th:nth-child(${this.index + 1}), tbody tr td:nth-child(${this.index + 1})`);
    }

    get $() {
        return this.$head.add(this.$body);
    }

    get visible() {
        return this.$.is(function() {
            return $(this).css('display') != 'none';
        });
    }

    set visible(visible) {
        let oldVisible = this.visible;
        if(visible) {
            this.$.show();
        } else {
            this.$.hide();
        }
        this.trigger('column.visible', this.index, oldVisible, visible);
        this.quickTable.trigger('column.visible', this.index, oldVisible, visible);
    }
}

class QuickTableRow {
    constructor(quickTable, isHead, index) {
        this._quickTable = quickTable;
        this._isHead = isHead;
        this._index = index;
    }

    get quickTable() {
        return this._quickTable;
    }

    get isHead() {
        return this._isHead;
    }

    get index() {
        return this._index;
    }

    get $() {
        if(isHead) {
            return this.quickTable.$head.find('tr').eq(this.index);
        }
        return this.quickTable.$body.find('tr').eq(this.index);
    }

    get $cells() {
        return this.$.find('th,td');
    }

    get length() {
        return this.$cells.length;
    }
}

class QuickTable extends EventEmitter {
    constructor(table) {
        super();
        this._table = $(table);
        this._columns = {};
        this._rows = {}
        this._data = [];
        this._columnDefs = [];
    }

    get $table() {
        return this._table;
    }

    get $head() {
        return this.$table.find('thead');
    }

    get $body() {
        return this.$table.find('tbody');
    }

    get columnCount() {
        return this.$table.find('tr').eq(0).find('th,td').length;
    }

    get columns() {
        let rv = [];
        for(let i = 0; i < this.columnCount; i++) {
            rv.push(this.column(i));
        }
        return rv;
    }

    column(column) {
        if(column >= this.columnCount) { return null; }
        if(!(this._columns[column] instanceof QuickTableColumn)) {
            this._columns[column] = new QuickTableColumn(this, column);
        }
        return this._columns[column];
    }

    get rowCount() {
        return this.$body.find('tr').length;
    }

    get headerRowCount() {
        return this.$head.find('tr').length;
    }

    getRows(isHead) {
        let rv = [];
        for(let i = 0; i < (isHead ? this.headerRowCount : this.rowCount); i++) {
            rv.push(this.row(i, isHead));
        }
        return rv;
    }

    get rows() {
        return this.getRows(false);
    }

    get headerRows() {
        return this.getRows(true);
    }

    row(row, isHead = false) {
        if(row >= (isHead ? this.headerRowCount : this.rowCount)) { return null; }
        if(!(this._rows[row] instanceof QuickTableRow)) {
            this._rows[row] = new QuickTableRow(this, isHead, row);
        }
        return this._rows[row];
    }

    headerRow(row) {
        return this.row(row, true);
    }

    get columnDefs() {
        return this._columnDefs;
    }

    set columnDefs(columnDefs) {
        this._columnDefs = columnDefs;
    }

    get rawData() {
        return this._data;
    }

    get data() {
        if(this._data && this._data.length > 0) {
            return this._data;
        }
        return _.map(this.rows, r => _.map(r.$cells, c => c.html()));
    }

    set data(data) {
        if(!data || data.length == 0) {
            this._data = [];
            this.draw();
            return;
        }
        if(!_.isArray(data)) {
            throw 'data must be an array';
        }
        let colCount = this.columnCount;
        let colDefCount = this.columnDefs ? this.columnDefs.length : 0;
        if(colDefCount == 0) {
            if(_.some(data, d => !_.isArray(d))) {
                throw 'You must provide the data rows as arrays when columnDefs has not been set';
            }
            let minSize = _.min(_.map(data, d => d.length));
            if(minSize < colCount) {
                throw `One or more data rows had a size below the column count of ${colCount}. Minimum data row size: ${minSize}`;
            }
            this._data = data;
            this.draw();
        } else if(colDefCount < colCount) {
            throw `Not enough columnDefs have been provided. Have ${colCount} columns, but only ${colDefCount} columnDefs.`;
        } else {
            this._data = data;
            this.draw();
        }
    }

    draw() {
        let $body = this.$body;
        $body.empty();
        if(!this._data || this._data.length == 0) {
            return;
        }
        let colDefs = this.columnDefs;
        let colCount = this.columnCount;
        if(!colDefs || colDefs.length == 0) {
            //rows are arrays
            _.each(this._data, d => {
                let $row = $('<tr>');
                for(let i = 0; i < colCount; i++) {
                    let $cell = $('<td>');
                    $cell.text(d[i]);
                    $row.append($cell);
                }
                $body.append($row);
            });
        } else {
            _.each(this._data, d => {
                let $row = $('<tr>')
                for(let i = 0; i < colCount; i++) {
                    let def = colDefs[i];
                    let $cell;
                    if(def.cellType == 'th') {
                        $cell = $('<th>');
                    } else {
                        $cell = $('<td>');
                    }
                    let fieldData = null;
                    if(def.data) {
                        fieldData = d[def.data];
                    }
                    if(typeof def.render == 'function') {
                        fieldData = def.render(fieldData, d);
                    }
                    if(fieldData) {
                        if(def.html) {
                            $cell.html(fieldData);
                        } else {
                            $cell.text(fieldData);
                        }
                    }
                    if(def.cssClass) {
                        $cell.addClass(def.cssClass);
                    }
                    $row.append($cell);
                }
                $body.append($row);
            });
        }
    }
}

$.fn.QuickTable = function() {
    let tables = [];
    this.filter('table').each(function() {
        const $this = $(this);
        let table = $this.data('quickTable');
        if(!table) {
            table = new QuickTable($this);
            $this.data('quickTable', table);
        }
        tables.push(table);
    });
    if(tables.length == 1) {
        return tables[0];
    }
    return tables;
}

const data = [
    { fn: 'Eric', ln: 'Henderson' },
    { fn: 'John', ln: "Goins" },
    { fn: 'Ken', ln: "Grafals" }
]

$(function() {
    let qTable = $('#quickTable').QuickTable();
    qTable.columnDefs = [
        { data: 'fn', cssClass: 'center' },
        { data: 'ln' },
        { render(data, row) { return `${row.fn} ${row.ln}`; } },
        { data: 'fn', html: true, render(data, row) { return `<b>${row.ln}</b>, ${data}`; } }
    ];
    _.each(qTable.columns, c => {
        const $check = $(`input[data-column="${c.index}"]`);
        $check.prop('checked', c.visible);
        const col = c;
        $check.change(() => { col.visible = $check.is(':checked'); });
        col.on('column.visible', (index, oldVisible, newVisible) => {
            $check.prop('checked', newVisible);
        });
    });
    qTable.data = data;
});