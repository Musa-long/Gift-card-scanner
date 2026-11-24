export async function alert(code: string, brand: string, state: string) {
  const token = process.env.TELEGRAM_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  const icon = state === "live_funded" ? "💰" : "🟢";
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: `${icon} ${brand.toUpperCase()} ${state}\n${code}` }),
  }).catch(() => {});
}
