import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("heading", { name: "Mission settings" }).waitFor();
  const compactToggle = page.locator(".setting-toggle input[type='checkbox']").first();
  const beforeToggle = await compactToggle.isChecked();
  await page.getByText("Compact evidence ledger", { exact: true }).click();
  const toggledValue = await compactToggle.isChecked();
  if (beforeToggle === toggledValue) throw new Error("Settings toggle did not change state");

  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await page.getByRole("heading", { name: "Findings register" }).waitFor();
  await page.getByLabel("Search findings").fill("unquoted");
  await page.getByRole("button", { name: "Rejected", exact: true }).click();
  await page.getByText("Unquoted service path", { exact: true }).waitFor();

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await page.getByRole("heading", { name: "Findings register" }).waitFor();
  const restoredSearch = await page.getByLabel("Search findings").inputValue();
  if (restoredSearch !== "unquoted") throw new Error("Findings search did not persist after reload");
  await page.getByText("Unquoted service path", { exact: true }).waitFor();

  await page.getByRole("button", { name: "Missions", exact: true }).click();
  await page.keyboard.press("?");
  await page.getByRole("status").getByText("Shortcuts: Space play/pause").waitFor();
  await page.keyboard.press("Alt+4");
  await page.getByRole("heading", { name: "Findings register" }).waitFor();
  await page.keyboard.press("Alt+2");
  await page.getByRole("heading", { name: "Mission timeline replay" }).waitFor();

  console.log(JSON.stringify({ persistence: "passed", keyboardShortcuts: "passed" }));
} finally {
  await browser.close();
}
