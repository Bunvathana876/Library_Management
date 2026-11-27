// Playwright CLI run-code callback. Open the local app as a guest first.
// Requires a populated catalog; never writes application data.
async (page) => {
  const origin = new URL(page.url()).origin;
  const sizes = [
    [320, 568], [375, 812], [667, 375], [689, 900], [768, 1024],
    [1023, 768], [1024, 768], [1100, 900], [1280, 900], [1440, 900],
  ];
  const results = [];
  const failures = [];
  try {
    await page.goto(`${origin}/#overview`);
    await page.locator('.highlight-title').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const scale of ['100%', '200%']) {
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await page.evaluate(value => { document.documentElement.style.fontSize = value; }, scale);
        await page.evaluate(async () => {
          await Promise.allSettled(document.getAnimations()
            .filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished));
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        const measurement = await page.evaluate(() => {
          const selectors = '.hero-banner,.hero-content,.kpi-card,.card,.card-header,.highlight-row,.topbar-left,.topbar-actions';
          const clipped = [...document.querySelectorAll(selectors)]
            .filter(el => el.scrollWidth > el.clientWidth + 2)
            .map(el => ({ element: el.className, width: el.clientWidth, content: el.scrollWidth }));
          const heading = document.querySelector('.hero-heading');
          const range = document.createRange();
          range.selectNodeContents(heading);
          const bounds = heading.getBoundingClientRect();
          const headingClipped = [...range.getClientRects()]
            .some(rect => rect.right > bounds.right + 2 || rect.left < bounds.left - 2);
          return {
            documentFits: document.documentElement.scrollWidth <= innerWidth + 1,
            sidebarHidden: getComputedStyle(document.querySelector('.sidebar')).visibility === 'hidden',
            headingClipped,
            clipped,
          };
        });
        const result = { width, height, scale, ...measurement };
        results.push(result);
        if (!measurement.documentFits || measurement.headingClipped || measurement.clipped.length
            || (width < 1024 && !measurement.sidebarHidden)) failures.push(result);
      }
    }
  } finally {
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  if (failures.length) throw new Error(JSON.stringify(failures));
  return { passed: results.length, results };
}
