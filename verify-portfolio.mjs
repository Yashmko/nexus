import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  await page.getByRole("heading", { name: "Mission portfolio" }).waitFor();
  await page.getByLabel("Search mission portfolio").fill("Helios");
  await page.getByText("Helios API Exposure Review", { exact: true }).first().waitFor();
  await page.getByRole("button", { name: "Critical", exact: true }).click();
  await page.getByText("1 mission shown", { exact: true }).waitFor();
  await page.locator(".portfolio-mission-row").filter({ hasText: "Helios API Exposure Review" }).click();
  await page.getByText("Priority route validation is constrained to the approved API surface.", { exact: true }).waitFor();
  await page.screenshot({ path: "/home/ubuntu/screenshots/nexus-portfolio.png", fullPage: true });
  await page.getByRole("button", { name: /Open mission timeline/ }).click();
  await page.getByRole("heading", { name: "Mission timeline replay" }).waitFor();
  console.log(JSON.stringify({ portfolio: "passed", search: "passed", riskFilter: "passed", missionNavigation: "passed" }));
} finally {
  await browser.close();
}
