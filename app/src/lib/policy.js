// Where "just do it" stops and "someone else signs it off" starts.
//
// Small counts get corrected on the spot — that's the whole point of having
// the Adjust button on the shop floor. But a large write-off is the one
// action in here that can quietly make stock disappear, so past a threshold
// it becomes a request instead of a change, and the Ops Manager approves or
// rejects it. The requester can't be the approver, which is the only thing
// that makes the sign-off worth anything.
export const CORRECTION_APPROVAL_THRESHOLD = 10

// The Ops Manager is the approver, so their own adjustments apply directly —
// there'd be nobody above them to ask, and a queue only they can clear that
// only they can fill is just a slower button.
export function needsApproval(delta, role) {
  return Math.abs(delta) >= CORRECTION_APPROVAL_THRESHOLD && role !== 'ops_manager'
}

// null means "this person never needs approval" — the modals use it to
// decide whether to warn about a threshold at all.
export function approvalThresholdFor(role) {
  return role === 'ops_manager' ? null : CORRECTION_APPROVAL_THRESHOLD
}
