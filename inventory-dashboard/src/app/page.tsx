"use client";

import type { ComponentType } from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArchiveRestore,
  ArrowUpRight,
  Barcode,
  Bell,
  CheckCircle2,
  Download,
  Filter,
  Package,
  PlusCircle,
  Settings2,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";
import { BarcodeScanner } from "@/components/barcode-scanner";

let idCounter = 0;

function generateId(prefix = "id") {
  idCounter += 1;
  const timestamp = Date.now().toString(36);
  const counter = idCounter.toString(36);
  return `${prefix}-${timestamp}-${counter}`;
}

function generateInvoiceNumber() {
  const datePart = format(new Date(), "yyyyMMdd");
  const unique =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 6).toUpperCase()
      : generateId("inv").split("-").pop()?.toUpperCase() ?? "SEQ";
  return `INV-${datePart}-${unique}`;
}

type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  stock: number;
  reorderPoint: number;
  price: number;
  unit: string;
  supplier: string;
  incoming: number;
  lastRestock: string;
  description: string;
};

type ActivityLog = {
  id: string;
  message: string;
  timestamp: string;
  type: "inventory" | "invoice" | "alert" | "system";
};

type InvoiceLine = {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  price: number;
  discount: number;
};

type InvoiceRecord = {
  id: string;
  number: string;
  customer: string;
  total: number;
  createdAt: string;
  couponCode?: string;
};

type Coupon = {
  code: string;
  type: "percentage" | "flat";
  value: number;
  description: string;
};

const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: "item-1",
    name: "Premium Tulsi Honey",
    sku: "HN-TL-001",
    barcode: "8901234000017",
    category: "Groceries",
    stock: 42,
    reorderPoint: 20,
    price: 349,
    unit: "bottle",
    supplier: "Raw Bliss Naturals",
    incoming: 50,
    lastRestock: "2024-03-12",
    description: "Organic honey infused with tulsi for immunity support.",
  },
  {
    id: "item-2",
    name: "Artisan Ceramic Cup Set",
    sku: "CR-CP-114",
    barcode: "8901234000024",
    category: "Home & Living",
    stock: 12,
    reorderPoint: 10,
    price: 1299,
    unit: "set",
    supplier: "Studio Clayworks",
    incoming: 24,
    lastRestock: "2024-04-02",
    description:
      "Hand-crafted ceramic cups with matte glaze finish, set of four.",
  },
  {
    id: "item-3",
    name: "Cold Brew Coffee Mix",
    sku: "CF-CB-078",
    barcode: "8901234000031",
    category: "Beverages",
    stock: 8,
    reorderPoint: 15,
    price: 499,
    unit: "pack",
    supplier: "Karma Beans Collective",
    incoming: 60,
    lastRestock: "2024-02-24",
    description: "Instant cold brew mix with chicory and single-origin beans.",
  },
  {
    id: "item-4",
    name: "Eco Smart Notebook",
    sku: "ST-NB-210",
    barcode: "8901234000048",
    category: "Stationery",
    stock: 76,
    reorderPoint: 25,
    price: 249,
    unit: "piece",
    supplier: "Papyrus & Ink",
    incoming: 120,
    lastRestock: "2024-03-29",
    description:
      "Reusable synthetic paper notebook compatible with erasable pens.",
  },
  {
    id: "item-5",
    name: "Aura Soy Candle",
    sku: "HM-CD-054",
    barcode: "8901234000055",
    category: "Home & Living",
    stock: 4,
    reorderPoint: 8,
    price: 599,
    unit: "piece",
    supplier: "Calm Co.",
    incoming: 30,
    lastRestock: "2024-03-05",
    description: "Hand-poured soy candle with lavender and sandalwood notes.",
  },
];

const COUPONS: Coupon[] = [
  {
    code: "WELCOME10",
    type: "percentage",
    value: 10,
    description: "10% off for new customers",
  },
  {
    code: "FREESHIP",
    type: "flat",
    value: 150,
    description: "Flat ₹150 off shipping charges",
  },
  {
    code: "BULK500",
    type: "flat",
    value: 500,
    description: "₹500 off on orders above ₹10,000",
  },
];

const TAX_RATE = 0.18;

const EMPTY_FORM: Omit<InventoryItem, "id"> = {
  name: "",
  sku: "",
  barcode: "",
  category: "",
  stock: 0,
  reorderPoint: 0,
  price: 0,
  unit: "",
  supplier: "",
  incoming: 0,
  lastRestock: format(new Date(), "yyyy-MM-dd"),
  description: "",
};

