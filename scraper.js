// scraper.js
const { chromium } = require('playwright');

const BASE_URL = 'https://www.sifiraracal.com';
const HEADLESS = process.env.HEADLESS !== 'false';
const NAV_TIMEOUT = 45000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const HAS_TASARIM_FN = () => {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const h of headings) {
    if (/^TASARIM$/i.test((h.textContent || '').trim())) return true;
  }
  return false;
};

async function gotoAndSettle(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await sleep(1200);
  try { await page.keyboard.press('Escape'); } catch {}
  try {
    const cookieBtn = page.getByRole('button', { name: /Kabul Et/i });
    if (await cookieBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      await cookieBtn.click();
      await sleep(300);
    }
  } catch {}
  await page.evaluate(async () => {
    await new Promise(res => {
      let y = 0;
      const t = setInterval(() => {
        window.scrollBy(0, 600);
        y += 600;
        if (y >= document.body.scrollHeight) { clearInterval(t); res(); }
      }, 60);
    });
  });
  await sleep(400);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function collectModelLinks(page, brandSlug) {
  return page.evaluate((slug) => {
    const re = new RegExp(`^/${slug}-modelleri/[a-z0-9-]+$`, 'i');
    return [...new Set(
      [...document.querySelectorAll('a[href]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h && re.test(h))
    )];
  }, brandSlug);
}

async function collectVersionLinks(page, modelSlug) {
  return page.evaluate((slug) => {
    const re = new RegExp(`-modelleri/${slug}-ozellikleri/[a-z0-9-]+$`, 'i');
    return [...new Set(
      [...document.querySelectorAll('a[href]')]
        .map(a => a.getAttribute('href'))
        .filter(h => h && re.test(h))
    )];
  }, modelSlug);
}

async function runScraper(brandSlugs, onEvent = () => {}) {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: 'tr-TR',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/125.0 Safari/537.36'
  });

  const results = [];
  const summary = { totalVersions: 0, missing: 0, skipped: 0 };
  const page = await context.newPage();

  try {
    for (const brandSlug of brandSlugs) {
      onEvent({ type: 'brand-start', brand: brandSlug });
      const brandUrl = `${BASE_URL}/${brandSlug}-modelleri`;

      try {
        await gotoAndSettle(page, brandUrl);
      } catch (err) {
        onEvent({ type: 'error', scope: 'brand', url: brandUrl, message: err.message });
        continue;
      }

      const modelPaths = await collectModelLinks(page, brandSlug);
      onEvent({ type: 'brand-models', brand: brandSlug, count: modelPaths.length });

      for (const modelPath of modelPaths) {
        const modelUrl = BASE_URL + modelPath;
        const modelSlug = modelPath.split('/').pop();
        onEvent({ type: 'model-start', brand: brandSlug, model: modelSlug });

        try {
          await gotoAndSettle(page, modelUrl);
        } catch (err) {
          onEvent({ type: 'error', scope: 'model', url: modelUrl, message: err.message });
          continue;
        }

        const versionPaths = await collectVersionLinks(page, modelSlug);
        onEvent({ type: 'model-versions', model: modelSlug, count: versionPaths.length });

        for (const vPath of versionPaths) {
          const versionUrl = BASE_URL + vPath;
          const versionSlug = vPath.split('/').pop();

          try {
            await gotoAndSettle(page, versionUrl);

            const isValid = await page.evaluate((slug) => {
              return (
                location.pathname.includes(`${slug}-ozellikleri`) &&
                /özellik|donanım|versiyon|tasarım/i.test(document.body.innerText || '')
              );
            }, modelSlug);

            if (!isValid) {
              summary.skipped++;
              onEvent({ type: 'skip', url: versionUrl, reason: 'Geçersiz versiyon sayfası' });
              continue;
            }

            const hasTasarim = await page.evaluate(HAS_TASARIM_FN);
            summary.totalVersions++;

            if (!hasTasarim) {
              summary.missing++;
              const row = {
                marka: brandSlug,
                model: modelSlug,
                versiyon: versionSlug,
                durum: 'EKSİK',
                sayfa: versionUrl
              };
              results.push(row);
              onEvent({ type: 'missing', row });
            } else {
              onEvent({ type: 'ok', model: modelSlug, version: versionSlug });
            }
          } catch (err) {
            onEvent({ type: 'error', scope: 'version', url: versionUrl, message: err.message });
          }
        }
      }
    }
  } finally {
    await page.close();
    await browser.close();
  }

  return { results, summary };
}

module.exports = { runScraper };

if (require.main === module) {
  (async () => {
    const brands = process.argv.slice(2);
    if (!brands.length) {
      console.log('Kullanım: node scraper.js alfa-romeo bmw audi');
      process.exit(1);
    }
    const { results, summary } = await runScraper(brands, (e) => {
      switch (e.type) {
        case 'brand-start':    console.log(`\n🏁 ${e.brand}`); break;
        case 'brand-models':   console.log(`   ${e.count} model`); break;
        case 'model-start':    console.log(`   📦 ${e.model}`); break;
        case 'model-versions': console.log(`      ${e.count} versiyon`); break;
        case 'missing':        console.log(`      ❌ ${e.row.model}/${e.row.versiyon}`); break;
        case 'ok':             console.log(`      ✅ ${e.model}/${e.version}`); break;
        case 'skip':           console.log(`      ⏭️ atlandı: ${e.reason}`); break;
        case 'error':          console.log(`      ⚠️ ${e.message}`); break;
      }
    });
    console.log('\n===== SONUÇ =====');
    console.log(JSON.stringify(results, null, 2));
    console.log('Özet:', summary);
  })();
}