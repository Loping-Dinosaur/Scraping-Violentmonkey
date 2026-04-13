// ==UserScript==
// @name         Amazon Auto-Scraper
// @namespace    http://violentmonkey.net/
// @version      1.0.1
// @description  Automates listing extraction for Amazon (Title, Price, Details, Bullets, Reviews)
// @match        *://*.amazon.it/*
// @match        *://*.amazon.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const QUEUE_KEY = 'scrapeQueue';
    const RESULTS_KEY = 'scrapeResults';
    const PAUSED_KEY = 'scrapePaused';

    // Helper: Clean string for HTML injection
    const escapeHtml = str => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 1. MAIN PAGE LOGIC (Search Results - Auto-Scroll & Collect)
    if (!localStorage.getItem(QUEUE_KEY) && window.location.href.includes('/s?')) {
        const panel = document.createElement('div');
        panel.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:999999;padding:15px;background:white;border:2px solid #ff9900;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;flex-direction:column;gap:10px;";

        const label = document.createElement('label');
        label.innerText = "Items to scrape:";
        label.style.fontWeight = "bold";

        const input = document.createElement('input');
        input.type = "number";
        input.value = 20;
        input.min = 1;
        input.style.padding = "5px";

        const startBtn = document.createElement('button');
        startBtn.innerText = "Start Scraping";
        startBtn.style.cssText = "padding:10px;background:#ff9900;color:#111;border:none;border-radius:5px;cursor:pointer;font-weight:bold;";

        const statusText = document.createElement('div');
        statusText.style.cssText = "font-size:12px;color:#555;font-weight:bold;text-align:center;";

        panel.appendChild(label);
        panel.appendChild(input);
        panel.appendChild(startBtn);
        panel.appendChild(statusText);
        document.body.appendChild(panel);

        startBtn.onclick = () => {
            const maxItems = parseInt(input.value, 10) || 20;
            startBtn.disabled = true;
            input.disabled = true;

            let currentAsins = new Set();
            let scrollAttempts = 0;
            const MAX_ATTEMPTS = 50;

            const scrollInterval = setInterval(() => {
                // Find all product links and extract the ASIN to create clean URLs
                const links = document.querySelectorAll('a[href*="/dp/"], a[href*="/gp/product/"]');
                links.forEach(a => {
                    const match = a.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
                    if (match && match[1]) {
                        currentAsins.add(match[1]);
                    }
                });

                statusText.innerText = `Scrolling... Found: ${currentAsins.size}/${maxItems}`;

                if (currentAsins.size >= maxItems || scrollAttempts >= MAX_ATTEMPTS) {
                    clearInterval(scrollInterval);

                    const finalLinks = Array.from(currentAsins).slice(0, maxItems).map(asin => `${window.location.origin}/dp/${asin}`);

                    if (finalLinks.length === 0) {
                        alert("No Amazon products found on this page.");
                        startBtn.disabled = false;
                        input.disabled = false;
                        statusText.innerText = "";
                        return;
                    }

                    localStorage.setItem(QUEUE_KEY, JSON.stringify(finalLinks));
                    localStorage.setItem(RESULTS_KEY, '');
                    localStorage.setItem(PAUSED_KEY, 'false');
                    window.location.href = finalLinks[0];
                } else {
                    window.scrollTo(0, document.body.scrollHeight);
                    scrollAttempts++;
                }
            }, 1000);
        };
    }

    // 2. PRODUCT PAGE LOGIC (Extract, Pause, Navigate)
    if (localStorage.getItem(QUEUE_KEY) && window.location.href.includes('/dp/')) {

        const controlPanel = document.createElement('div');
        controlPanel.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:999999;padding:15px;background:white;border:2px solid #333;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;flex-direction:column;gap:10px;";

        const queueStatus = document.createElement('div');
        queueStatus.style.fontWeight = "bold";

        const pauseBtn = document.createElement('button');
        pauseBtn.innerText = localStorage.getItem(PAUSED_KEY) === 'true' ? "Resume" : "Pause";
        pauseBtn.style.cssText = "padding:10px;background:#f5a623;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;";

        const stopSaveBtn = document.createElement('button');
        stopSaveBtn.innerText = "Stop & Save";
        stopSaveBtn.style.cssText = "padding:10px;background:#28a745;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;";

        const stopCancelBtn = document.createElement('button');
        stopCancelBtn.innerText = "Stop (Cancel)";
        stopCancelBtn.style.cssText = "padding:10px;background:#d93025;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;";

        controlPanel.appendChild(queueStatus);
        controlPanel.appendChild(pauseBtn);
        controlPanel.appendChild(stopSaveBtn);
        controlPanel.appendChild(stopCancelBtn);
        document.body.appendChild(controlPanel);

        let queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        queueStatus.innerText = `Remaining: ${queue.length}`;

        function downloadAndClean() {
            const results = localStorage.getItem(RESULTS_KEY) || '';
            if (results) {
                const finalHtml = `<html><head><meta charset="utf-8"></head><body style="padding:20px; font-family: Arial, sans-serif;">${results}</body></html>`;
                const blob = new Blob([finalHtml], { type: 'text/html' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'amazon_scrape_export.html';
                a.click();
            }
            localStorage.removeItem(QUEUE_KEY);
            localStorage.removeItem(RESULTS_KEY);
            localStorage.removeItem(PAUSED_KEY);
        }

        stopCancelBtn.onclick = () => {
            localStorage.removeItem(QUEUE_KEY);
            localStorage.removeItem(RESULTS_KEY);
            localStorage.removeItem(PAUSED_KEY);
            alert("Scraping cancelled.");
            controlPanel.remove();
        };

        stopSaveBtn.onclick = () => {
            downloadAndClean();
            alert("Scraping stopped. HTML downloaded.");
            controlPanel.remove();
        };

        pauseBtn.onclick = () => {
            const isPaused = localStorage.getItem(PAUSED_KEY) === 'true';
            if (isPaused) {
                localStorage.setItem(PAUSED_KEY, 'false');
                pauseBtn.innerText = "Pause";
                checkAndNavigate();
            } else {
                localStorage.setItem(PAUSED_KEY, 'true');
                pauseBtn.innerText = "Resume";
            }
        };

        function checkAndNavigate() {
            if (localStorage.getItem(PAUSED_KEY) === 'true') return;

            let currentQueue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
            if (currentQueue.length > 0) {
                window.location.href = currentQueue[0];
            } else {
                downloadAndClean();
                alert("Scraping finished! HTML downloaded.");
                controlPanel.remove();
            }
        }

        // Wait a few seconds for Amazon to load DOM elements (reviews, prices)
        setTimeout(() => {
            if (!document.getElementById('extracted-flag')) {
                let results = localStorage.getItem(RESULTS_KEY) || '';

                try {
                    // 1. Extract Title
                    const titleEl = document.querySelector('#productTitle');
                    const title = titleEl ? titleEl.innerText.trim() : 'Senza titolo';

                    // 2. Extract Price (Looks for the main price boxes)
                    const priceEl = document.querySelector('.a-price .a-offscreen') || document.querySelector('#priceblock_ourprice') || document.querySelector('#corePrice_desktop .a-price .a-offscreen');
                    const price = priceEl ? priceEl.innerText.trim() : 'N/A';

                    // 3. Extract Stars & Review Count
                    const starsEl = document.querySelector('#acrPopover') || document.querySelector('.a-icon-star-small .a-icon-alt');
                    const stars = starsEl ? (starsEl.title || starsEl.innerText.trim()) : 'N/A';

                    const reviewsEl = document.querySelector('#acrCustomerReviewText');
                    // FIX: Rimuovo le parentesi se Amazon le ha già inserite nel testo usando .replace(/[()]/g, '')
                    const reviews = reviewsEl ? reviewsEl.innerText.replace(/[()]/g, '').trim() : '0 voti';

                    // 4. Extract Description (Overview Table + Bullet Points)
                    let descriptionHtml = '';

                    // Get the table rows (Brand, Compatible devices, etc.)
                    const overviewRows = document.querySelectorAll('#productOverview_feature_div tr');
                    if (overviewRows.length > 0) {
                        descriptionHtml += '<ul style="margin-bottom: 10px;">';
                        overviewRows.forEach(row => {
                            const key = row.querySelector('td:nth-child(1)')?.innerText.trim();
                            // Some cells have truncated text with hidden "see more", grab the full text if possible, else fallback
                            const valFull = row.querySelector('.a-truncate-full');
                            const valNormal = row.querySelector('td:nth-child(2)');

                            let val = '';
                            if (valFull && valFull.innerText.trim() !== '') {
                                val = valFull.innerText.trim();
                            } else if (valNormal) {
                                val = valNormal.innerText.replace(/Mostra altro/gi, '').trim();
                            }

                            if (key && val) {
                                descriptionHtml += `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(val)}</li>`;
                            }
                        });
                        descriptionHtml += '</ul>';
                    }

                    // Get the bullet points ("Informazioni su questo articolo")
                    const bullets = document.querySelectorAll('#feature-bullets li span.a-list-item');
                    if (bullets.length > 0) {
                        descriptionHtml += '<strong>Informazioni su questo articolo:</strong><ul>';
                        bullets.forEach(li => {
                            const text = li.innerText.trim();
                            // Filter out blank list items or script injections
                            if (text && !text.includes('Visualizza altri dettagli')) {
                                descriptionHtml += `<li>${escapeHtml(text)}</li>`;
                            }
                        });
                        descriptionHtml += '</ul>';
                    }

                    // Compile Result String
                    const url = window.location.href.split('?')[0].split('ref=')[0]; // Clean URL again just in case

                    const htmlString = `
                        <div style="border-bottom: 1px solid #ccc; padding-bottom: 15px; margin-bottom: 15px;">
                            <h3 style="margin:0 0 8px 0; color:#007185;">${escapeHtml(title)}</h3>
                            <p style="margin:0 0 6px 0; color:#B12704; font-size: 18px;"><strong>${escapeHtml(price)}</strong></p>
                            <p style="margin:0 0 10px 0; font-size: 14px; color: #555;"><strong>Valutazione:</strong> ${escapeHtml(stars)} (${escapeHtml(reviews)})</p>
                            <div style="font-size: 14px; line-height: 1.5;">${descriptionHtml}</div>
                            <p style="margin: 10px 0 0 0; font-size: 12px;"><strong>Link:</strong> <a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a></p>
                        </div>
                    `;

                    results += htmlString;
                    localStorage.setItem(RESULTS_KEY, results);

                    const flag = document.createElement('div');
                    flag.id = 'extracted-flag';
                    document.body.appendChild(flag);

                } catch (err) {
                    console.error("Extraction failed for", window.location.href, err);
                }

                queue.shift();
                localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            }

            checkAndNavigate();

        }, 4000); // 4 seconds delay to ensure Amazon loads dynamic content (prices, tables)
    }
})();