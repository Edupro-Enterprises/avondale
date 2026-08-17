frappe.pages['cashier-till-close'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Cashier Till Close',
		single_column: true,
	});

	new CashierTillClose(page);
};

class CashierTillClose {
	constructor(page) {
		this.page = page;
		this.body = $('<div class="cashier-till-close-wrapper" style="max-width: 640px;"></div>').appendTo(
			this.page.main
		);
		this.load();
	}

	load() {
		this.body.html('<p class="text-muted">Loading till status…</p>');
		frappe.call({
			method: 'edupro_financials.cashier.get_till_context',
			callback: (r) => {
				this.context = r.message;
				if (this.context.already_closed) {
					this.render_already_closed();
				} else {
					this.render_form();
				}
			},
		});
	}

	render_already_closed() {
		this.body.html(`
			<div class="alert alert-success" style="margin-top: 20px;">
				<strong>Till already closed for today.</strong><br>
				${frappe.datetime.str_to_user(this.context.reconciliation_date)} —
				<a href="/app/daily-cashier-reconciliation/${this.context.existing_name}">
					View reconciliation ${this.context.existing_name}
				</a>
			</div>
		`);
	}

	render_form() {
		this.body.empty();

		$(`
			<div style="margin: 10px 0 20px;">
				<div class="text-muted">Cashier</div>
				<div style="font-size: 16px; font-weight: 600;">${frappe.session.user_fullname || this.context.cashier_user}</div>
				<div class="text-muted" style="margin-top: 6px;">Reconciliation Date</div>
				<div style="font-size: 16px; font-weight: 600;">${frappe.datetime.str_to_user(this.context.reconciliation_date)}</div>
			</div>
		`).appendTo(this.body);

		$(`
			<div class="alert alert-warning">
				<strong>Blind count:</strong> enter what you physically counted and the digital
				batch totals below. The system-expected total and any variance are only
				calculated after you close the till.
			</div>
		`).appendTo(this.body);

		const form_wrapper = $('<div class="cashier-form"></div>').appendTo(this.body);

		this.field_group = new frappe.ui.FieldGroup({
			fields: [
				{
					fieldname: 'opening_float',
					label: 'Opening Float (USD)',
					fieldtype: 'Currency',
					default: 0,
				},
				{ fieldtype: 'Section Break', label: 'Physical & Digital Takings' },
				{
					fieldname: 'usd_cash_counted',
					label: 'USD Cash Counted',
					fieldtype: 'Currency',
					default: 0,
				},
				{
					fieldname: 'zig_cash_counted',
					label: 'ZiG Cash Counted',
					fieldtype: 'Currency',
					options: 'ZiG',
					default: 0,
				},
				{ fieldtype: 'Column Break' },
				{
					fieldname: 'ecocash_batch_total',
					label: 'EcoCash Batch Total',
					fieldtype: 'Currency',
					default: 0,
				},
				{
					fieldname: 'zipit_batch_total',
					label: 'ZIPIT Batch Total',
					fieldtype: 'Currency',
					default: 0,
				},
				{ fieldtype: 'Section Break', label: 'Sign-off' },
				{
					fieldname: 'bursar_signature',
					label: 'Bursar Signature',
					fieldtype: 'Signature',
				},
			],
			body: form_wrapper,
		});
		this.field_group.make();

		this.close_btn = $(`
			<button class="btn btn-primary btn-lg" style="margin-top: 20px; width: 100%;">
				Close Till
			</button>
		`)
			.appendTo(this.body)
			.on('click', () => this.close_till());

		this.result_wrapper = $('<div class="till-result" style="margin-top: 20px;"></div>').appendTo(this.body);
	}

	close_till() {
		const values = this.field_group.get_values();
		if (!values) return;

		this.close_btn.prop('disabled', true).text('Closing till…');
		this.result_wrapper.empty();

		frappe.call({
			method: 'edupro_financials.cashier.close_till',
			args: values,
			callback: (r) => {
				this.close_btn.prop('disabled', false).text('Close Till');
				if (r.message) {
					this.render_result(r.message);
				}
			},
			error: () => {
				this.close_btn.prop('disabled', false).text('Close Till');
			},
		});
	}

	render_result(result) {
		const balanced = Math.abs(result.variance_usd) < 0.01;
		const box_class = balanced ? 'alert-success' : 'alert-danger';
		const heading = balanced ? 'Till Balanced' : 'Variance Detected';

		this.result_wrapper.html(`
			<div class="alert ${box_class}">
				<strong>${heading}</strong><br>
				System Expected USD: ${format_currency(result.system_expected_usd, 'USD')}<br>
				Variance: ${format_currency(result.variance_usd, 'USD')}<br>
				<a href="/app/daily-cashier-reconciliation/${result.name}">View reconciliation ${result.name}</a>
			</div>
		`);
		this.close_btn.hide();
	}
}
