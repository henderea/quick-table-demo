import './index.scss';
import * as $ from 'jquery';
import * as _ from 'lodash';
import { JQueryQuickTable, QuickTable, Column, Row, Cell, setup } from '@henderea/quick-table';

setup($, _);

declare const window: any;
window.$ = $;
window._ = _;
window.VERCEL_URL = process.env.VERCEL_URL;

declare global {
  interface JQuery {
    QuickTable: JQueryQuickTable;
  }
}

// @ts-ignore
import registerServiceWorker from '@henderea/static-site-builder/registerServiceWorker';

if(process.env.NODE_ENV === 'production') {
  registerServiceWorker();
}

declare interface Entry {
  fn: string;
  ln: string;
}

const data: Entry[] = [
  {
    fn: 'Eric',
    ln: 'Henderson'
  },
  {
    fn: 'Michael',
    ln: 'Henderson'
  },
  {
    fn: 'John',
    ln: 'Goins'
  },
  {
    fn: 'Ken',
    ln: 'Grafals'
  }
];

$(function() {
  const filters: string[] = ['', '', '', ''];
  const checkFilter = (f: string, c: Cell<Entry> | null) => !f || f == '' || !c || new RegExp(f, 'i').test(String(c.data));
  const applyFilters = (table: QuickTable<Entry>) => {
    table.rows
         .partitionOutOver(filters, (r: Row<Entry>, f: string, i: number) => checkFilter(f, r.cell(i)))
         .withIncluded(r => r.visible = true)
         .withExcluded(r => r.visible = false);
  };
  let qTable: QuickTable<Entry> = $('#quickTable').QuickTable((table: QuickTable<Entry>) => {
    table.columnDefs = [
      {
        data: 'fn',
        cssClass: 'center'
      },
      { data: 'ln' },
      { render(data: any, row: Entry) { return `${row.fn} ${row.ln}`; } },
      {
        data: 'fn',
        html: true,
        render(data: string, row: Entry) { return `<b>${row.ln}</b>, ${data}`; }
      }
    ];
    table.columns.each((c: Column<Entry>) => {
      const $check = $(`input[data-column="${c.index}"]`);
      const col: Column<Entry> = c;
      c.on('column.visible', e => { $check.prop('checked', e.visible); })
       .trigger('column.visible', { visible: c.visible });
      $check.on('change', () => { col.visible = $check.is(':checked'); });
      let searchField = c.$head.find('input').get(0);
      searchField.addEventListener('input', () => {
        const $this: JQuery = $(searchField);
        filters[col.index] = ($this.val() || '') as string;
        applyFilters(table);
      });
    });
    table.data = data;
    table.on('draw', () => {
      table.when.cell(0, 0).do(c => c.$.css('font-weight', 'bold').css('font-style', 'italic').css('color', '#949494').css('text-decoration', 'underline'));
    });
  }).draw() as QuickTable<Entry>;
  applyFilters(qTable);
  $('#export-link').on('click', () => {
    let headers = ['First', 'Last', 'First Last', 'Last, First'];
    let data = qTable.rows.filter(r => r.visible).cellData;
    let csv = _.join(_.map([headers, ...data], d => _.join(_.map(d, v => `"${v.replace(/"/g, '""')}"`), ',')), '\n').replace(/(^\[)|(]$)/mg, '');
    $('#export-div').html(_.escape(csv));
  });
});