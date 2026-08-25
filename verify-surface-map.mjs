import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Attack Surface", exact: true }).click();
  await page.getByRole("heading", { name: "Attack surface" }).waitFor();
  await page.getByLabel("Search attack surface").fill("upload");
  await page.getByText("POST /upload", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Critical", exact: true }).click();
  await page.getByText("1 topology entities shown", { exact: true }).waitFor();
  await page.locator(".surface-asset-row").filter({ hasText: "POST /upload" }).click();
  await page.getByText("Writable web route", { exact: true }).waitFor();
  await page.screenshot({ path: "/home/ubuntu/screenshots/nexus-surface-map.png", fullPage: true });
  await page.getByRole("button", { name: /Open evidence/ }).click();
  await page.getByRole("heading", { name: "Evidence custody" }).waitFor();
  console.log(JSON.stringify({ attackSurfaceMap: "passed", search: "passed", riskFilter: "passed", evidenceNavigation: "passed" }));
} finally {
  await browser.close();
}
