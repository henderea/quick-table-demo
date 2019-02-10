require('./index.scss');
import $ from 'jquery';
import _ from 'lodash';
import { EventEmitter } from './eventEmitter';

import registerServiceWorker from '@henderea/static-site-builder/registerServiceWorker';
registerServiceWorker();

class QuickTableCell {
    constructor(quickTable, rowIndex, isHead, columnIndex) {
        this._quickTable = quickTable;
        this._rowIndex = rowIndex;
        this._isHead = isHead;
        this._columnIndex = columnIndex;
    }

    get quickTable() { return this._quickTable; }

    get rowIndex() { return this._rowIndex; }

    get isHead() { return this._isHead; }

    get columnIndex() { return this._columnIndex; }

    get row() { return this.quickTable.row(this.rowIndex, this.isHead); }

    get column() { return this.quickTable.column(this.columnIndex); }

    get $() { return this.row.$cells.eq(this.columnIndex); }

    get htmlData() { return this.$.html(); }

    get textData() { return this.$.text(); }
}

class QuickTableColumn extends EventEmitter {
    constructor(quickTable, index) {
        super();
        this._quickTable = quickTable;
        this._index = index;
        this.on('column.visible', (col, oldVisible, newVisible) => this.quickTable.trigger('column.visible', col, oldVisible, newVisible));
    }

    get quickTable() { return this._quickTable; }

    get index() { return this._index; }

    get $head() { return this.quickTable.$table.find(`thead tr th:nth-child(${this.index + 1}), thead tr td:nth-child(${this.index + 1})`); }

    get $body() { return this.quickTable.$table.find(`tbody tr th:nth-child(${this.index + 1}), tbody tr td:nth-child(${this.index + 1})`); }

    get $() { return this.$head.add(this.$body); }

    get visible() { return this.$.is(function() { return $(this).css('display') != 'none'; }); }

    set visible(visible) {
        let oldVisible = this.visible;
        this.$[visible ? 'show' : 'hide']();
        this.trigger('column.visible', this.index, oldVisible, visible);
    }

    cell(row, isHead = false) { return (r => r && r.cell(this.index))(this.quickTable.row(row, isHead)); }

    headerCell(row) { return this.cell(row, true); }
}

class QuickTableRow {
    constructor(quickTable, isHead, index) {
        this._quickTable = quickTable;
        this._isHead = isHead;
        this._index = index;
        this._cells = {};
    }

    get quickTable() { return this._quickTable; }

    get isHead() { return this._isHead; }

    get index() { return this._index; }

    get $() { return this.quickTable.getSection(this.isHead).find('tr').eq(this.index); }

    get $cells() { return this.$.find('th,td'); }

    cell(column) {
        if(!_.inRange(column, this.quickTable.columnCount)) { return null; }
        if(!(this._cells[column] instanceof QuickTableCell)) {
            this._cells[column] = new QuickTableCell(this.quickTable, this.index, this.isHead, column);
        }
        return this._cells[column];
    }

    get cells() { return _.map(_.range(this.quickTable.columnCount), i => this.cell(i)); }

    get length() { return this.$cells.length; }

    get cellHtmlData() { return _.map(this.cells, c => c.htmlData); }

    get cellTextData() { return _.map(this.cells, c => c.textData); }

    get data() {
        if(this.quickTable.rawData && this.quickTable.rawData.length > this.index) {
            return this.quickTable.rawData[this.index];
        }
        return this.cellHtmlData;
    }
}

class QuickTable extends EventEmitter {
    constructor(table, initFunc = null) {
        super();
        this._table = $(table);
        this._columns = {};
        this._rows = {}
        this._data = [];
        this._columnDefs = [];
        this._autoDraw = true;
        this._inInit = false;
        if(initFunc && typeof initFunc == 'function') {
            this._inInit = true;
            initFunc(this);
            this._inInit = false;
        }
    }

    chain(func) {
        func(this);
        return this;
    }

    get autoDraw() { return this._autoDraw; }

    set autoDraw(autoDraw) { this._autoDraw = autoDraw; }

    get $table() { return this._table; }

    getSection(isHead) { return this.$table.find(isHead ? 'thead' : 'tbody'); }

    get $head() { return this.getSection(true); }

    get $body() { return this.getSection(false); }

    get columnCount() { return this.$table.find('tr').eq(0).find('th,td').length; }

    get columns() { return _.map(_.range(this.columnCount), i => this.column(i)); }

