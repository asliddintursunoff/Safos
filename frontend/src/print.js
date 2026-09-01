import { unitLabel } from "./api";

function personName(user) {
  if (!user) return "";
  if (typeof user === "string") return user;
  return `${user.first_name || ""} ${user.last_name || ""}`.trim();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatTashkent(value) {
  if (!value) return "";
  const str = String(value).trim();
  let date;
  if (/^\d{4}-\d{2}-\d{2}T/.test(str) || /[zZ]$/.test(str) || /[+-]\d{2}:\d{2}$/.test(str)) {
    date = new Date(str);
  } else {
    const dmy = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (dmy) {
      date = new Date(`${dmy[3]}-${pad2(dmy[2])}-${pad2(dmy[1])}T${pad2(dmy[4] || 0)}:${pad2(dmy[5] || 0)}:00+05:00`);
    } else {
      date = new Date(str);
    }
  }
  if (Number.isNaN(date.getTime())) return str;
  const map = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return `${map.day}/${map.month}/${map.year} ${map.hour}:${map.minute}`;
}

const PRINT_BASE = "https://asliddintursunoff.github.io/url-redirect/print.html?data=";

function padR(value, width) {
  const text = String(value ?? "");
  if (text.length >= width) return text.slice(0, width);
  return text + " ".repeat(width - text.length);
}

function padL(value, width) {
  const text = String(value ?? "");
  if (text.length >= width) return text.slice(0, width);
  return " ".repeat(width - text.length) + text;
}

function moneyInt(value) {
  const n = Math.round(Number(value) || 0);
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function person(user) {
  return personName(user) || "";
}

export function getOrderPrintUrl(order) {
  const ESC = "\x1B";
  const GS = "\x1D";
  const boldOn = `${ESC}E\x01`;
  const boldOff = `${ESC}E\x00`;
  const center = `${ESC}a\x01`;
  const left = `${ESC}a\x00`;
  const bigOn = `${GS}!\x33`;
  const bigOff = `${GS}!\x00`;

  const lineWidth = 48;
  const sep = `${"█".repeat(lineWidth)}\n`;
  const nameW = 16;
  const priceW = 10;
  const qtyW = 12;
  const sumW = 10;

  const lines = [];
  lines.push(`${center}${boldOn}${bigOn}SAFOS\n${bigOff}${boldOff}`);
  lines.push(`${center}Sof mahsulot\n`);
  lines.push(sep);

  lines.push(left);
  const agent = person(order.ordered_by);
  if (agent) lines.push(`${boldOn}Agent: ${boldOff}${agent}\n`);
  const deliverer = person(order.delivered_by);
  if (deliverer) lines.push(`${boldOn}Dostavchik: ${boldOff}${deliverer}\n`);
  lines.push("\n");

  const owner = order.market_name || order.markent_name || "Noma'lum";
  lines.push(`${boldOn}Buyurtma egasi: ${boldOff}${owner}\n`);

  if (order.created_at) {
    lines.push(`${boldOn}Olingan vaqt: ${boldOff}${formatTashkent(order.created_at)}\n`);
  }
  if (order.delivered_at) {
    lines.push(`${boldOn}Yetkazilgan: ${boldOff}${formatTashkent(order.delivered_at)}\n`);
  }
  lines.push(sep);

  lines.push(
    `${boldOn}${padR("Nomi", nameW)}${padR("Narx", priceW)}${padR("Soni", qtyW)}${padL("Summa", sumW)}\n${boldOff}`
  );
  lines.push(sep);

  let subtotal = 0;
  for (const item of order.items || []) {
    const name = String(item.product_name || item.product?.name || "").slice(0, nameW);
    const price = Number(item.product_price ?? item.product?.price ?? 0);
    const qty = Number(item.quantity || 0);
    const unit = unitLabel(item.product_unit || item.product?.unit || "");
    const lineTotal = Number(item.total_price != null ? item.total_price : qty * price);
    subtotal += lineTotal;
    const qtyStr = `${moneyInt(qty)}${unit ? ` ${unit}` : ""}`;
    lines.push(
      `${padR(name, nameW)}${padR(moneyInt(price), priceW)}${padR(qtyStr, qtyW)}${padL(moneyInt(lineTotal), sumW)}\n`
    );
    lines.push(sep);
  }

  const grand = Number(order.total_price_with_discount != null ? order.total_price_with_discount : subtotal);
  const discount = Number(order.market_discount_percentage || 0);
  if (discount > 0 && Number(order.total_price) !== grand) {
    lines.push(`${boldOn}${padR("Chegirma:", nameW + priceW + qtyW)}${padL(`${discount}%`, sumW)}\n${boldOff}`);
  }
  lines.push(
    `${boldOn}${padR("Jami:", nameW + priceW + qtyW)}${padL(moneyInt(grand), sumW)}\n${boldOff}`
  );

  lines.push("\n\n");
  const sign = "IMZO:  ";
  lines.push(`${sign}\n`);
  lines.push(`       ${"█".repeat(Math.max(8, lineWidth - sign.length))}\n`);
  lines.push(`${center}${boldOn}Rahmat! Yana kutib qolamiz!\n${boldOff}`);
  lines.push(`${center}\n\n\n`);

  return `${PRINT_BASE}${encodeURIComponent(lines.join(""))}`;
}

export function openOrderPrint(order) {
  const url = getOrderPrintUrl(order);
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) {
    tg.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
