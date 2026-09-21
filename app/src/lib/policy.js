// Where "just do it" stops and "someone else signs it off" starts.
//
// A correction only actually moves stock once BOTH named approvers have
// signed off — the Operations Manager and the Owner (or other management
// approver) are two different people by design, so one compromised or
// careless approval can't move stock on its own.
export const APPROVER_ROLES = ['ops_manager', 'owner']

// Every stock adjustment — any size, from anyone able to propose one — is a
// request, never a direct change: no one auto-bypasses, and there is no
// unit threshold under which a change is "small enough" to skip sign-off.
// That's deliberate — the whole point of the twofold check is to catch the
// ones that look small too. Adjusting is an administrative function: shop-
// floor staff (sales associates) can't propose one at all, they manage
// stock (counts, receiving via orders) but don't touch the on-hand number
// directly. Neither can the two approver roles themselves — a request
// needs sign-off from someone other than whoever raised it, and with only
// one Operations Manager and one Owner in the business, either of them
// proposing their own adjustment would leave it needing an approval nobody
// else can ever give.
export function canProposeAdjustment(role) {
  return role !== 'sales_associate' && !APPROVER_ROLES.includes(role)
}

export function canApproveCorrection(role) {
  return APPROVER_ROLES.includes(role)
}

// A request is fully signed off once every approver role has a distinct,
// non-requester approval recorded against it.
export function isFullyApproved(correction) {
  const approvals = correction.approvals ?? {}
  return APPROVER_ROLES.every((role) => !!approvals[role])
}

// Markdown pricing is a management call, not a shop-floor one — the same
// two roles who sign off stock corrections are the ones who set a discount.
export function canManageDiscount(role) {
  return APPROVER_ROLES.includes(role)
}
