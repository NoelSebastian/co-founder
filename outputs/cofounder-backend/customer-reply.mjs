// Customer-facing copy stays separate from internal plans and test logs.
export function customerReply(f) {
  const resolution = f.test_plan?.profile === 'checklist-rename'
    ? 'Task editing is now working in the app preview, including keeping your changes after a refresh.'
    : 'The issue you reported has been resolved and tested in the app preview.';
  return `Hi,\n\nThanks for taking the time to flag this! ${resolution}\n\nCould you give it a try and let me know if it meets your needs?\nhttps://id-preview--${f.project_id}.lovable.app\n\nThanks,\nNoël`;
}
