
# ERP Enhancement Plan - Phase 2

## Feature 5: Email Notifications
**Setup:**
- Configure email domain for sending from branded address
- Create email templates for key events:
  - Invoice due date reminders
  - Approval request alerts
  - PO/Requisition status changes
  - Budget threshold warnings

**Integration Points:**
- Trigger emails on approval workflow actions
- Trigger on invoice approaching due date
- Trigger on budget utilization exceeding threshold

---

## Feature 6: Enhanced Document Attachments
**Improvements:**
- Add drag-and-drop file upload to AttachmentPanel
- Image preview (thumbnails for JPG/PNG files)
- Support more file types with icons (Excel, Word, PDF, images)
- File type validation and better error messages
- Bulk download option

---

## Feature 7: Enhanced Data Exports
**Improvements:**
- Add XLSX (Excel) export format across all report pages
- Scheduled/saved report configurations
- Better PDF formatting with company branding (logo, header)
- Export audit trail (who exported what, when)

---

## Feature 8: Backup & Restore Management
**Database:**
- `data_backups` table — tracks backup snapshots: name, created_by, status, file_url, tables_included

**UI:**
- Admin panel under Settings for backup management
- "Create Backup" — exports selected tables as JSON to storage
- "Restore" — upload and apply a previously exported backup
- Backup history with download links
- Auto-backup scheduling option

---

## Implementation Order
1. Enhanced Attachments (UI-only improvements)
2. Enhanced Exports (add XLSX + branding)
3. Email Notifications (requires domain setup)
4. Backup & Restore (schema + edge function + UI)
