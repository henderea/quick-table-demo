import './index.scss';
import $ from 'jquery';
import _ from 'lodash';
import './quickTable';

import registerServiceWorker from '@henderea/static-site-builder/registerServiceWorker';
registerServiceWorker();

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
        table.columns.each(c => {
            const $check = $(`input[data-column="${c.index}"]`);
            const col = c;
            c.on('column.visible', e => { $check.prop('checked', e.visible); })
                .trigger('column.visible', { visible: c.visible });
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