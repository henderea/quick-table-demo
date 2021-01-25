import './index.scss';
import * as $ from 'jquery';
import * as _ from 'lodash';
import { JQueryQuickTable, QuickTable, Column, SortDef, setup } from '@henderea/quick-table';

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
  favNum: number;
}

const data: Entry[] = [
  {
    fn: 'Eric',
    ln: 'Henderson',
    favNum: 8
  },
  {
    fn: 'Michael',
    ln: 'Henderson',
    favNum: 7
  },
  {
    fn: 'John',
    ln: 'Goins',
    favNum: 3
  },
  {
    fn: 'Ken',
    ln: 'Grafals',
    favNum: 11
  }
];

$(function() {
  const displaySortOrders = (table: QuickTable<Entry>) => {
    const sortOrders: SortDef[] = table.sortOrders;
    table.columns.each((c: Column<Entry>) => {
      const orderIndex: number = _.findIndex(sortOrders, (o: SortDef) => o[0] == c.index);
      const span: JQuery = c.$head.find('.sort-order');
      if(orderIndex >= 0) {
        span.text(`${orderIndex + 1}: ${sortOrders[orderIndex][1]}`);
      } else {
        span.text('-');
      }
    });
  };
  let qTable: QuickTable<Entry> = $('#quickTable').QuickTable((table: QuickTable<Entry>) => {
    table.columnDefs = [
      {
        data: 'fn',
        type: 'string',
        cssClass: 'center'
      },
      {
        data: 'ln',
        type: 'string'
      },
      {
        type: 'string',
        render(data: any, row: Entry) { return `${row.fn} ${row.ln}`; }
      },
      {
        data: 'fn',
        type: 'html',
        html: true,
        render(data: string, row: Entry) { return `<b>${row.ln}</b>, ${data}`; }
      },
      {
        data: 'favNum',
        type: 'num'
      }
    ];
    table.sortOrders = [[0, 'asc'], [1, 'asc']];
    table.columns.each((c: Column<Entry>) => {
      const $check: JQuery = $(`input[data-column="${c.index}"]`);
      const col: Column<Entry> = c;
      c.on('column.visible', (e: any) => { $check.prop('checked', e.visible); })
       .trigger('column.visible', { visible: c.visible });
      $check.on('change', () => { col.visible = $check.is(':checked'); });
      let searchField: HTMLInputElement = c.$head.find('input').get(0);
      searchField.addEventListener('input', () => {
        const $this: JQuery = $(searchField);
        const filter: string = ($this.val() || '') as string;
        col.setFilter(filter, true)
           .applyFilters();
      });
      col.$head.eq(0).on('click', () => {
        table.toggleSort(col.index);
        displaySortOrders(table);
      });
    });
    table.data = data;
    table.on('draw', () => {
      table.when
           .cell(0, 0)
           .do(
             c => c.$
                   .css('font-weight', 'bold')
                   .css('font-style', 'italic')
                   .css('color', '#949494')
                   .css('text-decoration', 'underline')
           );
    });
  }).draw() as QuickTable<Entry>;
  displaySortOrders(qTable);
  qTable.clearFilters();
  $('#export-link').on('click', () => {
    let headers: string[] = ['First', 'Last', 'First Last', 'Last, First'];
    let data: any[] = qTable.rows.filter(r => r.visible).cellData;
    let csv: string = _.join(
      _.map(
        [headers, ...data],
        d => _.join(
          _.map(d, v => `"${String(v).replace(/"/g, '""')}"`),
          ','
        )
      ),
      '\n'
    ).replace(/(^\[)|(]$)/mg, '');
    $('#export-div').html(_.escape(csv));
  });
});