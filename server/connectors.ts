// The Connectors catalog (04 A3, 05 §3.1). Pure: imported by the server and the web app.
// Only Gmail does anything; the rest connect for show and nothing can use them yet.

export type Category = "Email & chat" | "Sheets & docs" | "Automation" | "Sales & payments" | "Accounting";
export type Connector = {
  id: string;
  name: string;
  category: Category;
  description: string;
  scopes: string[];
  functional: boolean;
  signIn: "google" | "generic";
};

const c = (id: string, name: string, category: Category, description: string, scopes: string[], signIn: "google" | "generic" = "generic"): Connector =>
  ({ id, name, category, description, scopes, functional: id === "gmail", signIn });

export const CONNECTORS: Connector[] = [
  c("gmail", "Gmail", "Email & chat", "Read supplier email", ["Read your email messages", "Mark supplier invoices as processed"], "google"),
  c("outlook", "Outlook", "Email & chat", "Keep email in one place", ["Read your email", "Organize messages"]),
  c("slack", "Slack", "Email & chat", "Keep up with team messages", ["Read channel messages", "Send messages"]),
  c("whatsapp", "WhatsApp Business", "Email & chat", "Keep up with customer messages", ["Read business messages", "Reply to customers"]),
  c("google-sheets", "Google Sheets", "Sheets & docs", "Work with spreadsheets", ["See, edit and create your Google Sheets spreadsheets"], "google"),
  c("excel", "Microsoft Excel", "Sheets & docs", "Work with Excel workbooks", ["Read workbooks", "Update worksheet rows"]),
  c("google-drive", "Google Drive", "Sheets & docs", "Find your business files", ["See and download your Google Drive files"], "google"),
  c("notion", "Notion", "Sheets & docs", "Keep business notes together", ["Read pages", "Update pages"]),
  c("zapier", "Zapier", "Automation", "Link work between your tools", ["View workflows", "Run workflows"]),
  c("make", "Make", "Automation", "Connect steps across your tools", ["View scenarios", "Run scenarios"]),
  c("square", "Square", "Sales & payments", "Keep up with sales and payments", ["View sales", "View payments"]),
  c("shopify", "Shopify", "Sales & payments", "Keep up with store orders", ["Read orders", "Read products"]),
  c("quickbooks", "QuickBooks", "Accounting", "Keep up with your accounts", ["Read bills", "Read transactions"]),
  c("xero", "Xero", "Accounting", "Keep up with your accounts", ["Read bills", "Read transactions"]),
];

export const getConnector = (id: string) => CONNECTORS.find((x) => x.id === id);
