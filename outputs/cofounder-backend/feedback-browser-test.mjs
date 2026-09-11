// Independent, behavior-based acceptance test for the first customer-feedback demo.
// Runs in a fresh browser context; never uses the founder's cookies or task data.
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(
	new URL("../buzz/desktop/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
export const renameContract = `For independent acceptance testing, give the existing task composer data-testid="task-name-input" and its add button data-testid="task-add". Each task row must have data-testid="task-row" containing its visible name, a checkbox, and an Edit button. Editing exposes data-testid="task-edit-input", a Save button and a Cancel button in the same row. These attributes are testing hooks, not visible product labels. Preserve add, complete, delete and persistence behavior.`;
export async function testChecklistRename(f, onProgress = async () => {}) {
	if (!/^[a-f0-9-]{36}$/.test(f.project_id)) throw Error("Invalid test target");
	const evidence = {
		status: "failed",
		projectId: f.project_id,
		messageId: f.remote_message_id,
		checkedAt: new Date().toISOString(),
		runner: "independent-playwright-checklist-v1",
		checks: [],
	};
	let browser;
	let page;
	try {
		browser = await chromium.launch({ headless: true, channel: "chrome" });
		const context = await browser.newContext();
		page = await context.newPage();
		page.setDefaultTimeout(15000);
		await page.goto(`https://id-preview--${f.project_id}.lovable.app`, {
			waitUntil: "domcontentloaded",
			timeout: 45000,
		});
		const name = "QA task " + randomUUID().slice(0, 8),
			renamed = name + " renamed";
		await page.getByTestId("task-name-input").fill(name);
		await page.getByTestId("task-add").click();
		let row = page.getByTestId("task-row").filter({ hasText: name });
		await expect(row).toHaveCount(1);
		const initialRows = await page.getByTestId("task-row").count();
		await row.getByRole("checkbox").check();
		await expect(row.getByRole("checkbox")).toBeChecked();
		evidence.checks.push({
			name: "A new task can be added and completed",
			passed: true,
		});
		await onProgress(evidence);
		await row.getByRole("button", { name: /^Edit(?: |$)/ }).click();
		await row.getByTestId("task-edit-input").fill(renamed);
		await row.getByRole("button", { name: "Save", exact: true }).click();
		row = page.getByTestId("task-row").filter({ hasText: renamed });
		await expect(row).toHaveCount(1);
		await expect(row.getByRole("checkbox")).toBeChecked();
		await expect(page.getByTestId("task-row")).toHaveCount(initialRows);
		evidence.checks.push({
			name: "Renaming changes the name without duplicating the task or losing completion",
			passed: true,
		});
		await onProgress(evidence);
		await page.reload();
		row = page.getByTestId("task-row").filter({ hasText: renamed });
		await expect(row).toHaveCount(1);
		await expect(row.getByRole("checkbox")).toBeChecked();
		evidence.checks.push({
			name: "The renamed task and completed status survive refresh",
			passed: true,
		});
		await onProgress(evidence);
		await row.getByRole("button", { name: /^Edit(?: |$)/ }).click();
		await row.getByTestId("task-edit-input").fill("Cancelled edit");
		await row.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(row).toContainText(renamed);
		evidence.checks.push({
			name: "Cancel keeps the original task name",
			passed: true,
		});
		await onProgress(evidence);
		await row.getByRole("button", { name: /^Edit(?: |$)/ }).click();
		await row.getByTestId("task-edit-input").fill("   ");
		const save = row.getByRole("button", { name: "Save", exact: true });
		if (await save.isEnabled()) await save.click();
		await expect(row.getByTestId("task-edit-input")).toBeVisible();
		await row.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(row).toContainText(renamed);
		evidence.checks.push({
			name: "An empty or whitespace-only name cannot replace the task name",
			passed: true,
		});
		await onProgress(evidence);
		evidence.status = "passed";
	} catch (e) {
		if (
			page &&
			(await page
				.getByRole("heading", { name: /Sign in to continue|Sign in/ })
				.isVisible()
				.catch(() => false))
		) {
			evidence.blockedReason = "preview_sign_in";
			e.message =
				"The private Lovable preview requires sign-in. No feature checks ran in this isolated browser.";
		}
		evidence.checks.push({
			name: "Complete the checklist editing acceptance scenario",
			passed: false,
			detail: String(e.message).slice(0, 1200),
		});
		await onProgress(evidence);
	} finally {
		await browser?.close();
	}
	return evidence;
}
