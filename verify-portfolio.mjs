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
  await page.getByText("Sign in to manage missions", { exact: true }).waitFor();
  await page.getByText("Mission creation, archival, assignments, and approval queues are stored in the authenticated NEXUS workspace.", { exact: false }).waitFor();
  await page.screenshot({ path: "/home/ubuntu/screenshots/nexus-data-portfolio.png", fullPage: true });
  console.log(JSON.stringify({ authenticatedPortfolioGate: "passed", missionOperationsUi: "gated" }));
} finally {
  await browser.close();
}
