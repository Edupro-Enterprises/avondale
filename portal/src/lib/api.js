// Thin client for the Frappe REST API, proxied same-origin via /api (see
// astro.config.mjs). No SDK, no build step needed for this - the portal
// only ever calls a small number of whitelisted edupro_financials methods.

const BASE = '/api/method';

class ApiError extends Error {
	constructor(message, httpStatus) {
		super(message);
		this.httpStatus = httpStatus;
	}
}

async function call(method, args, { method: httpMethod = 'POST' } = {}) {
	const url = new URL(`${BASE}/${method}`, window.location.origin);
	const opts = {
		method: httpMethod,
		credentials: 'include',
		headers: {},
	};

	if (httpMethod === 'GET') {
		for (const [k, v] of Object.entries(args || {})) {
			if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
		}
	} else {
		opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
		opts.body = new URLSearchParams(args || {});
	}

	const res = await fetch(url, opts);
	let body;
	try {
		body = await res.json();
	} catch {
		body = {};
	}

	if (!res.ok) {
		const message = body.message || body.exception || `Request failed (${res.status})`;
		throw new ApiError(typeof message === 'string' ? message.split('\n')[0] : 'Request failed', res.status);
	}
	return body.message;
}

export const api = {
	async login(usr, pwd) {
		return call('login', { usr, pwd });
	},
	async logout() {
		return call('logout', {});
	},
	async getSession() {
		return call('edupro_financials.portal.get_session_info', {}, { method: 'GET' });
	},
	async getTillContext() {
		return call('edupro_financials.cashier.get_till_context', {}, { method: 'GET' });
	},
	async closeTill(payload) {
		return call('edupro_financials.cashier.close_till', payload);
	},
	async getExceptions(days) {
		return call('edupro_financials.auditor_dashboard.get_exceptions', { days }, { method: 'GET' });
	},
	async getOversightSummary() {
		return call('edupro_financials.oversight.get_summary', {}, { method: 'GET' });
	},
	async getLedgerEntries(filters) {
		return call('edupro_financials.ledger.get_ledger_entries', filters, { method: 'GET' });
	},
	async getStatutoryReport(reportKey, filters) {
		return call(
			'edupro_financials.statutory_reports.get_statutory_report',
			{ report_key: reportKey, filters: JSON.stringify(filters || {}) },
			{ method: 'GET' }
		);
	},
	async getReportDefaultFilters() {
		return call('edupro_financials.statutory_reports.get_default_filters', {}, { method: 'GET' });
	},
	async getFinancialNotes(academicYear, asOnDate) {
		return call(
			'edupro_financials.notes_to_accounts.get_notes',
			{ academic_year: academicYear, as_on_date: asOnDate },
			{ method: 'GET' }
		);
	},
	async searchFees(filters) {
		return call('edupro_financials.fees_browser.search_fees', filters, { method: 'GET' });
	},
	async getFeesFilterOptions() {
		return call('edupro_financials.fees_browser.get_filter_options', {}, { method: 'GET' });
	},
	async getStudentStatement(student, academicTerm, academicYear) {
		return call(
			'edupro_financials.fees_browser.get_student_statement',
			{ student, academic_term: academicTerm, academic_year: academicYear },
			{ method: 'GET' }
		);
	},
	async getProcurementFormOptions() {
		return call('edupro_financials.procurement.get_form_options', {}, { method: 'GET' });
	},
	async createSupplier(supplierName) {
		return call('edupro_financials.procurement.create_supplier', { supplier_name: supplierName });
	},
	async getVoteBookBalance(expenseAccount, fundCategory, fiscalYear) {
		return call(
			'edupro_financials.procurement.get_vote_book_balance',
			{ expense_account: expenseAccount, fund_category: fundCategory, fiscal_year: fiscalYear },
			{ method: 'GET' }
		);
	},
	async createRequisition(supplier, fiscalYear, scheduleDate, items) {
		return call('edupro_financials.procurement.create_requisition', {
			supplier,
			fiscal_year: fiscalYear,
			schedule_date: scheduleDate,
			items: JSON.stringify(items),
		});
	},
	async attachProcurementFiles(purchaseOrder, flags) {
		return call('edupro_financials.procurement.attach_procurement_files', {
			purchase_order: purchaseOrder,
			...flags,
		});
	},
	async submitRequisition(purchaseOrder) {
		return call('edupro_financials.procurement.submit_requisition', { purchase_order: purchaseOrder });
	},
	async listRequisitions() {
		return call('edupro_financials.procurement.list_requisitions', {}, { method: 'GET' });
	},
	async getRequisitionDetail(purchaseOrder) {
		return call(
			'edupro_financials.procurement.get_requisition_detail',
			{ purchase_order: purchaseOrder },
			{ method: 'GET' }
		);
	},
	async getIgpFormOptions() {
		return call('edupro_financials.igp_sales.get_form_options', {}, { method: 'GET' });
	},
	async createIgpSale(itemCode, description, amount, modeOfPayment, terminal) {
		return call('edupro_financials.igp_sales.create_sale', {
			item_code: itemCode,
			description,
			amount,
			mode_of_payment: modeOfPayment,
			terminal,
		});
	},
	async listIgpSales() {
		return call('edupro_financials.igp_sales.list_sales', {}, { method: 'GET' });
	},
	async getIgpProjectTotals() {
		return call('edupro_financials.igp_sales.get_project_totals', {}, { method: 'GET' });
	},
	async uploadFile(file, doctype, docname) {
		const form = new FormData();
		form.append('file', file);
		if (doctype) form.append('doctype', doctype);
		if (docname) form.append('docname', docname);
		form.append('is_private', '1');
		const res = await fetch(`${BASE}/upload_file`, {
			method: 'POST',
			credentials: 'include',
			body: form,
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok) {
			const message = body.message || body.exception || `Upload failed (${res.status})`;
			throw new ApiError(typeof message === 'string' ? message.split('\n')[0] : 'Upload failed', res.status);
		}
		return body.message;
	},
	async getExemptionFormOptions() {
		return call('edupro_financials.exemptions.get_form_options', {}, { method: 'GET' });
	},
	async searchStudents(query) {
		return call('edupro_financials.exemptions.search_students', { query }, { method: 'GET' });
	},
	async createExemption(payload) {
		return call('edupro_financials.exemptions.create_exemption', payload);
	},
	async listExemptions() {
		return call('edupro_financials.exemptions.list_exemptions', {}, { method: 'GET' });
	},
};

export function requireSession() {
	return api.getSession().catch(() => {
		window.location.href = '/login';
		return null;
	});
}

// Defense in depth: the backend already blocks any write a role isn't
// permitted to make (Custom DocPerm), but the UI shouldn't even render a
// page for a role it doesn't belong to - a Headmaster typing /bursar/
// directly would otherwise see the till-close form (just unable to submit
// it). Call this at the top of each role page's script.
export async function requireRole(allowedRoles) {
	let session;
	try {
		session = await api.getSession();
	} catch {
		window.location.href = '/login';
		return null;
	}
	if (!allowedRoles.includes(session.primary_role)) {
		window.location.href = '/';
		return null;
	}
	return session;
}

export { ApiError };
