frappe.pages['multi-currency-ledger'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Multi-Currency Ledger',
		single_column: true,
	});

	new MultiCurrencyLedger(page);
};

class MultiCurrencyLedger {
	constructor(page) {
		this.page = page;
		this.filters = {
			from_date: frappe.datetime.year_start(),
			to_date: frappe.datetime.now_date(),
			fund: null,
			account: null,
			currency: null,
			voucher_type: null,
		};

		this.summary_wrapper = $('<div class="ledger-summary" style="margin-bottom: 15px;"></div>').appendTo(
			this.page.main
		);
		this.table_wrapper = $('<div class="ledger-table"></div>').appendTo(this.page.main);

		this.setup_filters();
		this.load();
	}

	setup_filters() {
		this.page.add_field({
			fieldname: 'from_date',
			label: 'From Date',
			fieldtype: 'Date',
			default: this.filters.from_date,
			change: () => {
				this.filters.from_date = this.page.fields_dict.from_date.get_value();
				this.load();
			},
		});

		this.page.add_field({
			fieldname: 'to_date',
			label: 'To Date',
			fieldtype: 'Date',
			default: this.filters.to_date,
			change: () => {
				this.filters.to_date = this.page.fields_dict.to_date.get_value();
				this.load();
			},
		});

		this.page.add_field({
			fieldname: 'fund',
			label: 'Fund',
			fieldtype: 'Link',
			options: 'Fund',
			change: () => {
				this.filters.fund = this.page.fields_dict.fund.get_value();
				this.load();
			},
		});

		this.page.add_field({
			fieldname: 'account',
			label: 'Account',
			fieldtype: 'Link',
			options: 'Account',
			change: () => {
				this.filters.account = this.page.fields_dict.account.get_value();
				this.load();
			},
		});

		this.page.add_field({
			fieldname: 'currency',
			label: 'Currency',
			fieldtype: 'Link',
			options: 'Currency',
			change: () => {
				this.filters.currency = this.page.fields_dict.currency.get_value();
				this.load();
			},
		});

		this.page.add_field({
			fieldname: 'voucher_type',
			label: 'Voucher Type',
			fieldtype: 'Select',
			options: '\nJournal Entry\nSales Invoice\nPayment Entry\nPurchase Invoice\nPurchase Order\nFees',
			change: () => {
				this.filters.voucher_type = this.page.fields_dict.voucher_type.get_value();
				this.load();
			},
		});
	}

	load() {
		this.table_wrapper.html('<p class="text-muted">Loading ledger…</p>');

		frappe.call({
			method: 'edupro_financials.ledger.get_ledger_entries',
			args: this.filters,
			callback: (r) => {
				const data = r.message || { entries: [], totals_by_currency: {} };
				this.render_summary(data.totals_by_currency);
				this.render_table(data.entries);
			},
		});
	}

	render_summary(totals_by_currency) {
		this.summary_wrapper.empty();
		const currencies = Object.keys(totals_by_currency);

		if (!currencies.length) {
			this.summary_wrapper.html('<p class="text-muted">No currency totals for the current filters.</p>');
			return;
		}

		const row = $('<div class="row"></div>').appendTo(this.summary_wrapper);
		currencies.forEach((currency) => {
			const t = totals_by_currency[currency];
			const net = t.debit - t.credit;
			const net_txn = t.debit_in_account_currency - t.credit_in_account_currency;
			$(`
				<div class="col-sm-4" style="margin-bottom: 10px;">
					<div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 12px;">
						<div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">${currency}</div>
						<div class="text-muted" style="font-size: 12px;">Debit (${currency})</div>
						<div>${format_currency(t.debit_in_account_currency, currency)}</div>
						<div class="text-muted" style="font-size: 12px; margin-top: 4px;">Credit (${currency})</div>
						<div>${format_currency(t.credit_in_account_currency, currency)}</div>
						<div class="text-muted" style="font-size: 12px; margin-top: 4px;">Net (${currency})</div>
						<div style="font-weight: 600;">${format_currency(net_txn, currency)}</div>
						<hr style="margin: 8px 0;">
						<div class="text-muted" style="font-size: 12px;">USD Equivalent (Net)</div>
						<div style="font-weight: 600;">${format_currency(net, 'USD')}</div>
					</div>
				</div>
			`).appendTo(row);
		});
	}

	render_table(entries) {
		this.table_wrapper.empty();

		if (!entries.length) {
			this.table_wrapper.html('<p class="text-muted">No ledger entries for the current filters.</p>');
			return;
		}

		const table = $(`
			<table class="table table-bordered table-condensed">
				<thead>
					<tr>
						<th>Date</th>
						<th>Voucher</th>
						<th>Account</th>
						<th>Fund</th>
						<th>Currency</th>
						<th class="text-right">Debit (Txn)</th>
						<th class="text-right">Credit (Txn)</th>
						<th class="text-right">Debit (USD)</th>
						<th class="text-right">Credit (USD)</th>
						<th class="text-right">Running Balance (USD)</th>
					</tr>
				</thead>
				<tbody></tbody>
			</table>
		`).appendTo(this.table_wrapper);

		const tbody = table.find('tbody');

		entries.forEach((row) => {
			const currency_badge =
				row.account_currency === 'USD'
					? `<span class="indicator-pill blue">USD</span>`
					: `<span class="indicator-pill orange">${frappe.utils.escape_html(row.account_currency || '')}</span>`;

			tbody.append(`
				<tr>
					<td>${frappe.datetime.str_to_user(row.posting_date)}</td>
					<td><a href="/app/${frappe.router.slug(row.voucher_type)}/${encodeURIComponent(row.voucher_no)}">${frappe.utils.escape_html(row.voucher_no)}</a><br><span class="text-muted" style="font-size: 11px;">${frappe.utils.escape_html(row.voucher_type)}</span></td>
					<td>${frappe.utils.escape_html(row.account)}</td>
					<td>${frappe.utils.escape_html(row.fund || '')}</td>
					<td>${currency_badge}</td>
					<td class="text-right">${row.debit_in_account_currency ? format_currency(row.debit_in_account_currency, row.account_currency) : ''}</td>
					<td class="text-right">${row.credit_in_account_currency ? format_currency(row.credit_in_account_currency, row.account_currency) : ''}</td>
					<td class="text-right">${row.debit ? format_currency(row.debit, 'USD') : ''}</td>
					<td class="text-right">${row.credit ? format_currency(row.credit, 'USD') : ''}</td>
					<td class="text-right">${format_currency(row.running_balance, 'USD')}</td>
				</tr>
			`);
		});
	}
}
