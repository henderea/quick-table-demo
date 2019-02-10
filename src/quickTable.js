import $ from 'jquery';
import _ from 'lodash';
import { EventEmitter } from './eventEmitter';

class ColumnId {
    constructor(columnIndex) {
        this._columnIndex = columnIndex;
    }

    get columnIndex() { return this._columnIndex; }

    toString() { return `ColumnId[${this.columnIndex}]`; }
}

const columnIds = {};

const columnId = columnIndex => {
    if(columnIndex instanceof ColumnId) { return columnIndex; }
    if(!(columnIds[columnIndex] instanceof ColumnId)) {
        columnIds[columnIndex] = new ColumnId(columnIndex);
    }
    return columnIds[columnIndex];
}

class CellId {
    constructor(rowId, columnId) {
        this._rowId = rowId;
        this._columnId = columnId;
    }

    get rowId() { return this._rowId; }

    get columnId() { return this._columnId; }

    get rowIndex() { return this.rowId.rowIndex; }

    get isHead() { return this.rowId.isHead; }

    get columnIndex() { return this.columnId.columnIndex; }

    toString() { return `CellId[${this.isHead ? 'head' : 'body'}:${this.rowIndex}, ${this.columnIndex}]`; }
}

const _getCellId = Symbol('getCellId');

class RowId {
    constructor(rowIndex, isHead) {
        this._rowIndex = rowIndex;
        this._isHead = isHead;
        this._cellIds = {};
    }

    get rowIndex() { return this._rowIndex; }

    get isHead() { return this._isHead; }

    [_getCellId](columnId) {
        if(!(this._cellIds[columnId] instanceof CellId)) {
            this._cellIds[columnId] = new CellId(this, columnId);
        }
        return this._cellIds[columnId];
    }

    toString() { return `RowId[${this.isHead ? 'head' : 'body'}:${this.rowIndex}]`; }
}

const rowIds = { head: {}, body: {} };

const rowId = (rowIndex, isHead = false) => {
    if(rowIndex instanceof RowId) {
        if(!isHead || rowIndex.isHead) {
            return rowIndex;
        }
        rowIndex = rowIndex.rowIndex;
    }
    if(!(rowIds[isHead ? 'head' : 'body'][rowIndex] instanceof RowId)) {
        rowIds[isHead ? 'head' : 'body'][rowIndex] = new RowId(rowIndex, isHead);
    }
    return rowIds[isHead ? 'head' : 'body'][rowIndex];
}

const cellId = (rowIndex, columnIndex, isHead = false) => {
    if(rowIndex instanceof CellId) { return rowIndex; }
    return rowId(rowIndex, isHead)[_getCellId](columnId(columnIndex));
}

class QTIterable {
    constructor(getter) {
        this._getter = getter;
    }

    each(iter) {
        _.each(this._getter(this), iter);
        return this;
    }

    map(iter) { return _.map(this._getter(this), iter); }

    flatMap(iter) { return _.flatMap(this._getter(this), iter); }

    some(iter) { return _.some(this._getter(this), iter); }

    every(iter) { return _.every(this._getter(this), iter); }

    find(iter) { return _.find(this._getter(this), iter); }

    findLast(iter) { return _.findLast(this._getter(this), iter); }
}

class Cell {
    constructor(quickTable, cellId) {
        this._quickTable = quickTable;
        this._cellId = cellId;
    }

    get cellId() { return this._cellId; }

    get quickTable() { return this._quickTable; }

    get rowIndex() { return this.cellId.rowIndex; }

    get isHead() { return this.cellId.isHead; }

    get columnIndex() { return this.cellId.columnIndex; }

    get rowId() { return this.cellId.rowId; }

    get columnId() { return this.cellId.columnId; }

    get row() { return this.quickTable.row(this.rowId); }

    get column() { return this.quickTable.column(this.columnId); }

    get $() { return this.row.$cells.eq(this.columnIndex); }

    get htmlData() { return this.$.html(); }

    get textData() { return this.$.text(); }
}

class Cells extends QTIterable {
    constructor(quickTable, cellIds) {
        super(c => c.cells);
        this._quickTable = quickTable;
        this._cellIds = _.flatMap(_.flatten([cellIds]), c => {
            if(c instanceof Cell) { return c.cellId; }
            if(c instanceof Cells) { return c.cellIds; }
            return c;
        });
    }

    get quickTable() { return this._quickTable; }

    get cellIds() { return this._cellIds; }

    get cells() { return _.filter(_.map(this.cellIds, c => this.quickTable.cell(c))); }

    get $() { return $(_.map(this.cells, c => c.$)); }

    get htmlData() { return _.map(this.cells, c => c.htmlData); }

    get textData() { return _.map(this.cells, c => c.textData); }

    get length() { return this.cellIds.length; }
}