const DEFAULT_CONFIG = {
  showInventoryValue: true,
  showIncomingStock: true,
  showSalesVelocity: true,
  showTopPerformers: true,
};

export default function Page() {
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [activity, setActivity] = useState<ActivityLog[]>(() => [
    {
      id: generateId("log"),
      message: "Dashboard initialized with sync-ready inventory.",
      timestamp: new Date().toISOString(),
      type: "system",
    },
  ]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [formState, setFormState] = useState<Omit<InventoryItem, "id">>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const [dashboardConfig, setDashboardConfig] = useState(DEFAULT_CONFIG);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>(() => [
    {
      id: generateId("line"),
      productId: null,
      name: "",
      quantity: 1,
      price: 0,
      discount: 0,
    },
  ]);
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);

  const recordActivity = useCallback((message: string, type: ActivityLog["type"]) => {
    setActivity((prev) => [
      {
        id: generateId("log"),
        message,
        timestamp: new Date().toISOString(),
        type,
      },
      ...prev.slice(0, 39),
    ]);
  }, []);

  const categories = useMemo(() => {
    const unique = new Set(inventory.map((item) => item.category || "Uncategorized"));
    return Array.from(unique);
  }, [inventory]);

  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.stock <= item.reorderPoint),
    [inventory]
  );

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase()) ||
        item.barcode.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      const matchesStock = !lowStockOnly || item.stock <= item.reorderPoint;
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [inventory, search, categoryFilter, lowStockOnly]);

  const analytics = useMemo(() => {
    const totalProducts = inventory.length;
    const totalUnits = inventory.reduce((sum, item) => sum + item.stock, 0);
    const inventoryValue = inventory.reduce(
      (sum, item) => sum + item.stock * item.price,
      0
    );
    const incoming = inventory.reduce((sum, item) => sum + item.incoming, 0);
    const lowStockCount = lowStockItems.length;
    const fastMoving = inventory
      .filter((item) => item.stock < 15 && item.reorderPoint <= 20)
      .map((item) => item.name);

    return {
      totalProducts,
      totalUnits,
      inventoryValue,
      incoming,
      lowStockCount,
      fastMoving,
    };
  }, [inventory, lowStockItems]);

  const subtotal = useMemo(() => {
    return invoiceLines.reduce((sum, line) => {
      const lineTotal = line.quantity * line.price - line.discount;
      return sum + (lineTotal > 0 ? lineTotal : 0);
    }, 0);
  }, [invoiceLines]);

  const couponDeduction = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.type === "percentage") {
      return (subtotal * appliedCoupon.value) / 100;
    }
    return appliedCoupon.value;
  }, [appliedCoupon, subtotal]);

  const taxAmount = useMemo(() => Math.max((subtotal - couponDeduction) * TAX_RATE, 0), [subtotal, couponDeduction]);

  const grandTotal = useMemo(
    () => Math.max(subtotal - couponDeduction + taxAmount, 0),
    [subtotal, couponDeduction, taxAmount]
  );

  function resetForm() {
    setFormState(EMPTY_FORM);
    setEditingId(null);
    setScannerMessage(null);
  }

  function handleSaveInventory() {
    if (!formState.name || !formState.sku || !formState.barcode) {
      setScannerMessage("Name, SKU, and barcode are required.");
      return;
    }

    if (editingId) {
      setInventory((prev) =>
        prev.map((item) =>
          item.id === editingId ? { id: editingId, ...formState } : item
        )
      );
      recordActivity(
        `Updated ${formState.name} (${formState.sku}) with current stock ${formState.stock}.`,
        "inventory"
      );
    } else {
      const newItem: InventoryItem = {
        id: generateId("item"),
        ...formState,
      };
      setInventory((prev) => [newItem, ...prev]);
      recordActivity(
        `Added new item ${newItem.name} (${newItem.sku}) to inventory.`,
        "inventory"
      );
    }

    resetForm();
  }

  function handleEditItem(item: InventoryItem) {
    const { id: _ignoredId, ...rest } = item;
    void _ignoredId;
    setFormState(rest);
    setEditingId(item.id);
    setScannerMessage(`Loaded ${item.name} for editing.`);
  }

  function handleBarcodeCapture(barcode: string) {
    const existing = inventory.find((item) => item.barcode === barcode);
    if (existing) {
      handleEditItem(existing);
    } else {
      setFormState((prev) => ({
        ...prev,
        barcode,
      }));
      setEditingId(null);
      setScannerMessage("Barcode captured. Fill remaining details to add item.");
    }
  }

  function handleAddInvoiceLine() {
    setInvoiceLines((prev) => [
      ...prev,
      {
        id: generateId("line"),
        productId: null,
        name: "",
        quantity: 1,
        price: 0,
        discount: 0,
      },
    ]);
  }

  function handleInvoiceLineChange(id: string, partial: Partial<InvoiceLine>) {
    setInvoiceLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...partial } : line))
    );
  }

  function handleSelectProduct(lineId: string, productId: string) {
    const product = inventory.find((item) => item.id === productId);
    if (!product) return;
    handleInvoiceLineChange(lineId, {
      productId,
      name: product.name,
      price: product.price,
      discount: 0,
    });
  }

  function handleApplyCoupon() {
    const coupon = COUPONS.find(
      (entry) => entry.code.toLowerCase() === couponInput.toLowerCase().trim()
    );
    if (!coupon) {
      setScannerMessage("Coupon code not found.");
      return;
    }
    setAppliedCoupon(coupon);
    setScannerMessage(`Coupon ${coupon.code} applied successfully.`);
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
  }

  function handleGenerateInvoice() {
    if (!customerName) {
      setScannerMessage("Customer name is required for invoice.");
      return;
    }

    const validLines = invoiceLines.filter((line) => line.quantity > 0 && (line.name || line.productId));
    if (validLines.length === 0) {
      setScannerMessage("Add at least one product line to generate invoice.");
      return;
    }

    const invoiceNumber = generateInvoiceNumber();

    const invoiceTotal = grandTotal;

    setInvoices((prev) => [
      {
        id: generateId("invoice"),
        number: invoiceNumber,
        customer: customerName,
        total: invoiceTotal,
        createdAt: new Date().toISOString(),
        couponCode: appliedCoupon?.code,
      },
      ...prev.slice(0, 19),
    ]);

    recordActivity(
      `Invoice ${invoiceNumber} generated for ${customerName} (₹${invoiceTotal.toFixed(2)}).`,
      "invoice"
    );

    openInvoiceWindow({
      invoiceNumber,
      customerName,
      customerContact,
      invoiceNotes,
      lines: validLines,
      subtotal,
      coupon: appliedCoupon,
      couponDeduction,
      taxAmount,
      grandTotal,
    });

    setInvoiceLines([
      {
        id: generateId("line"),
        productId: null,
        name: "",
        quantity: 1,
        price: 0,
        discount: 0,
      },
    ]);
    setCustomerName("");
    setCustomerContact("");
    setInvoiceNotes("");
    setAppliedCoupon(null);
    setCouponInput("");
  }

  function openInvoiceWindow({
    invoiceNumber,
    customerName,
    customerContact,
    invoiceNotes,
    lines,
    subtotal,
    coupon,
    couponDeduction,
    taxAmount,
    grandTotal,
  }: {
    invoiceNumber: string;
    customerName: string;
    customerContact: string;
    invoiceNotes: string;
    lines: InvoiceLine[];
    subtotal: number;
    coupon: Coupon | null;
    couponDeduction: number;
    taxAmount: number;
    grandTotal: number;
  }) {
    if (typeof window === "undefined") return;
    const doc = window.open("", "_blank", "width=720,height=900");
    if (!doc) return;
    doc.document.write(`<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${invoiceNumber}</title>
          <style>
            body { font-family: "Segoe UI", Arial, sans-serif; padding: 32px; color: #111; }
            h1 { margin-bottom: 4px; font-size: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { border: 1px solid #e2e2e2; padding: 8px 12px; text-align: left; }
            th { background: #111; color: #fff; }
            tfoot td { font-weight: 600; }
            .meta { display: flex; justify-content: space-between; margin-top: 12px; }
            .meta div { line-height: 1.5; }
            .notes { margin-top: 24px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Invoice ${invoiceNumber}</h1>
          <div class="meta">
            <div>
              <strong>Issued:</strong> ${format(new Date(), "PPpp")}<br />
              <strong>Customer:</strong> ${customerName || "-"}<br />
              <strong>Contact:</strong> ${customerContact || "-"}
            </div>
            <div>
              <strong>Store:</strong> Velocity Retail Hub<br />
              <strong>GSTIN:</strong> 29ABCDE1234F2Z5<br />
              <strong>Support:</strong> hello@velocity.in
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th><th>Qty</th><th>Price</th><th>Discount</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${lines
                .map((line) => {
                  const total = line.quantity * line.price - line.discount;
                  return `<tr>
                    <td>${line.name || "-"}</td>
                    <td>${line.quantity}</td>
                    <td>₹${line.price.toFixed(2)}</td>
                    <td>₹${line.discount.toFixed(2)}</td>
                    <td>₹${total.toFixed(2)}</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4">Subtotal</td>
                <td>₹${subtotal.toFixed(2)}</td>
              </tr>
              ${
                coupon
                  ? `<tr><td colspan="4">Coupon (${coupon.code})</td><td>-₹${couponDeduction.toFixed(2)}</td></tr>`
                  : ""
              }
              <tr>
                <td colspan="4">GST (${(TAX_RATE * 100).toFixed(0)}%)</td>
                <td>₹${taxAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td colspan="4">Grand Total</td>
                <td>₹${grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          ${
            invoiceNotes
              ? `<div class="notes"><strong>Notes:</strong><p>${invoiceNotes}</p></div>`
              : ""
          }
          <script>window.print();</script>
        </body>
      </html>`);
    doc.document.close();
  }

  const alerts = useMemo(
    () =>
      lowStockItems.map((item) => {
        const severity: "critical" | "warning" =
          item.stock === 0 ? "critical" : "warning";
        return {
          id: item.id,
          title: `${item.name} is running low`,
          detail: `${item.stock} units left. Reorder point: ${item.reorderPoint}`,
          severity,
        };
      }),
    [lowStockItems]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-emerald-300/80">
              Velocity Retail Hub
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Central Command Console</h1>
            <p className="mt-1 text-sm text-white/60">
              Manage inventory, smart alerts, invoices, and real-time analytics in one place.
            </p>
          </div>
          <div className="hidden items-center gap-4 md:flex">
            <div className="rounded-full bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200">
              {format(new Date(), "EEEE, dd MMM yyyy")}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              <Bell size={16} />
              Alert Center
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <DashboardGrid
              analytics={analytics}
              config={dashboardConfig}
              onConfigChange={setDashboardConfig}
            />

            <InventorySection
              inventory={filteredInventory}
              allInventory={inventory}
              categories={categories}
              search={search}
              setSearch={setSearch}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              lowStockOnly={lowStockOnly}
              setLowStockOnly={setLowStockOnly}
              onEdit={handleEditItem}
            />

            <InvoiceSection
              inventory={inventory}
              invoiceLines={invoiceLines}
              onLineChange={handleInvoiceLineChange}
              onSelectProduct={handleSelectProduct}
              onAddLine={handleAddInvoiceLine}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerContact={customerContact}
              setCustomerContact={setCustomerContact}
              notes={invoiceNotes}
              setNotes={setInvoiceNotes}
              subtotal={subtotal}
              taxAmount={taxAmount}
              couponDeduction={couponDeduction}
              grandTotal={grandTotal}
              couponInput={couponInput}
              setCouponInput={setCouponInput}
              appliedCoupon={appliedCoupon}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
              onGenerateInvoice={handleGenerateInvoice}
            />
          </div>

          <aside className="space-y-6">
            <AlertsPanel alerts={alerts} />

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/70">Barcode Scanner</p>
                  <p className="text-xs text-white/50">
                    Auto-fill product details using 1D line barcodes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setScannerActive((prev) => !prev);
                    setScannerMessage(null);
                  }}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                    scannerActive
                      ? "bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                      : "bg-white/10 hover:bg-white/20"
                  )}
                >
                  <Barcode size={16} />
                  {scannerActive ? "Stop" : "Start"}
                </button>
              </div>
              <div className="mt-4">
                <BarcodeScanner
                  active={scannerActive}
                  onScan={(code) => {
                    handleBarcodeCapture(code);
                    setScannerMessage(`Captured barcode ${code}.`);
                  }}
                  onError={(msg) => setScannerMessage(msg)}
                />
              </div>
              {scannerMessage && (
                <p className="mt-3 text-sm text-emerald-200">{scannerMessage}</p>
              )}
            </div>

            <InventoryForm
              formState={formState}
              setFormState={setFormState}
              onSave={handleSaveInventory}
              onReset={resetForm}
              editingId={editingId}
            />

            <RecentActivity activity={activity} />

            <InvoiceHistory invoices={invoices} />
          </aside>
        </section>
      </main>
    </div>
  );
}

type DashboardGridProps = {
  analytics: {
    totalProducts: number;
    totalUnits: number;
    inventoryValue: number;
    incoming: number;
    lowStockCount: number;
    fastMoving: string[];
  };
  config: typeof DEFAULT_CONFIG;
  onConfigChange: (config: typeof DEFAULT_CONFIG) => void;
};

function DashboardGrid({ analytics, config, onConfigChange }: DashboardGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total SKUs"
        description="Active products in catalog"
        value={analytics.totalProducts.toString()}
        icon={Package}
        accent="from-emerald-500/30 to-teal-500/20"
      />
      <StatCard
        title="Stock On Hand"
        description="Total units available"
        value={`${analytics.totalUnits} pcs`}
        icon={ArchiveRestore}
        accent="from-sky-500/30 to-blue-500/20"
      />
      {config.showInventoryValue && (
        <StatCard
          title="Inventory Value"
          description="Current stock valuation"
          value={`₹${analytics.inventoryValue.toLocaleString("en-IN")}`}
          icon={Sparkles}
          accent="from-amber-500/30 to-orange-500/20"
        />
      )}
      {config.showIncomingStock && (
        <StatCard
          title="Incoming Stock"
          description="Units scheduled to arrive"
          value={`${analytics.incoming} pcs`}
          icon={Truck}
          accent="from-purple-500/30 to-fuchsia-500/20"
        />
      )}
      {config.showSalesVelocity && (
        <StatCard
          title="Low Stock Alerts"
          description="Below reorder threshold"
          value={`${analytics.lowStockCount} items`}
          icon={AlertTriangle}
          accent="from-rose-500/30 to-red-500/20"
        />
      )}
      {config.showTopPerformers && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
          <div className="flex items-center justify-between text-sm font-medium text-white/70">
            <span>Fast Movers</span>
            <ArrowUpRight size={16} />
          </div>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            {analytics.fastMoving.length ? (
              analytics.fastMoving.map((item) => (
                <li
                  key={item}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                >
                  <span>{item}</span>
                  <span className="text-xs text-emerald-300/80">Velocity</span>
                </li>
              ))
            ) : (
              <li className="rounded-xl bg-black/20 px-3 py-2 text-center text-xs text-white/40">
                No fast movers flagged.
              </li>
            )}
          </ul>
        </div>
      )}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur md:col-span-2 xl:col-span-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/70">Dashboard Preferences</p>
            <p className="text-xs text-white/40">Toggle cards to personalize view.</p>
          </div>
          <Settings2 size={18} className="text-white/50" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <TogglePill
            label="Inventory Value"
            active={config.showInventoryValue}
            onClick={() =>
              onConfigChange({
                ...config,
                showInventoryValue: !config.showInventoryValue,
              })
            }
          />
          <TogglePill
            label="Incoming Stock"
            active={config.showIncomingStock}
            onClick={() =>
              onConfigChange({
                ...config,
                showIncomingStock: !config.showIncomingStock,
              })
            }
          />
          <TogglePill
            label="Low Stock Summary"
            active={config.showSalesVelocity}
            onClick={() =>
              onConfigChange({
                ...config,
                showSalesVelocity: !config.showSalesVelocity,
              })
            }
          />
          <TogglePill
            label="Fast Movers"
            active={config.showTopPerformers}
            onClick={() =>
              onConfigChange({
                ...config,
                showTopPerformers: !config.showTopPerformers,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

type StatCardProps = {
  title: string;
  description: string;
  value: string;
  icon: ComponentType<{ size?: number }>;
  accent: string;
};

function StatCard({ title, description, value, icon: Icon, accent }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
      <div
        className={clsx(
          "inline-flex items-center gap-2 rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold text-white/90",
          accent
        )}
      >
        <Icon size={14} />
        {title}
      </div>
      <p className="mt-6 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-white/60">{description}</p>
    </div>
  );
}

type TogglePillProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function TogglePill({ label, active, onClick }: TogglePillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex items-center justify-between rounded-full border px-4 py-2 text-sm font-medium transition",
        active
          ? "border-emerald-400 bg-emerald-400/10 text-emerald-100"
          : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
      )}
    >
      <span>{label}</span>
      <CheckCircle2 size={16} className={active ? "text-emerald-300" : "text-white/30"} />
    </button>
  );
}

type InventorySectionProps = {
  inventory: InventoryItem[];
  allInventory: InventoryItem[];
  categories: string[];
  search: string;
  setSearch: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  lowStockOnly: boolean;
  setLowStockOnly: (value: boolean) => void;
  onEdit: (item: InventoryItem) => void;
};

function InventorySection({
  inventory,
  allInventory,
  categories,
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  lowStockOnly,
  setLowStockOnly,
  onEdit,
}: InventorySectionProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white/70">Inventory Control</p>
          <h2 className="text-xl font-semibold">Live Stock Ledger</h2>
          <p className="text-xs text-white/50">
            Track availability, low stock alerts, and restock schedules.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Filter
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SKU, barcode, or name"
              className="h-10 rounded-full border border-white/10 bg-black/30 pl-9 pr-4 text-sm text-white placeholder:text-white/50 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-10 rounded-full border border-white/10 bg-black/30 px-4 text-sm text-white focus:border-emerald-400 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={clsx(
              "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition",
              lowStockOnly
                ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
                : "border-white/10 bg-black/30 text-white/60 hover:bg-black/40"
            )}
          >
            <AlertTriangle size={16} className="mr-2" />
            Low stock only
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/5 text-sm text-white/70">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">SKU / Barcode</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Reorder</th>
              <th className="px-4 py-3 text-right">Incoming</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {inventory.map((item) => (
              <tr
                key={item.id}
                className={clsx(
                  "transition hover:bg-white/[0.05]",
                  item.stock <= item.reorderPoint && "bg-rose-500/5"
                )}
              >
                <td className="px-4 py-4">
                  <div className="font-medium text-white">{item.name}</div>
                  <div className="text-xs text-white/40">{item.description}</div>
                </td>
                <td className="px-4 py-4">
                  <div>{item.sku}</div>
                  <div className="text-xs text-white/40">{item.barcode}</div>
                </td>
                <td className="px-4 py-4">{item.category || "-"}</td>
                <td className="px-4 py-4 text-right font-semibold text-white">
                  {item.stock} {item.unit}
                </td>
                <td className="px-4 py-4 text-right">{item.reorderPoint}</td>
                <td className="px-4 py-4 text-right">{item.incoming}</td>
                <td className="px-4 py-4 text-right">₹{item.price.toFixed(2)}</td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-emerald-400 hover:bg-emerald-400/10 hover:text-emerald-200"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {inventory.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-white/40">
                  No products found with current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-white/40">
        Tracking {allInventory.length} products · {inventory.length} visible ·{" "}
        {allInventory.filter((item) => item.stock <= item.reorderPoint).length} require attention.
      </p>
    </div>
  );
}

type InvoiceSectionProps = {
  inventory: InventoryItem[];
  invoiceLines: InvoiceLine[];
  onLineChange: (id: string, partial: Partial<InvoiceLine>) => void;
  onSelectProduct: (lineId: string, productId: string) => void;
  onAddLine: () => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  customerContact: string;
  setCustomerContact: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  subtotal: number;
  taxAmount: number;
  couponDeduction: number;
  grandTotal: number;
  couponInput: string;
  setCouponInput: (value: string) => void;
  appliedCoupon: Coupon | null;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  onGenerateInvoice: () => void;
};

function InvoiceSection({
  inventory,
  invoiceLines,
  onLineChange,
  onSelectProduct,
  onAddLine,
  customerName,
  setCustomerName,
  customerContact,
  setCustomerContact,
  notes,
  setNotes,
  subtotal,
  taxAmount,
  couponDeduction,
  grandTotal,
  couponInput,
  setCouponInput,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  onGenerateInvoice,
}: InvoiceSectionProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-emerald-300/80">
          <Download size={14} />
          Invoice Orchestration
        </div>
        <h2 className="text-xl font-semibold text-white">Instant Bill Designer</h2>
        <p className="text-xs text-white/50">
          Build invoices with live stock pricing, coupon codes, and GST-ready totals.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-wide text-white/40">
            Customer Name
          </label>
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Customer full name"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-white/40">
            Contact / Email
          </label>
          <input
            value={customerContact}
            onChange={(event) => setCustomerContact(event.target.value)}
            placeholder="Phone number or email"
            className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm text-white/70">
          <thead className="bg-white/5 text-xs uppercase text-white/40">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Discount</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {invoiceLines.map((line) => {
              const lineTotal = line.quantity * line.price - line.discount;
              return (
                <tr key={line.id} className="bg-black/30">
                  <td className="px-4 py-4">
                    <select
                      value={line.productId || ""}
                      onChange={(event) =>
                        onSelectProduct(line.id, event.target.value)
                      }
                      className="w-full rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                    >
                      <option value="">Select product</option>
                      {inventory.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · ₹{product.price}
                        </option>
                      ))}
                    </select>
                    <input
                      value={line.name}
                      onChange={(event) =>
                        onLineChange(line.id, { name: event.target.value })
                      }
                      placeholder="Custom line item"
                      className="mt-2 w-full rounded-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(event) =>
                        onLineChange(line.id, { quantity: Number(event.target.value) })
                      }
                      className="w-20 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-right text-sm text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <input
                      type="number"
                      min={0}
                      value={line.price}
                      onChange={(event) =>
                        onLineChange(line.id, { price: Number(event.target.value) })
                      }
                      className="w-28 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-right text-sm text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <input
                      type="number"
                      min={0}
                      value={line.discount}
                      onChange={(event) =>
                        onLineChange(line.id, { discount: Number(event.target.value) })
                      }
                      className="w-24 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-right text-sm text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-white">
                    ₹{Math.max(lineTotal, 0).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={onAddLine}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-dashed border-white/30 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-emerald-400 hover:bg-emerald-400/10 hover:text-emerald-100"
      >
        <PlusCircle size={16} />
        Add another line
      </button>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-wide text-white/40">
            Coupon Code
          </label>
          <div className="mt-1 flex gap-2">
            <input
              value={couponInput}
              onChange={(event) => setCouponInput(event.target.value)}
              placeholder="Enter coupon"
              className="flex-1 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
            />
            {appliedCoupon ? (
              <button
                type="button"
                onClick={onRemoveCoupon}
                className="rounded-full border border-emerald-400 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={onApplyCoupon}
                className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
              >
                Apply
              </button>
            )}
          </div>
          {appliedCoupon && (
            <p className="mt-2 text-xs text-emerald-200">
              Applied {appliedCoupon.code} · {appliedCoupon.type === "percentage" ? `${appliedCoupon.value}%` : `₹${appliedCoupon.value}`} off
            </p>
          )}
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide text-white/40">
            Additional Notes
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
            placeholder="Delivery instructions, payment terms, etc."
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
        <div className="flex items-center justify-between text-sm text-white/60">
          <span>Subtotal</span>
          <span>₹{subtotal.toFixed(2)}</span>
        </div>
        {appliedCoupon && couponDeduction > 0 && (
          <div className="mt-2 flex items-center justify-between text-sm text-emerald-200">
            <span>Coupon ({appliedCoupon.code})</span>
            <span>-₹{couponDeduction.toFixed(2)}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-sm text-white/60">
          <span>GST ({(TAX_RATE * 100).toFixed(0)}%)</span>
          <span>₹{taxAmount.toFixed(2)}</span>
        </div>
        <div className="mt-4 flex items-center justify-between text-lg font-semibold text-white">
          <span>Grand Total</span>
          <span>₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onGenerateInvoice}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:brightness-110"
      >
        <Download size={16} />
        Generate GST Invoice
      </button>
    </div>
  );
}

type AlertsPanelProps = {
  alerts: { id: string; title: string; detail: string; severity: "critical" | "warning" }[];
};

function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-rose-500/30 via-amber-500/20 to-orange-500/10 p-6 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white/80">Alerts Center</p>
          <h3 className="text-lg font-semibold text-white">Inventory Signals</h3>
        </div>
        <Bell size={20} className="text-white/70" />
      </div>
      <ul className="mt-4 space-y-3">
        {alerts.length ? (
          alerts.map((alert) => (
            <li
              key={alert.id}
              className={clsx(
                "rounded-2xl bg-black/40 px-4 py-3 text-sm",
                alert.severity === "critical" ? "border border-rose-300/40 text-rose-50" : "text-amber-100"
              )}
            >
              <p className="font-medium">{alert.title}</p>
              <p className="text-xs text-white/60">{alert.detail}</p>
            </li>
          ))
        ) : (
          <li className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-xs text-white/50">
            All stocks are healthy. 🎉
          </li>
        )}
      </ul>
    </div>
  );
}

type InventoryFormProps = {
  formState: Omit<InventoryItem, "id">;
  setFormState: (state: Omit<InventoryItem, "id">) => void;
  onSave: () => void;
  onReset: () => void;
  editingId: string | null;
};

function InventoryForm({
  formState,
  setFormState,
  onSave,
  onReset,
  editingId,
}: InventoryFormProps) {
  function updateField<K extends keyof Omit<InventoryItem, "id">>(field: K, value: Omit<InventoryItem, "id">[K]) {
    setFormState({ ...formState, [field]: value });
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white/70">
            {editingId ? "Update Inventory Item" : "Add New Inventory"}
          </p>
          <p className="text-xs text-white/50">
            Scan barcode or fill details manually. Auto-sync enabled.
          </p>
        </div>
        <Users size={18} className="text-white/50" />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <FormInput
          label="Product Name"
          value={formState.name}
          onChange={(value) => updateField("name", value)}
          placeholder="E.g. Premium Tulsi Honey"
        />
        <FormInput
          label="SKU Code"
          value={formState.sku}
          onChange={(value) => updateField("sku", value)}
          placeholder="HN-TL-001"
        />
        <FormInput
          label="Barcode"
          value={formState.barcode}
          onChange={(value) => updateField("barcode", value)}
          placeholder="Scan or enter manually"
        />
        <FormInput
          label="Category"
          value={formState.category}
          onChange={(value) => updateField("category", value)}
          placeholder="Groceries, Stationery, etc."
        />
        <FormInput
          label="Supplier"
          value={formState.supplier}
          onChange={(value) => updateField("supplier", value)}
          placeholder="Vendor or supplier name"
        />
        <FormInput
          label="Unit"
          value={formState.unit}
          onChange={(value) => updateField("unit", value)}
          placeholder="Piece, pack, set..."
        />
        <FormInput
          label="Stock"
          type="number"
          value={formState.stock}
          onChange={(value) => updateField("stock", Number(value))}
          placeholder="0"
        />
        <FormInput
          label="Reorder Point"
          type="number"
          value={formState.reorderPoint}
          onChange={(value) => updateField("reorderPoint", Number(value))}
          placeholder="10"
        />
        <FormInput
          label="Incoming Stock"
          type="number"
          value={formState.incoming}
          onChange={(value) => updateField("incoming", Number(value))}
          placeholder="e.g. 50"
        />
        <FormInput
          label="Price (₹)"
          type="number"
          value={formState.price}
          onChange={(value) => updateField("price", Number(value))}
          placeholder="349"
        />
        <FormInput
          label="Last Restock Date"
          type="date"
          value={formState.lastRestock}
          onChange={(value) => updateField("lastRestock", value)}
        />
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-white/40">
            Product Details
          </label>
          <textarea
            value={formState.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
            placeholder="Short description to show on invoices."
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            <CheckCircle2 size={16} />
            {editingId ? "Update Item" : "Save Item"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            Reset
          </button>
        </div>
        <p className="text-xs text-white/40">
          Barcode scanner auto-fills the Barcode field. Other details can be edited anytime.
        </p>
      </div>
    </div>
  );
}

type FormInputProps = {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
};

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: FormInputProps) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-white/40">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:border-emerald-400 focus:outline-none"
      />
    </div>
  );
}

type RecentActivityProps = {
  activity: ActivityLog[];
};

function RecentActivity({ activity }: RecentActivityProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white/70">Recent Activity</p>
          <p className="text-xs text-white/50">Live log of inventory and invoicing actions.</p>
        </div>
        <Activity size={18} className="text-white/50" />
      </div>
      <ul className="mt-4 space-y-3">
        {activity.length ? (
          activity.map((log) => (
            <li
              key={log.id}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70"
            >
              <span
                className={clsx(
                  "mr-2 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide",
                  log.type === "inventory"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : log.type === "invoice"
                    ? "bg-sky-500/20 text-sky-200"
                    : "bg-white/10 text-white/50"
                )}
              >
                {log.type}
              </span>
              {log.message}
              <div className="mt-1 text-xs text-white/40">
                {format(new Date(log.timestamp), "PPpp")}
              </div>
            </li>
          ))
        ) : (
          <li className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xs text-white/40">
            Activity feed will appear here.
          </li>
        )}
      </ul>
    </div>
  );
}

type InvoiceHistoryProps = {
  invoices: InvoiceRecord[];
};

function InvoiceHistory({ invoices }: InvoiceHistoryProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white/70">Invoice History</p>
          <p className="text-xs text-white/50">Last 20 invoices auto-tracked for quick access.</p>
        </div>
        <Download size={18} className="text-white/50" />
      </div>
      <ul className="mt-4 space-y-3 text-sm text-white/70">
        {invoices.length ? (
          invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-white">{invoice.number}</p>
                <p className="text-xs text-white/50">
                  {invoice.customer} · {format(new Date(invoice.createdAt), "PPpp")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-emerald-200">
                  ₹{invoice.total.toFixed(2)}
                </p>
                <p className="text-xs text-white/40">
                  {invoice.couponCode ? `Coupon: ${invoice.couponCode}` : "No coupon"}
                </p>
              </div>
            </li>
          ))
        ) : (
          <li className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center text-xs text-white/40">
            Generate invoices to populate this list.
          </li>
        )}
      </ul>
    </div>
  );
}
