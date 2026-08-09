# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Store owner (Ariel Vega)** and **employee (Agustín)** operating a physical sports supplement store (Habitus SD, Av. Roca 54, Cinco Saltos, Río Negro). They use the system throughout the day for point-of-sale operations, inventory management, purchase orders, stock movements, financial tracking, and reporting.

**Online customers** browsing and purchasing through the web storefront at habitussd.com.

## Product Purpose

Sistema Habitus SD replaces expensive third-party SaaS tools (coverweb.com.ar at $204,900/month + Empretienda at $9,490/month) with a unified, self-hosted business management system. It enables complete business operations from a single platform: in-store sales with automatic AFIP/ARCA invoicing via TusFacturasAPP, inventory and purchase order management, multi-payment processing, financial ledger tracking, cash register reconciliation, and business intelligence reporting.

Success means: zero dependence on external subscription services, complete fiscal compliance automation, accurate real-time financial visibility, and operational efficiency for a two-person team managing both physical and online sales channels.

## Positioning

The only custom-built system in the Argentinian sports supplement retail market that combines point-of-sale operations, automatic AFIP fiscal compliance through TusFacturasAPP API, real-time inventory tracking, financial ledger with cash reconciliation, and integrated web storefront—all optimized for the specific workflow of a small sports nutrition business operating under ARCA regulations.

Neighboring generic POS or e-commerce platforms cannot match the fiscal integration depth, the business-specific workflow (supplement categorization by flavor/component, protein serving cost analysis, sponsor-athlete pricing), or the cost structure ($0/month after initial build vs. $214,390/month ongoing SaaS fees).

## Operating Context

- **Physical environment:** Counter-based POS workflow with barcode scanner, simultaneous customer service while processing sales
- **Fiscal environment:** Monotributista (CUIT 23238900719) operating under ARCA regulations, automatic electronic invoicing required for every sale
- **Team size:** Owner (Ariel) handles administration, reporting, configuration; employee (Agustín, Mon-Fri) handles daily sales and stock operations
- **Cash flow:** Multiple payment methods per transaction (cash, card, bank transfer), daily cash register reconciliation by shift (morning/afternoon), frequent supplier payments on 30-60 day terms
- **Inventory:** ~500+ SKUs with complex categorization (20+ categories, flavor variants, component tracking for pre-workout/protein products)
- **Online sales:** Web storefront with shopping cart, Mercado Pago payment integration, in-store pickup workflow
- **Tools in the workflow:** TusFacturasAPP for AFIP invoicing, Mercado Pago for online payments, barcode scanner for product lookup, WhatsApp/Instagram for customer communication

## Capabilities and Constraints

**Confirmed capabilities:**
- Point-of-sale with multi-item cart, multi-payment support, automatic AFIP invoicing
- Inventory management with stock movement tracking, purchase orders, cost/profit analysis
- Financial ledger (unified income/expense tracking), cash register with opening/closing reconciliation
- Business reporting: monthly sales, break-even analysis, gross/net profitability
- Web storefront with product catalog (grouped by flavor), shopping cart, Mercado Pago checkout
- Product categorization: categories/subcategories, brands scoped by category, flavor variants, nutritional components (caffeine, etc.)
- Manual fiscal retry for rejected invoices from dedicated Fiscalización screen
- Historical article tracking (stock movement audit trail per product)
- Supplier account payable tracking (Obligaciones module)

**Technical constraints:**
- Next.js 16 (App Router) + TypeScript frontend/backend
- Supabase (PostgreSQL) with Row Level Security (RLS) for data isolation
- Real-time fiscal integration via TusFacturasAPP API (no offline mode)
- Deployed on Vercel (Hobby plan, limited log retention)
- Timezone: America/Argentina/Buenos_Aires for all timestamps
- Barcode scanner input must auto-submit (no manual Enter)

**Undecided:** 
- Credit note (Nota de Crédito) workflow within the system (currently manual workaround)
- Permission granularity for employee role (Agustín currently has Admin access)
- Offline mode for continued operation during internet outages

## Brand Commitments

**Store name:** Habitus SD  
**Domain:** habitussd.com (independently registered, can be repointed when web storefront is ready for public launch)  
**Typography (not yet licensed):** Antique Olive Nord D + Futura MD BT (or Google Fonts alternatives to be selected)  
**Voice:** Direct, no-nonsense, sports-focused—matches the in-person customer service style

## Evidence on Hand

**Real customer base:** Physical walk-in customers + growing online demand (currently served via Empretienda)  
**Catalog data:** ~500+ products with photos, pricing, stock levels, barcode mapping (migrated from coverweb.com.ar)  
**Financial data:** Complete transaction history since July 1, 2026; historical movement data in MOVIMIENTOS_HISTORICO_UNIFICADO.xlsx (partial migration pending)  
**Fiscal compliance:** Live integration with TusFacturasAPP API since July 14, 2026, processing real invoices daily  
**Product imagery:** Photos for 5/20 categories migrated to flavor-grouped system; remaining 15 categories use original single-product photos  

**Absences (do not fabricate):**
- No customer testimonials or case studies
- No benchmark comparisons vs. competitors
- No marketing copy or brand story beyond operational facts
- No roadmap commitments beyond documented pending features in ESTADO-PROYECTO.md

## Product Principles

1. **Fiscal compliance is non-negotiable:** Every sale must have automatic AFIP invoicing; manual retry exists for failures, but the system must never allow uncompliant sales to slip through unnoticed.

2. **Cash truth over system truth:** Physical cash counts (opening/closing register) are the source of truth, not system calculations—the system alerts on discrepancies but trusts the human count.

3. **Workflow speed for two people:** Every interaction optimized for rapid completion (auto-focus search, keyboard shortcuts, minimal clicks)—a two-person team cannot afford UI friction during customer service.

4. **One source of truth per data type:** Products, prices, stock, invoices, financial movements all live in a single system—eliminating reconciliation between multiple tools was the entire point of this build.

5. **Progressive complexity:** Core workflows (sales, stock, reporting) work immediately; advanced features (supplier payables, flavor variants, component tracking) layer in without disrupting established patterns.

## Accessibility & Inclusion

Follow WCAG 2.1 AA guidelines for web accessibility: keyboard navigation, sufficient color contrast, screen reader compatibility, touch target sizing for mobile use. The system must be usable by store staff with varying levels of technical comfort.