class Column extends EventEmitter {
    constructor(quickTable, columnId) {
        super();
        this._quickTable = quickTable;
        this._columnId = columnId;
        this.forward('column.visible', this.quickTable);
    }

    get columnId() { return this._columnId; }

    get quickTable() { return this._quickTable; }

    get index() { return this.columnId.columnIndex; }

    get $head() { return this.quickTable.$.find(`thead tr th:nth-child(${this.index + 1}), thead tr td:nth-child(${this.index + 1})`); }

    get $body() { return this.quickTable.$.find(`tbody tr th:nth-child(${this.index + 1}), tbody tr td:nth-child(${this.index + 1})`); }

    get $() { return this.$head.add(this.$body); }

    get visible() { return this.$.is(function() { return $(this).css('display') != 'none'; }); }

    set visible(visible) {
        let oldVisible = this.visible;
        this.$[visible ? 'show' : 'hide']();
        this.trigger('column.visible', { columnId: this.columnId, oldValue: oldVisible, newValue: visible, visible });
    }

    cell(row, isHead = false) { return (r => r && r.cell(this.columnId))(this.quickTable.row(row, isHead)); }

    cellId(row, isHead = false) { return cellId(row, this.columnId, isHead); }

    get headerCellIds() { return _.map(_.range(this.quickTable.headerRowCount), r => this.cellId(r, true)); }

    get bodyCellIds() { return _.map(_.range(this.quickTable.rowCount), r => this.cellId(r, false)); }

    get cellIds() { return _.concat([], this.headerCellIds, this.bodyCellIds); }

    get headerCells() { return new Cells(this.quickTable, this.headerCellIds); }

    get bodyCells() { return new Cells(this.quickTable, this.bodyCellIds); }

    get cells() { return new Cells(this.quickTable, this.cellIds); }

    headerCell(row) { return this.cell(row, true); }
}

class Columns extends QTIterable {
    constructor(quickTable, columnIds) {
        super(c => c.columns);
        this._quickTable = quickTable;
        this._columnIds = columnIds;
    }

    get quickTable() { return this._quickTable; }

    get columnIds() { return this._columnIds; }

    get columns() { return _.filter(_.map(this.columnIds, c => this.quickTable.column(c))); }

    get $head() { return $(_.map(this.columns, c => c.$head)); }

    get $body() { return $(_.map(this.columns, c => c.$body)); }

    get $() { return $(_.map(this.columns, c => c.$)); }

    get headerCellIds() { return _.flatMap(this.columns, c => c.headerCellIds); }

    get bodyCellIds() { return _.flatMap(this.columns, c => c.bodyCellIds); }

    get cellIds() { return _.flatMap(this.columns, c => c.cellIds); }

    get headerCells() { return new Cells(this.quickTable, this.headerCellIds); }

    get bodyCells() { return new Cells(this.quickTable, this.bodyCellIds); }

    get cells() { return new Cells(this.quickTable, this.cellIds); }

    set visible(visible) { this.each(c => c.visible = visible); }

    rowCells(row, isHead = false) { return new Cells(this.quickTable, _.map(this.columns, c => c.cellId(row, isHead))); }

    headerRowCells(row) { return this.rowCells(row, true); }
}

class Row {
    constructor(quickTable, rowId) {
        this._quickTable = quickTable;
        this._rowId = rowId;
        this._cells = {};
    }

    get rowId() { return this._rowId; }

    get quickTable() { return this._quickTable; }

    get isHead() { return this.rowId.isHead; }

    get index() { return this.rowId.rowIndex; }

    get $() { return this.quickTable.getSection(this.isHead).find('tr').eq(this.index); }

    get $cells() { return this.$.find('th,td'); }

    cell(column) {
        column = columnId(column);
        if(!_.inRange(column.columnIndex, this.length)) { return null; }
        if(!(this._cells[column] instanceof Cell)) {
            this._cells[column] = new Cell(this.quickTable, this.cellId(column));
        }
        return this._cells[column];
    }

    cellId(column) { return cellId(this.rowId, column); }

    get cellIds() { return _.map(_.range(this.length), i => this.cellId(i)); }

    get cells() { return new Cells(this.quickTable, this.cellIds); }

    get length() { return this.$cells.length; }

    get cellHtmlData() { return this.cells.htmlData; }

    get cellTextData() { return this.cells.textData; }

    get data() {
        if(this.quickTable.rawData && this.quickTable.rawData.length > this.index) {
            return this.quickTable.rawData[this.index];
        }
        return this.cellHtmlData;
    }
}

class Rows extends QTIterable {
    constructor(quickTable, rowIds) {
        super(r => r.rows);
        this._quickTable = quickTable;
        this._rowIds = rowIds;
    }

    get quickTable() { return this._quickTable; }

    get rowIds() { return this._rowIds; }

