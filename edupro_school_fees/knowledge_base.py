"""API for the edupro-theme /help knowledge base's local-first features
(favourites, reading progress, feedback, comments, analytics -- see that
repo's docs/knowledge-base/architecture.md for the frontend side of this).

Every article lives as an MDX file in the frontend repo, not as a Frappe
record -- there is no "KB Article" doctype here, so every method below
takes a plain `article_slug` string and never validates it against
anything server-side (an unknown slug just accumulates activity rows that
map to nothing; harmless, and content-loader.ts's own slug uniqueness
check is what actually guards against a bad slug in practice).

Any signed-in user may call these (allow_guest is never set) -- the
knowledge base has no anonymous/public access yet, matching edupro-theme's
own requireAnyAuth() route guard."""

import frappe


def _get_or_none(doctype, filters):
	name = frappe.db.exists(doctype, filters)
	return frappe.get_doc(doctype, name) if name else None


@frappe.whitelist()
def get_my_kb_state():
	"""One combined read for the current user's whole KB activity --
	favourites, progress, and feedback votes across every article -- so
	both an article page and the Library page can hydrate from a single
	call instead of one request per article."""
	activity = frappe.db.get_list(
		"KB Reading Activity",
		filters={"user": frappe.session.user},
		fields=["article_slug", "is_favourite", "status", "last_visited"],
	)
	feedback = frappe.db.get_list(
		"KB Feedback",
		filters={"user": frappe.session.user},
		fields=["article_slug", "vote"],
	)

	favourites = [a.article_slug for a in activity if a.is_favourite]
	progress = {a.article_slug: a.status for a in activity if a.status}
	recent = sorted(
		[{"slug": a.article_slug, "visited_at": a.last_visited} for a in activity],
		key=lambda a: a["visited_at"],
		reverse=True,
	)
	votes = {f.article_slug: f.vote.lower() for f in feedback}

	return {"favourites": favourites, "progress": progress, "recent": recent, "votes": votes}


@frappe.whitelist()
def toggle_favourite(article_slug):
	doc = _get_or_none("KB Reading Activity", {"article_slug": article_slug, "user": frappe.session.user})
	if doc:
		doc.is_favourite = 0 if doc.is_favourite else 1
		doc.save()
	else:
		doc = frappe.get_doc({
			"doctype": "KB Reading Activity",
			"article_slug": article_slug,
			"user": frappe.session.user,
			"is_favourite": 1,
		}).insert()
	return {"is_favourite": bool(doc.is_favourite)}


@frappe.whitelist()
def update_progress(article_slug, status):
	if status not in ("In Progress", "Read"):
		frappe.throw('status must be "In Progress" or "Read".')

	doc = _get_or_none("KB Reading Activity", {"article_slug": article_slug, "user": frappe.session.user})
	if doc:
		doc.status = status
		doc.last_visited = frappe.utils.now()
		doc.save()
	else:
		doc = frappe.get_doc({
			"doctype": "KB Reading Activity",
			"article_slug": article_slug,
			"user": frappe.session.user,
			"status": status,
		}).insert()
	return {"status": doc.status}


@frappe.whitelist()
def submit_feedback(article_slug, vote, comment=None):
	vote = (vote or "").capitalize()
	if vote not in ("Up", "Down"):
		frappe.throw('vote must be "up" or "down".')

	doc = _get_or_none("KB Feedback", {"article_slug": article_slug, "user": frappe.session.user})
	if doc:
		doc.vote = vote
		if comment is not None:
			# A re-vote (e.g. just clicking thumbs-up again) never passes a
			# comment -- don't let that silently wipe one the user wrote
			# earlier via a comment-carrying submission.
			doc.comment = comment
		doc.submitted_on = frappe.utils.now()
		doc.save()
	else:
		doc = frappe.get_doc({
			"doctype": "KB Feedback",
			"article_slug": article_slug,
			"user": frappe.session.user,
			"vote": vote,
			"comment": comment,
		}).insert()
	return {"vote": doc.vote.lower()}


@frappe.whitelist()
def get_comments(article_slug):
	rows = frappe.db.get_list(
		"KB Comment",
		filters={"article_slug": article_slug},
		fields=["name", "user", "body", "commented_on"],
		order_by="commented_on asc",
	)
	users = {r.user for r in rows}
	full_names = frappe.db.get_values("User", {"name": ["in", list(users)]}, ["name", "full_name"], as_dict=True) if users else []
	full_name_by_user = {u.name: u.full_name for u in full_names}

	return [
		{
			"id": r.name,
			"author_id": r.user,
			"author_name": full_name_by_user.get(r.user, r.user),
			"body": r.body,
			"created_at": r.commented_on,
		}
		for r in rows
	]


@frappe.whitelist()
def add_comment(article_slug, body):
	doc = frappe.get_doc({
		"doctype": "KB Comment",
		"article_slug": article_slug,
		"user": frappe.session.user,
		"body": body,
	}).insert()
	return {
		"id": doc.name,
		"author_id": doc.user,
		"author_name": frappe.db.get_value("User", doc.user, "full_name") or doc.user,
		"body": doc.body,
		"created_at": doc.commented_on,
	}


@frappe.whitelist()
def delete_comment(comment_name):
	doc = frappe.get_doc("KB Comment", comment_name)
	if doc.user != frappe.session.user and "System Manager" not in frappe.get_roles(frappe.session.user):
		frappe.throw("You may only delete your own comments.", frappe.PermissionError)
	doc.delete()
	return {"deleted": comment_name}


@frappe.whitelist()
def track_events(events):
	"""Bulk-inserts a batch of locally-queued analytics events (see
	edupro-theme's kb-analytics-store.ts) in one call. Each event's own
	`type`/fields map directly onto KB Analytics Event's event_type +
	optional fields; an individual malformed event is skipped rather than
	failing the whole batch, since this is best-effort telemetry, not
	financial data."""
	if isinstance(events, str):
		events = frappe.parse_json(events)

	inserted, skipped = 0, 0
	for event in events:
		event_type = {"article_view": "Article View", "search": "Search", "feedback": "Feedback"}.get(event.get("type"))
		if not event_type:
			skipped += 1
			continue
		try:
			frappe.get_doc({
				"doctype": "KB Analytics Event",
				"event_type": event_type,
				"article_slug": event.get("slug"),
				"search_query": event.get("query"),
				"result_count": event.get("resultCount"),
				"vote": (event.get("vote") or "").capitalize() or None,
			}).insert()
			inserted += 1
		except Exception:
			frappe.log_error(title="KB analytics event rejected")
			skipped += 1

	return {"inserted": inserted, "skipped": skipped}
