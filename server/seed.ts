// Seed data for a fresh DB: Marko's Bistro staff + a mock Gmail inbox.

export const seedHumans = [
  { id: "ana", name: "Ana Petrović", role: "Head Chef", emoji: "👩‍🍳", color: "#dd5b00" },
  { id: "luka", name: "Luka Marić", role: "Sous-chef", emoji: "🧑‍🍳", color: "#2a9d99" },
  { id: "jovan", name: "Jovan Ilić", role: "Line Cook", emoji: "🍳", color: "#1aae39" },
  { id: "mila", name: "Mila Kovač", role: "Line Cook", emoji: "🥘", color: "#62aef0" },
  { id: "sara", name: "Sara Nikolić", role: "Waiter", emoji: "🍽️", color: "#ff64c8" },
  { id: "nikola", name: "Nikola Jovanović", role: "Waiter", emoji: "🍷", color: "#d6b6f6" },
  { id: "tea", name: "Tea Savić", role: "Waiter", emoji: "☕", color: "#523410" },
  { id: "petar", name: "Petar Đorđević", role: "Restaurant Manager", emoji: "📋", color: "#0075de" },
];

const H = 3600_000;
const t0 = Date.now();

const produce = `Hi Marko,

Thanks for the order — delivered this morning. Invoice below.

ADRIATIC FRESH PRODUCE d.o.o.
Invoice no. AFP-2026-1184        Date: 06.11.2026
Deliver to: Marko's Bistro, Kneza Miloša 12

ITEM                      QTY    UNIT     UNIT PRICE    TOTAL
-------------------------------------------------------------
Tomatoes (vine)           12     kg       €2.10         €25.20
Lemons                    6      kg       €2.80         €16.80
Fresh basil               10     bunch    €1.20         €12.00
Garlic                    2      kg       €6.50         €13.00
Red onions                5      kg       €1.40         €7.00
-------------------------------------------------------------
                                          SUBTOTAL      €74.00
                                          VAT 20%       €14.80
                                          TOTAL DUE     €88.80

Payment within 15 days. Thank you!
Dragan — Adriatic Fresh Produce`;

const imports = `<html><body style="font-family:Georgia,serif">
<h2>Kalamata Imports — Tax Invoice #KI-55021</h2>
<p>Dear customer,<br/>please find your invoice for order placed 04/11/2026. Goods shipped 05/11/2026.</p>
<table border="1" cellpadding="6" cellspacing="0">
  <thead><tr><th>Product</th><th>Pack</th><th>Quantity</th><th>Price / unit</th><th>Line total</th></tr></thead>
  <tbody>
    <tr><td>Extra virgin olive oil</td><td>5 L tin</td><td>4 tins (20 L)</td><td>€8.90 / L</td><td>€178.00</td></tr>
    <tr><td>Feta cheese PDO</td><td>2 kg block</td><td>4 blocks (8 kg)</td><td>€9.50 / kg</td><td>€76.00</td></tr>
    <tr><td>Kalamata olives, pitted</td><td>1 kg jar</td><td>3 jars (3 kg)</td><td>€7.20 / kg</td><td>€21.60</td></tr>
  </tbody>
  <tfoot><tr><td colspan="4" align="right"><b>Total (incl. VAT)</b></td><td><b>€275.60</b></td></tr></tfoot>
</table>
<p>Kalamata Imports · Thessaloniki · orders@kalamata-imports.gr</p>
</body></html>`;

const butcher = `Good afternoon,

Your delivery from Novak Butchers is on its way. Here's what's on the truck:

• Chicken thighs, boneless — 15 kg @ €6.80/kg = €102.00
• Lamb shoulder — 6 kg @ €14.50/kg = €87.00
• Beef mince (for moussaka) — 4 kg @ €9.20/kg = €36.80

Invoice total: €225.80 (VAT included)
Reference: NB/11/2026/0347

Best,
Stefan Novak
Novak Butchers · Since 1987`;

const flour = `Invoice INV-7781 from Mlin Flour & Grains

Customer: Marko's Bistro
Date: 2026-11-05

Item,Qty,Unit,Unit price,Total
Flour type 400,25,kg,0.95,23.75
Arborio rice,10,kg,3.40,34.00
Dried oregano,0.5,kg,18.00,9.00
Sea salt,3,kg,1.10,3.30

Grand total EUR 70.05
Bank transfer to RS35 1600 0000 1234 5678 90`;

const newsletter = `RESTAURANT WEEKLY — November edition

🍂 Autumn menus that sell: 5 ideas for root vegetables
📈 Why food costs rose 4% this quarter (and what to do about it)
🎤 Interview: How a 30-seat taverna in Split cut waste by half

Read more at restaurantweekly.example
Unsubscribe | Manage preferences`;

const booking = `Hello,

I'd like to book a table for 12 people this Saturday (Nov 14) at 8pm for my father's 60th birthday.
Could you do a set menu? One guest is vegetarian and one is gluten-free.

Thanks,
Jelena Marković
+381 64 123 4567`;

const staff = `Hey Marko,

Can I swap my Friday evening shift with Tea? She said she's fine with it, I have a family thing.
Also, we're almost out of feta again, the notebook says 3 kg but I only see one block.

Thanks!
Sara`;

const utility = `ELEKTRO DISTRIBUCIJA — Monthly electricity bill

Account: 88-213-004 · Marko's Bistro
Billing period: 01.10.2026 – 31.10.2026

Consumption (kWh)      1 842
Energy charge          €221.04
Network fee            €38.50
VAT 20%                €51.91
AMOUNT DUE             €311.45

Due date: 20.11.2026. Pay online at elektro.example`;

export const seedEmails = [
  { id: "msg_7f3a01", fromName: "Adriatic Fresh Produce", fromAddr: "invoices@adriaticfresh.rs", subject: "Invoice AFP-2026-1184 — delivery 06.11", body: produce, receivedAt: t0 - 2 * H },
  { id: "msg_7f3a02", fromName: "Restaurant Weekly", fromAddr: "news@restaurantweekly.example", subject: "Autumn menus that sell 🍂", body: newsletter, receivedAt: t0 - 5 * H },
  { id: "msg_7f3a03", fromName: "Kalamata Imports", fromAddr: "orders@kalamata-imports.gr", subject: "Your invoice #KI-55021", body: imports, receivedAt: t0 - 9 * H },
  { id: "msg_7f3a04", fromName: "Jelena Marković", fromAddr: "jelena.markovic@gmail.example", subject: "Table for 12 on Saturday?", body: booking, receivedAt: t0 - 14 * H },
  { id: "msg_7f3a05", fromName: "Stefan Novak", fromAddr: "stefan@novakbutchers.rs", subject: "Delivery today + invoice NB/11/2026/0347", body: butcher, receivedAt: t0 - 20 * H },
  { id: "msg_7f3a06", fromName: "Sara Nikolić", fromAddr: "sara@markosbistro.com", subject: "Friday shift swap", body: staff, receivedAt: t0 - 26 * H },
  { id: "msg_7f3a07", fromName: "Mlin Flour & Grains", fromAddr: "billing@mlin-grains.rs", subject: "INV-7781", body: flour, receivedAt: t0 - 30 * H },
  { id: "msg_7f3a08", fromName: "Elektro Distribucija", fromAddr: "racuni@elektro.example", subject: "Your October electricity bill", body: utility, receivedAt: t0 - 40 * H },
];
