-- Row-Level Security: every tenant request runs as sufra_app with app.org_id set per transaction.
-- A missing/empty app.org_id resolves to NULL and matches no rows (fail closed).
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.org_id', true), '')::uuid $$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON organizations USING (id = app_current_org()) WITH CHECK (id = app_current_org());

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON branches USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON devices USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE user_branch_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_branch_roles USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sessions USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON floors USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tables USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stations USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON menu_categories USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON menu_items USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON modifier_groups USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifiers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON modifiers USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE menu_item_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_modifier_groups FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON menu_item_modifier_groups USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ingredients USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE stock_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_lots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_lots USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_movements USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE recipe_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON recipe_lines USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON suppliers USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_orders USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON purchase_order_lines USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_items USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE kitchen_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_tickets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON kitchen_tickets USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payments USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invoices USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON feedback USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON expenses USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON activity_events USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON compliance_documents USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_logs USING (organization_id = app_current_org()) WITH CHECK (organization_id = app_current_org());

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sufra_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sufra_app;
DO $$ BEGIN IF to_regclass('public._prisma_migrations') IS NOT NULL THEN REVOKE ALL ON _prisma_migrations FROM sufra_app; END IF; END $$;
-- Audit log is append-only for the application.
REVOKE UPDATE, DELETE ON audit_logs FROM sufra_app;
-- Sessions are managed by the owner-role auth service only.
REVOKE ALL ON sessions FROM sufra_app;
