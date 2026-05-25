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
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return res.json({ notifications, count: notifications.length });
    }

    // ── Associate view: decisions on their own quotes ──────────
    const { rows: decisionRows } = await pool.query(`
      SELECT q.id, q.quote_number, q.discount_approval_status, q.discount_approval_note,
             q.discount_approval_at, q.max_discount_pct,
             q.modification_status, q.admin_note, q.modified_at
      FROM quotes q
      WHERE q.employee_id = $1
        AND (
          (q.discount_approval_status IN ('approved', 'rejected') AND q.discount_approval_at IS NOT NULL)
          OR
          (q.modification_status IN ('approved', 'rejected') AND q.modified_at IS NOT NULL)
        )
      ORDER BY GREATEST(
        COALESCE(q.discount_approval_at, '1970-01-01'),
        COALESCE(q.modified_at, '1970-01-01')
      ) DESC
      LIMIT 20
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
    }

    notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ notifications, count: notifications.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
