frappe.pages['auditor-exception-dashboard'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Auditor Exception Dashboard',
		single_column: true,
	});

	new AuditorExceptionDashboard(page);
};

const SECTIONS = [
	{
		key: 'cancelled_receipts',
		title: 'Cancelled Receipts',
		empty: 'No cancelled receipts in this period.',
		columns: [
			{ label: 'Receipt', field: 'name' },
			{ label: 'Student', field: 'student_name' },
			{ label: 'Amount', field: 'grand_total', currency: true },
			{ label: 'Cancelled By', field: 'owner' },
			{ label: 'Cancelled On', field: 'modified', date: true },
		],
	},
	{
		key: 'manual_cash_entries',
		title: 'Direct Manual GL Entries to Cash',
		empty: 'No direct manual journal entries to a cash account in this period.',
		columns: [
			{ label: 'Journal Entry', field: 'name' },
			{ label: 'Posting Date', field: 'posting_date', date: true },
			{ label: 'Amount', field: 'total_debit', currency: true },
			{ label: 'Remark', field: 'user_remark' },
			{ label: 'Created By', field: 'owner' },
		],
	},
	{
		key: 'backdated_vouchers',
		title: 'Backdated Vouchers',
		empty: 'No backdated vouchers (posting date materially earlier than creation) in this period.',
		columns: [
			{ label: 'Voucher', field: 'name' },
			{ label: 'Type', field: 'doctype' },
			{ label: 'Posting Date', field: 'posting_date', date: true },
			{ label: 'Created On', field: 'creation', date: true },
			{ label: 'Created By', field: 'owner' },
		],
	},
	{
		key: 'unreconciled_till_balances',
		title: 'Un-Reconciled Till Balances',
		empty: 'No till reconciliations with a variance in this period.',
		columns: [
			{ label: 'Reconciliation', field: 'name' },
			{ label: 'Cashier', field: 'cashier_user' },
			{ label: 'Date', field: 'reconciliation_date', date: true },
			{ label: 'Variance (USD)', field: 'variance_usd', currency: true },
		],
	},
	{
		key: 'receipt_sequence_gaps',
		title: 'Receipt Sequence Gaps',
		empty: 'No gaps in the sequential receipt numbering — all clear.',
		not_period_filtered: true,
		columns: [
			{ label: 'Missing Receipt No', field: 'missing_receipt_no' },
			{ label: 'Terminal', field: 'terminal' },
			{ label: 'Year', field: 'year' },
		],
	},
];

class AuditorExceptionDashboard {
	constructor(page) {
		this.page = page;
		this.days = 30;

		this.page.add_field({
			fieldname: 'days',
			label: 'Lookback',
			fieldtype: 'Select',
			options: '7\n30\n90\n180',
			default: '30',
			change: () => {
				this.days = cint(this.page.fields_dict.days.get_value()) || 30;
				this.load();
			},
		});

		this.page.set_primary_action('Refresh', () => this.load(), 'refresh');

		this.summary_wrapper = $('<div class="exception-summary row" style="margin: 15px 0;"></div>').appendTo(
			this.page.main
		);
		this.sections_wrapper = $('<div class="exception-sections"></div>').appendTo(this.page.main);

		this.load();
	}

	load() {
		this.summary_wrapper.html('<p class="text-muted">Loading…</p>');
		this.sections_wrapper.empty();

		frappe.call({
			method: 'edupro_financials.auditor_dashboard.get_exceptions',
			args: { days: this.days },
			callback: (r) => {
				const data = r.message || {};
				this.render_summary(data);
				this.render_sections(data);
			},
		});
	}

	render_summary(data) {
		this.summary_wrapper.empty();
		SECTIONS.forEach((section) => {
			const count = (data[section.key] || []).length;
			const color = count > 0 ? '#e24c4c' : '#2c9';
			$(`
				<div class="col-sm-3">
					<div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 14px; text-align: center;">
						<div style="font-size: 28px; font-weight: 700; color: ${color};">${count}</div>
						<div class="text-muted" style="font-size: 12px;">${section.title}</div>
					</div>
				</div>
			`).appendTo(this.summary_wrapper);
		});
	}

	render_sections(data) {
		SECTIONS.forEach((section) => {
			const rows = data[section.key] || [];
			const section_el = $(`
				<div style="margin-bottom: 25px;">
					<h5>${section.title}</h5>
				</div>
			`).appendTo(this.sections_wrapper);

			if (!rows.length) {
				$(`<p class="text-muted">${section.empty}</p>`).appendTo(section_el);
				return;
			}

			const table = $('<table class="table table-bordered"></table>').appendTo(section_el);
			const thead = $('<thead><tr></tr></thead>').appendTo(table);
			section.columns.forEach((col) => {
				thead.find('tr').append(`<th>${col.label}</th>`);
			});

			const tbody = $('<tbody></tbody>').appendTo(table);
			rows.forEach((row) => {
				const tr = $('<tr></tr>').appendTo(tbody);
				section.columns.forEach((col) => {
					let value = row[col.field];
					if (col.currency) {
						value = format_currency(value || 0, 'USD');
					} else if (col.date && value) {
						value = frappe.datetime.str_to_user(value);
					} else {
						value = frappe.utils.escape_html(value || '');
					}
					tr.append(`<td>${value}</td>`);
				});
			});
		});
	}
}