    column(column) {
        if(!_.inRange(column, this.columnCount)) { return null; }
        if(!(this._columns[column] instanceof QuickTableColumn)) {
            this._columns[column] = new QuickTableColumn(this, column);
        }
        return this._columns[column];
    }

    getRowCount(isHead) { return this[isHead ? '$head' : '$body'].find('tr').length }

    get rowCount() { return this.getRowCount(false); }

    get headerRowCount() { return this.getRowCount(true); }

    getRows(isHead) { return _.map(_.range(this.getRowCount(isHead)), i => this.row(i)); }

    get rows() { return this.getRows(false); }

    get headerRows() { return this.getRows(true); }

    row(row, isHead = false) {
        if(!_.inRange(row, this.getRowCount(isHead))) { return null; }
        if(!(this._rows[row] instanceof QuickTableRow)) {
            this._rows[row] = new QuickTableRow(this, isHead, row);
        }
        return this._rows[row];
    }

    headerRow(row) { return this.row(row, true); }

    cell(row, column, isHead = false) { return (r => r && r.cell(column))(this.row(row, isHead)); }

    headerCell(row, column) { return this.cell(row, column, isHead); }

    get columnDefs() { return this._columnDefs; }

    set columnDefs(columnDefs) {
        if(columnDefs.length < this.columnCount) {
            throw `Not enough columnDefs have been provided. Have ${this.columnCount} columns, but only ${columnDefs.length} columnDefs.`;
        }
        this._columnDefs = columnDefs;
        if(this.autoDraw && this._data && this._data.length > 0) {
            this.draw();
        }
    }

    get rawData() { return this._data; }

    get data() {
        if(this._data && this._data.length > 0) {
            return this._data;
        }
        return this.cellTextData;
    }

    get cellHtmlData() { return _.map(this.rows, r => r.cellHtmlData); }
    get cellTextData() { return _.map(this.rows, r => r.cellTextData); }

    set data(data) {
        if(!data || data.length == 0) {
            this._data = [];
            if(this.autoDraw) { this.draw(); }
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
            if(this.autoDraw) { this.draw(); }
        } else if(colDefCount < colCount) {
            throw `Not enough columnDefs have been provided. Have ${colCount} columns, but only ${colDefCount} columnDefs.`;
        } else {
            this._data = data;
            if(this.autoDraw) { this.draw(); }
        }
    }

    draw() {
        if(this._inInit) { return this; }
        let $body = this.$body;
        $body.empty();
        if(!this._data || this._data.length == 0) {
            return this.trigger('draw.empty');
        }
        let colDefs = this.columnDefs;
        let colCount = this.columnCount;
        if(!colDefs || colDefs.length == 0) {
            // rows are arrays
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
            // rows use columnDefs
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
        return this.trigger('draw');
    }
}

$.fn.QuickTable = function(initFunc = null) {
    let tables = [];
    this.filter('table').each(function() {
        const $this = $(this);
        let table = $this.data('quickTable');
        if(!table) {
            table = new QuickTable($this, initFunc);
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
    let qTable = $('#quickTable').QuickTable(table => {
        table.columnDefs = [
            { data: 'fn', cssClass: 'center' },
            { data: 'ln' },
            { render(data, row) { return `${row.fn} ${row.ln}`; } },
            { data: 'fn', html: true, render(data, row) { return `<b>${row.ln}</b>, ${data}`; } }
        ];
        _.each(table.columns, c => {
            const $check = $(`input[data-column="${c.index}"]`);
            const col = c;
            c.on('column.visible', (_i, _o, visible) => { $check.prop('checked', visible) })
                .trigger('column.visible', c.index, c.visible, c.visible);
            $check.change(() => { col.visible = $check.is(':checked'); });
        });
        table.data = data;
        table.on('draw', () => {
            table.cell(0, 0).$.css('font-weight', 'bold').css('font-style', 'italic').css('color', '#949494').css('text-decoration', 'underline');
        });
    }).draw();
    $('#export-link').click(() => {
        let headers = ['First', 'Last', 'First Last', 'Last, First'];
        let data = qTable.cellTextData;
        let csv = _.join(_.map([headers, ...data], d => _.join(_.map(d, v => `"${v.replace(/"/g, '""')}"`), ',')), '\n').replace(/(^\[)|(]$)/mg, '');
        $('#export-div').html(_.escape(csv));
    });
});