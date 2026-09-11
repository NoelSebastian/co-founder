// Customer email is evidence, never authorization to change software.
export function emailAddress(value) {
	if (typeof value !== "string" || /[\r\n]/.test(value)) return "";
	const match = value.trim().match(/^(?:[^<>]*<)?([^<>\s]+@[^<>\s]+)>?$/);
	return match?.[1].toLowerCase() || "";
}
export function matchesFeedback(input, mailbox) {
	return (
		emailAddress(input.sender) === mailbox.toLowerCase() &&
		/^customer/i.test(input.subject || "") &&
		!/[\r\n]/.test(input.subject || "") &&
		!input.labels?.some((x) => ["DRAFT", "SPAM", "TRASH"].includes(x)) &&
		(input.labels?.includes("INBOX") ||
			(Array.isArray(input.to) &&
				input.to.some((x) => emailAddress(x) === mailbox.toLowerCase())))
	);
}
export function validateFeedback(input, mailbox, projectId) {
	for (const k of ["messageId", "threadId", "sender", "subject", "body"])
		if (typeof input[k] !== "string" || !input[k].trim())
			throw Error(`Missing email ${k}`);
	if (
		input.body.length > 30000 ||
		input.subject.length > 500 ||
		input.sender.length > 500
	)
		throw Error("Email exceeds the supported intake size");
	if (!matchesFeedback(input, mailbox))
		throw Error("Email does not match the customer demo rule");
	return { ...input, sender: emailAddress(input.sender), mailbox, projectId };
}
export function requireApprovedChange(record) {
	if (
		record.status !== "approved" ||
		!record.approved_by ||
		!record.approved_scope?.trim()
	)
		throw Error(
			"A human must approve the recommended change before Lovable starts.",
		);
	return record.approved_scope;
}
export function requirePassedTests(record) {
	const evidence = record.test_evidence;
	if (
		record.status !== "tested" ||
		evidence?.status !== "passed" ||
		!evidence?.projectId ||
		evidence.projectId !== record.project_id ||
		!evidence?.messageId ||
		evidence.messageId !== record.remote_message_id ||
		!Array.isArray(evidence.checks) ||
		!evidence.checks.length ||
		evidence.checks.some((c) => c.passed !== true)
	)
		throw Error(
			"A reply cannot be marked ready without passing tests for this exact change.",
		);
	return evidence;
}
