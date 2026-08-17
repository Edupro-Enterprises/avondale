frappe.pages['notes-to-financial-statements'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Notes to the Financial Statements',
		single_column: true,
	});

	new NotesToFinancialStatements(page);
};

class NotesToFinancialStatements {
	constructor(page) {
		this.page = page;

		this.page.add_field({
			fieldname: 'academic_year',
			label: 'Academic Year',
			fieldtype: 'Link',
			options: 'Academic Year',
			change: () => this.load(),
		});
		this.page.add_field({
			fieldname: 'as_on_date',
			label: 'As On Date',
			fieldtype: 'Date',
			default: frappe.datetime.get_today(),
			change: () => this.load(),
		});

		this.page.set_primary_action('Print', () => window.print(), 'printer');

		this.body = $('<div class="notes-body" style="max-width: 900px; margin-top: 15px;"></div>').appendTo(
			this.page.main
		);
		this.load();
	}

	load() {
		const academic_year = this.page.fields_dict.academic_year.get_value();
		const as_on_date = this.page.fields_dict.as_on_date.get_value();

		frappe.call({
			method: 'edupro_financials.notes_to_accounts.get_notes',
			args: { academic_year, as_on_date },
			callback: (r) => this.render(r.message),
		});
	}

	render(data) {
		this.body.empty();
		this.render_policies(data.accounting_policies);
		this.render_note_10(data.note_10_arrears_aging);
		this.render_note_11(data.note_11_bank_cash_balances);
		this.render_mopse_reconciliation(data.mopse_fee_approval_reconciliation);
	}

	render_policies(policies) {
		const section = $(`<div style="margin-bottom: 30px;"><h3>Note 1 — Accounting Policies</h3></div>`).appendTo(
			this.body
		);
		policies.forEach((p, i) => {
			section.append(`
				<div style="margin-bottom: 14px;">
					<strong>1.${i + 1} ${frappe.utils.escape_html(p.title)}</strong>
					<p style="color: var(--text-muted); margin-top: 4px;">${frappe.utils.escape_html(p.text)}</p>
				</div>
			`);
		});
	}

	render_note_10(note10) {
		const rows = Object.entries(note10.buckets)
			.map(
				([bucket, amount]) => `
				<tr><td>${bucket}</td><td class="text-right">${format_currency(amount, 'USD')}</td></tr>
			`
			)
			.join('');
		$(`
			<div style="margin-bottom: 30px;">
				<h3>Note 10 — Fee Arrears Ageing</h3>
				<table class="table table-bordered" style="max-width: 500px;">
					<thead><tr><th>Age Bucket</th><th class="text-right">Outstanding (USD)</th></tr></thead>
					<tbody>
						${rows}
						<tr style="font-weight: bold;"><td>Total Receivables</td><td class="text-right">${format_currency(note10.total, 'USD')}</td></tr>
					</tbody>
				</table>
			</div>
		`).appendTo(this.body);
	}

	render_note_11(rows) {
		const body =
			rows
				.map(
					(r) => `
					<tr>
						<td>${frappe.utils.escape_html(r.account)}</td>
						<td>${frappe.utils.escape_html(r.currency)}</td>
						<td class="text-right">${format_currency(r.balance, r.currency)}</td>
					</tr>
				`
				)
				.join('') || '<tr><td colspan="3" class="text-muted">No cash/bank accounts with activity.</td></tr>';

		$(`
			<div style="margin-bottom: 30px;">
				<h3>Note 11 — Bank and Cash Float Balances</h3>
				<table class="table table-bordered" style="max-width: 600px;">
					<thead><tr><th>Account</th><th>Currency</th><th class="text-right">Balance</th></tr></thead>
					<tbody>${body}</tbody>
				</table>
			</div>
		`).appendTo(this.body);
	}

	render_mopse_reconciliation(rows) {
		const body =
			rows
				.map(
					(r) => `
					<tr>
						<td>${frappe.utils.escape_html(r.academic_year)} ${frappe.utils.escape_html(r.term)}</td>
						<td>${frappe.utils.escape_html(r.approval_ref_number)}</td>
						<td class="text-right">${format_currency(r.approved_usd_fee, 'USD')}</td>
						<td class="text-right">${format_currency(r.actual_fee_structure_total, 'USD')}</td>
						<td>${r.within_approved_limit ? '<span class="indicator-pill green">Within Limit</span>' : '<span class="indicator-pill red">Exceeds Approval</span>'}</td>
						<td>${r.submitted ? '<span class="indicator-pill blue">Submitted</span>' : '<span class="indicator-pill orange">Draft</span>'}</td>
					</tr>
				`
				)
				.join('') || '<tr><td colspan="6" class="text-muted">No MoPSE Fee Approval records found.</td></tr>';

		$(`
			<div style="margin-bottom: 30px;">
				<h3>MoPSE Fee Approval Reconciliation</h3>
				<table class="table table-bordered">
					<thead>
						<tr>
							<th>Period</th><th>Approval Ref</th>
							<th class="text-right">Approved (USD)</th><th class="text-right">Fee Structure Total (USD)</th>
							<th>Status</th><th>Approval Status</th>
						</tr>
					</thead>
					<tbody>${body}</tbody>
				</table>
			</div>
		`).appendTo(this.body);
	}
}
