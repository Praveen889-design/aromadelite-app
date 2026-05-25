const express = require('express');
const pool = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/notifications
// Admin: returns all pending items that require admin action.
// Associate: returns approval decisions on their own quotes.
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';

    if (isAdmin) {
      // 1. Pending discount approvals
      const { rows: discountRows } = await pool.query(`
        SELECT q.id, q.quote_number, q.max_discount_pct, q.created_at,
               e.name AS employee_name, e.employee_id AS employee_code
        FROM quotes q JOIN employees e ON e.id = q.employee_id
        WHERE q.discount_approval_status = 'pending'
        ORDER BY q.created_at DESC
      `);

      // 2. Pending modification approvals
      const { rows: modRows } = await pool.query(`
        SELECT q.id, q.quote_number, q.modified_at, q.modification_note,
               e.name AS employee_name, e.employee_id AS employee_code
        FROM quotes q JOIN employees e ON e.id = q.employee_id
        WHERE q.modification_status = 'pending_approval'
        ORDER BY q.modified_at DESC NULLS LAST
      `);

      // 3. Client approval responses (clients who approved or requested changes)
      const { rows: clientRows } = await pool.query(`
        SELECT q.id, q.quote_number, q.client_approval_status, q.client_approval_at,
               q.client_approval_note, q.client_approved_by_name,
               q.client_name, q.client_business_name,
               e.name AS employee_name, e.employee_id AS employee_code
        FROM quotes q JOIN employees e ON e.id = q.employee_id
        WHERE q.client_approval_status IS NOT NULL
          AND q.client_approval_at >= NOW() - INTERVAL '7 days'
        ORDER BY q.client_approval_at DESC
      `);

      const notifications = [
        ...discountRows.map((r) => ({
          id:             `discount_${r.id}`,
          type:           'discount_approval',
          quote_id:       r.id,
          quote_number:   r.quote_number,
          employee_name:  r.employee_name,
          employee_code:  r.employee_code,
          max_discount_pct: Number(r.max_discount_pct || 0),
          created_at:     r.created_at,
          title:          'Discount Approval Required',
          message:        `${r.employee_name} quoted a ${Number(r.max_discount_pct || 0).toFixed(0)}% discount on ${r.quote_number}`,
          link:           '/admin?tab=discounts',
          icon:           '🏷️',
        })),
        ...modRows.map((r) => ({
          id:            `mod_${r.id}`,
          type:          'modification_review',
          quote_id:      r.id,
          quote_number:  r.quote_number,
          employee_name: r.employee_name,
          employee_code: r.employee_code,
          created_at:    r.modified_at || new Date().toISOString(),
          title:         'Modification Review Required',
          message:       `${r.employee_name} submitted updated pricing for ${r.quote_number}`,
          link:          `/quotes/${r.id}`,
          icon:          '✏️',
        })),
        ...clientRows.map((r) => {
          const clientDisplay = r.client_business_name || r.client_name;
          const isApproved = r.client_approval_status === 'approved';
          return {
            id:           `client_resp_${r.id}`,
            type:         isApproved ? 'client_approved' : 'client_changes_requested',
            quote_id:     r.id,
            quote_number: r.quote_number,
            employee_name: r.employee_name,
            employee_code: r.employee_code,
            created_at:   r.client_approval_at,
            title:        isApproved ? `Client Approved ✅` : `Client Requested Changes ✏️`,
            message:      isApproved
              ? `${clientDisplay} approved ${r.quote_number}${r.client_approved_by_name ? ` (${r.client_approved_by_name})` : ''}`
              : `${clientDisplay} requested changes on ${r.quote_number}${r.client_approval_note ? `: "${r.client_approval_note}"` : ''}`,
            link:         `/quotes/${r.id}`,
            icon:         isApproved ? '✅' : '✏️',
          };
        }),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return res.json({ notifications, count: notifications.length });
    }

    // ── Associate view: decisions on their own quotes ──────────
    const { rows: decisionRows } = await pool.query(`
      SELECT q.id, q.quote_number, q.discount_approval_status, q.discount_approval_note,
             q.discount_approval_at, q.max_discount_pct,
             q.modification_status, q.admin_note, q.modified_at,
             q.client_approval_status, q.client_approval_at,
             q.client_approval_note, q.client_name, q.client_business_name,
             q.client_approved_by_name
      FROM quotes q
      WHERE q.employee_id = $1
        AND (
          (q.discount_approval_status IN ('approved', 'rejected') AND q.discount_approval_at IS NOT NULL)
          OR
          (q.modification_status IN ('approved', 'rejected') AND q.modified_at IS NOT NULL)
          OR
          (q.client_approval_status IS NOT NULL AND q.client_approval_at >= NOW() - INTERVAL '14 days')
        )
      ORDER BY GREATEST(
        COALESCE(q.discount_approval_at, '1970-01-01'),
        COALESCE(q.modified_at, '1970-01-01'),
        COALESCE(q.client_approval_at, '1970-01-01')
      ) DESC
      LIMIT 30
    `, [req.user.id]);

    const notifications = [];
    for (const r of decisionRows) {
      if (r.discount_approval_status === 'approved' && r.discount_approval_at) {
        notifications.push({
          id:           `disc_approved_${r.id}`,
          type:         'discount_approved',
          quote_id:     r.id,
          quote_number: r.quote_number,
          created_at:   r.discount_approval_at,
          title:        'Discount Approved ✅',
          message:      `Your ${Number(r.max_discount_pct || 0).toFixed(0)}% discount on ${r.quote_number} was approved. You can now send the quote.`,
          link:         `/quotes/${r.id}`,
          icon:         '✅',
        });
      }
      if (r.discount_approval_status === 'rejected' && r.discount_approval_at) {
        notifications.push({
          id:           `disc_rejected_${r.id}`,
          type:         'discount_rejected',
          quote_id:     r.id,
          quote_number: r.quote_number,
          created_at:   r.discount_approval_at,
          title:        'Discount Rejected ❌',
          message:      r.discount_approval_note
            ? `${r.quote_number}: "${r.discount_approval_note}"`
            : `Your discount on ${r.quote_number} was rejected. Please revise pricing.`,
          link:         `/quotes/${r.id}`,
          icon:         '❌',
        });
      }
      if (r.modification_status === 'approved' && r.modified_at) {
        notifications.push({
          id:           `mod_approved_${r.id}`,
          type:         'modification_approved',
          quote_id:     r.id,
          quote_number: r.quote_number,
          created_at:   r.modified_at,
          title:        'Modification Approved ✅',
          message:      `Admin approved your updated pricing for ${r.quote_number}. Generate the bill now.`,
          link:         `/quotes/${r.id}`,
          icon:         '✅',
        });
      }
      if (r.modification_status === 'rejected' && r.modified_at) {
        notifications.push({
          id:           `mod_rejected_${r.id}`,
          type:         'modification_rejected',
          quote_id:     r.id,
          quote_number: r.quote_number,
          created_at:   r.modified_at,
          title:        'Modification Rejected ❌',
          message:      r.admin_note
            ? `${r.quote_number}: "${r.admin_note}"`
            : `Your modification for ${r.quote_number} was rejected. Re-edit and resubmit.`,
          link:         `/quotes/${r.id}`,
          icon:         '❌',
        });
      }
      if (r.client_approval_status && r.client_approval_at) {
        const clientDisplay = r.client_business_name || r.client_name;
        const isApproved = r.client_approval_status === 'approved';
        notifications.push({
          id:           `client_resp_${r.id}`,
          type:         isApproved ? 'client_approved' : 'client_changes_requested',
          quote_id:     r.id,
          quote_number: r.quote_number,
          created_at:   r.client_approval_at,
          title:        isApproved ? 'Client Approved ✅' : 'Client Requested Changes ✏️',
          message:      isApproved
            ? `${clientDisplay} approved ${r.quote_number}${r.client_approved_by_name ? ` (${r.client_approved_by_name})` : ''}`
            : `${clientDisplay} requested changes on ${r.quote_number}${r.client_approval_note ? `: "${r.client_approval_note}"` : ''}`,
          link:         `/quotes/${r.id}`,
          icon:         isApproved ? '✅' : '✏️',
        });
      }
    }

    notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ notifications, count: notifications.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
