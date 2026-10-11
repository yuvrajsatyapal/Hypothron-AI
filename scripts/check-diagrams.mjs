import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.HYPOTHRON_CHROME ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
try {
  for (const file of process.argv.slice(2)) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await page.goto(pathToFileURL(resolve(file)).href);
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => {
      const svg = document.querySelector("svg"),
        view = svg.viewBox.baseVal;
      return {
        fontLoaded: document.fonts.check("12px Geist"),
        outside: [...svg.querySelectorAll("text")]
          .filter((t) => {
            const b = t.getBBox();
            return (
              b.x < 0 ||
              b.y < 0 ||
              b.x + b.width > view.width ||
              b.y + b.height > view.height
            );
          })
          .map((t) => t.textContent),
      };
    });
    if (geometry.outside.length)
      throw new Error(
        file + ": text outside canvas " + JSON.stringify(geometry.outside),
      );
    await page.screenshot({
      path: "/tmp/" + file.split("/").at(-1).replace(".html", ".png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await page.evaluate(() => ({
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      localScroll:
        document.querySelector(".diagram-container").scrollWidth >
        document.querySelector(".diagram-container").clientWidth,
    }));
    if (narrow.pageOverflow || !narrow.localScroll)
      throw new Error(file + ": narrow scroll failed");
    console.log(JSON.stringify({ file, ...geometry, ...narrow }));
    await page.close();
  }
} finally {
  await browser.close();
}