    get rows() { return _.filter(_.map(this.rowIds, r => this.quickTable.row(r))); }

    get $() { return $(_.map(this.rows, r => r.$)); }

    get $cells() { return $(_.map(this.rows, r => r.$cells)); }

    get length() { return this.rowIds.length; }

    columnCellIds(column) { return _.map(this.rows, r => r.cellId(column)); }

    columnCells(column) { return new Cells(this.quickTable, this.columnCellIds(column)); }

    get cellIds() { return _.flatMap(this.rows, r => r.cellIds); }

    get cells() { return new Cells(this.quickTable, this.cellIds); }

    get cellHtmlData() { return _.map(this.rows, r => r.cellHtmlData); }

    get cellTextData() { return _.map(this.rows, r => r.cellTextData); }

    get data() { return _.map(this.rows, r => r.data); }
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
        this._id = null;
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

    get id() { return this._id; }

    set id(id) { this._id = id; }

    get $() { return this._table; }

    getSection(isHead) { return this.$.find(isHead ? 'thead' : 'tbody'); }

    get $head() { return this.getSection(true); }

    get $body() { return this.getSection(false); }

    get columnCount() { return this.$.find('tr').eq(0).find('th,td').length; }

    get columns() { return new Columns(this, this.columnIds); }

    get columnIds() { return _.map(_.range(this.columnCount), i => this.columnId(i)); }

    column(column) {
        column = columnId(column);
        if(!_.inRange(column.columnIndex, this.columnCount)) { return null; }
        if(!(this._columns[column] instanceof Column)) {
            this._columns[column] = new Column(this, column);
        }
        return this._columns[column];
    }

    columnId(column) { return columnId(column); }

    getColumns(...columns) { return new Columns(this, _.map(_.flatten(columns), c => this.columnId(c))); }

    getRowCount(isHead) { return this[isHead ? '$head' : '$body'].find('tr').length }

    get rowCount() { return this.getRowCount(false); }

    get headerRowCount() { return this.getRowCount(true); }

    getAllRows(isHead) { return new Rows(this, this.getAllRowIds(isHead)); }

    getAllRowIds(isHead) { return _.map(_.range(this.getRowCount(isHead)), i => this.rowId(i, isHead)); }

    get rows() { return this.getAllRows(false); }

    get headerRows() { return this.getAllRows(true); }

    get rowIds() { return this.getAllRowIds(false); }

    get headerRowIds() { return this.getAllRowIds(true); }

    getBodyRows(...rows) { return new Rows(this, _.map(_.flatten(rows), r => this.rowId(r, false))); }

    getHeaderRows(...rows) { return new Rows(this, _.map(_.flatten(rows), r => this.rowId(r, true))); }

    getRows(...rowIds) { return new Rows(this, _.filter(_.flatten(rowIds), r => r instanceof RowId)); }

    row(row, isHead = false) {
        row = rowId(row, isHead);
        if(!_.inRange(row.rowIndex, this.getRowCount(row.isHead))) { return null; }
        if(!(this._rows[row] instanceof Row)) {
            this._rows[row] = new Row(this, row);
        }
        return this._rows[row];
    }

    rowId(row, isHead = false) { return rowId(row, isHead); }

    headerRow(row) { return this.row(row, true); }

    headerRowId(row) { return this.rowId(row, true); }

    cell(row, column, isHead = false) {
        let cell = cellId(row, column, isHead);
        return (r => r && r.cell(cell.columnId))(this.row(cell.rowId));
    }

    headerCell(row, column) { return this.cell(row, column, true); }

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

    get cellHtmlData() { return this.rows.cellHtmlData; }
    get cellTextData() { return this.rows.cellTextData; }

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

const _addTable = Symbol('addTable');

class QuickTables extends QTIterable {
    constructor(tables = []) {
        super(t => t.tables);
        this._tables = tables;
    }

    get tables() { return _.clone(this._tables); }

    get length() { return this._tables.length; }

    get(index) { return this._tables[index]; }

    getById(id) { return this.find(t => t.id == id); }

    getAll(...indexes) { return new QuickTables(_.filter(_.map(indexes, i => this.get(i)))); }

    getAllById(...ids) { return new QuickTables(_.filter(_.map(ids, i => this.getById(i)))); }

    [_addTable](table) {
        if(table instanceof QuickTable) {
            this._tables.push(table);
        }
    }

    draw() { return this.each(t => t.draw()); }
}

$.fn.QuickTable = function(initFunc = null) {
    let tables = new QuickTables();
    this.filter('table').each(function() {
        const $this = $(this);
        let table = $this.data('quickTable');
        if(!table) {
            table = new QuickTable($this, initFunc);
            $this.data('quickTable', table);
        }
        tables[_addTable](table);
    });
    if(tables.length == 1) {
        return tables.get(0);
    }
    return tables;
}

export { columnId, rowId, cellId };