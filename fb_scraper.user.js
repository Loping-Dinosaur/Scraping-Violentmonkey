// ==UserScript==
// @name         FB Marketplace Auto-Scraper
// @namespace    http://violentmonkey.net/
// @version      1.3.2
// @description  Automates listing extraction with Auto-Scroll, Start, Pause, Stop & Save - UI in Bottom Right
// @match        https://www.facebook.com/marketplace/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Loping-Dinosaur/Scraping-Violentmonkey/main/fb_scraper.user.js
// @downloadURL  https://raw.githubusercontent.com/Loping-Dinosaur/Scraping-Violentmonkey/main/fb_scraper.user.js
// ==/UserScript==

(function () {
    'use strict';
// this is only a test
    const QUEUE_KEY = 'scrapeQueue';
    const RESULTS_KEY = 'scrapeResults';
    const PAUSED_KEY = 'scrapePaused';

    // 1. MAIN PAGE LOGIC (Auto-Scroll & Setup)
    if (!localStorage.getItem(QUEUE_KEY) && !window.location.href.includes('/item/')) {
        const panel = document.createElement('div');
        // MODIFICATO: Spostato in basso a destra
        panel.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;padding:15px;background:white;border:2px solid #0866ff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;flex-direction:column;gap:10px;";

        const label = document.createElement('label');
        label.innerText = "Items to scrape:";
        label.style.fontWeight = "bold";

        const input = document.createElement('input');
        input.type = "number";
        input.value = 50;
        input.min = 1;
        input.style.padding = "5px";

        const startBtn = document.createElement('button');
        startBtn.innerText = "Start Scraping";
        startBtn.style.cssText = "padding:10px;background:#0866ff;color:white;border:none;border-radius:5px;cursor:pointer;font-weight:bold;";

        const statusText = document.createElement('div');
        statusText.style.cssText = "font-size:12px;color:#555;font-weight:bold;text-align:center;";

        panel.appendChild(label);
        panel.appendChild(input);
        panel.appendChild(startBtn);
        panel.appendChild(statusText);
        document.body.appendChild(panel);

        startBtn.onclick = () => {
            const maxItems = parseInt(input.value, 10) || 50;
            startBtn.disabled = true;
            input.disabled = true;

            let currentLinks = [];
            let scrollAttempts = 0;
            const MAX_ATTEMPTS = 100;

            const scrollInterval = setInterval(() => {
                const rawLinks = Array.from(document.querySelectorAll('a[href*="/item/"]')).map(a => a.href.split('?')[0]);
                currentLinks = [...new Set(rawLinks)];

                statusText.innerText = `Scrolling... Found: ${currentLinks.length}/${maxItems}`;

                if (currentLinks.length >= maxItems || scrollAttempts >= MAX_ATTEMPTS) {
                    clearInterval(scrollInterval);

                    const finalLinks = currentLinks.slice(0, maxItems);
                    if (finalLinks.length === 0) {
                        alert("No listings found on this page.");
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

    // 2. ITEM PAGE LOGIC (Extract, Pause, Stop, Navigate)
    if (localStorage.getItem(QUEUE_KEY) && window.location.href.includes('/item/')) {

        const controlPanel = document.createElement('div');
        // MODIFICATO: Spostato in basso a destra
        controlPanel.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:9999;padding:15px;background:white;border:2px solid #333;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;flex-direction:column;gap:10px;";

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
                const finalHtml = `<html><head><meta charset="utf-8"></head><body style="padding:20px;">${results}</body></html>`;
                const blob = new Blob([finalHtml], {
                    type: 'text/html'
                });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'marketplace_gemini_export.html';
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
            if (localStorage.getItem(PAUSED_KEY) === 'true') {
                return;
            }

            let currentQueue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
            if (currentQueue.length > 0) {
                window.location.href = currentQueue[0];
            } else {
                downloadAndClean();
                alert("Scraping finished! HTML downloaded.");
                controlPanel.remove();
            }
        }

        setTimeout(() => {
            if (!document.getElementById('extracted-flag')) {
                let results = localStorage.getItem(RESULTS_KEY) || '';

                try {
                    const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
                    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                    const visible = el => !!(el && el.getClientRects && el.getClientRects().length);
                    const textOf = el => clean(el?.innerText || el?.textContent || '');
                    const meta = (name, attr = 'property') => clean(document.querySelector(`meta[${attr}="${name.replace(/"/g, '\\"')}"]`)?.content || '');
                    const stripTitle = s => clean(s).replace(/\s*[|•–-]\s*(?:Facebook|Marketplace|Meta)\b.*$/i, '').replace(/\s*\(\s*(?:Facebook|Marketplace|Meta)\s*\)\s*$/i, '').trim();

                    const badTitleRe = /^(?:filtri?|filters?|results?|risultati|search results?|marketplace|facebook|meta|home|buy and sell|annunci?|saved|sponsored|browse|explore|categories?)$/i;
                    const badTitleHasRe = /(?:\bfiltri?\b|\bfilters?\b|\bmarketplace\b|\bfacebook\b|\bsearch results?\b|\brisultati\b|\bannunci?\b|\bbuy and sell\b|\bsaved\b|\bsponsored\b|\bcategories?\b)/i;
                    const isBadTitle = s => {
                        const t = stripTitle(s);
                        if (!t || t.length < 3) return true;
                        if (badTitleRe.test(t)) return true;
                        if (badTitleHasRe.test(t) && t.length < 40) return true;
                        return false;
                    };

                    const badDescRe = /(scopri di più sugli acquisti dai consumatori|consumer purchases|i tuoi diritti di consumatore limitati|ruolo di intermediario di facebook|your consumer rights are limited|facebook acts as a marketplace intermediary|marketplace|facebook|meta|save|share|messaggio|messaggi|overview|details|descrizione|description|view more|see more|mostra altro|mostra di più|filtri|filters|results?|risultati|category|categories|annuncio pubblicato|la posizione è approssimativa|l[’']ubicazione è approssimativa)/i;
                    const isBadDesc = s => {
                        const t = clean(s);
                        if (!t) return true;
                        if (t.length < 10) return true;
                        if (badDescRe.test(t)) return true;
                        return false;
                    };

                    const titleCandidates = [
                        stripTitle(meta('og:title')),
                        stripTitle(meta('twitter:title', 'name')),
                        ...Array.from(document.querySelectorAll('h1, h2, [role="heading"]')).map(textOf),
                        stripTitle(document.title)
                    ].filter(t => !isBadTitle(t));
                    const title = titleCandidates[0] || 'Senza titolo';

                    const priceRegex = /\b(?:CHF|EUR|€|\$|£)\s*\d[\d'.,\-]*/i;
                    const priceRegex2 = /\b\d[\d'.,\-]*\s*(?:CHF|EUR|€|\$|£)/i;
                    const badPriceContext = /(?:month|monthly|giorni|days|km|miles|followers|following|free|gratis|search|results|risultati|save|share|feedback|shipping|spedizione|consegna|delivery)/i;

                    const priceCandidates = [];
                    for (const el of Array.from(document.querySelectorAll('body *'))) {
                        if (!visible(el)) continue;

                        const st = window.getComputedStyle(el);
                        if (st.textDecoration.includes('line-through') || (st.textDecorationLine && st.textDecorationLine.includes('line-through'))) continue;

                        let directText = '';
                        for (const n of el.childNodes) {
                            if (n.nodeType === 3) directText += n.textContent + ' ';
                        }
                        directText = clean(directText);

                        const t = clean(el.innerText || el.textContent || '');
                        if (!t || t.length > 100) continue;
                        if (badPriceContext.test(t)) continue;

                        let m = directText.match(priceRegex) || directText.match(priceRegex2);
                        if (!m) m = t.match(priceRegex) || t.match(priceRegex2);

                        if (m) {
                            const r = el.getBoundingClientRect();
                            const fontSize = parseFloat(st.fontSize) || 16;
                            const fontScore = fontSize > 18 ? 3 : 0;

                            const score = (r.top < 1000 ? 3 : 0) + (r.top < 500 ? 2 : 0) + (r.width < 700 ? 2 : 0) + (t.length < 30 ? 2 : 0) + fontScore;
                            const numVal = parseFloat(clean(m[0]).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

                            priceCandidates.push({
                                text: clean(m[0]),
                                score,
                                numVal
                            });
                        }
                    }

                    priceCandidates.sort((a, b) => (b.score - a.score) || (a.numVal - b.numVal));
                    const price = priceCandidates[0]?.text || '';

                    function findDetailsRoot() {
                        const candidates = [...document.querySelectorAll('div, section, article')].filter(el => {
                            const t = clean(el.innerText || '');
                            return /\bDettagli\b/i.test(t) && /\bCondizione\b/i.test(t) && t.length > 80;
                        });
                        candidates.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
                        return candidates[0] || null;
                    }

                    function scoreDesc(t) {
                        let s = t.length;
                        if (/\n/.test(t)) s += 80;
                        if (/[.!?]/.test(t)) s += 40;
                        if (/\b(annuncio pubblicato|la posizione è approssimativa|l[’']ubicazione è approssimativa|marketplace|facebook|meta|save|share|messaggio|messaggi|filtri|filters)\b/i.test(t)) s -= 200;
                        return s;
                    }

                    function extractDescription() {
                        const root = findDetailsRoot();
                        const roots = root ? [root] : [document.body];
                        const candidates = [];
                        for (const r of roots) {
                            const els = [...r.querySelectorAll('span[dir="auto"], div[aria-hidden="false"], p, li, [role="text"]')];
                            for (const el of els) {
                                let t = textOf(el);
                                if (!t) continue;
                                if (t === title) continue;
                                if (/^Dettagli$/i.test(t)) continue;
                                if (/^Condizione$/i.test(t)) continue;
                                if (/^Usato - Come nuovo$/i.test(t)) continue;
                                if (/^Descrizione:$/i.test(t)) continue;
                                if (isBadDesc(t)) continue;
                                if (t.length < 25) continue;
                                t = t.replace(/^(?:Dettagli|Descrizione|Description)\s*/i, '').trim();
                                if (!t || isBadDesc(t)) continue;
                                candidates.push({
                                    t,
                                    score: scoreDesc(t)
                                });
                            }
                        }

                        candidates.sort((a, b) => b.score - a.score);
                        let desc = candidates[0]?.t || '';

                        if (!desc) {
                            const base = (root || document.body).innerText.replace(/\u00a0/g, '\n');
                            const lines = base.split('\n').map(clean).filter(Boolean);

                            const startMarkers = [/^Condizione$/i, /^Descrizione$/i, /^Description$/i, /^Dettagli$/i];
                            let start = lines.findIndex(l => /^Condizione$/i.test(l));
                            if (start >= 0) {
                                start += 2;
                            } else {
                                start = lines.findIndex(l => /^Descrizione$/i.test(l) || /^Description$/i.test(l));
                                if (start >= 0) start++;
                                else {
                                    start = lines.findIndex(l => /^Dettagli$/i.test(l));
                                    if (start >= 0) start++;
                                    else start = 0;
                                }
                            }

                            const stopRe = /^(?:Zürich,? ZH|Zurich,? ZH|La posizione è approssimativa|L[’']ubicazione è approssimativa|Annuncio pubblicato|Published|Posted|Dettagli|Condizione|Marketplace|Facebook|Meta)\b/i;
                            const out = [];
                            for (let i = start; i < lines.length; i++) {
                                const l = lines[i];
                                if (stopRe.test(l)) break;
                                if (l === title) continue;
                                if (/^Condizione$/i.test(l)) continue;
                                if (/^Usato - Come nuovo$/i.test(l)) continue;
                                if (isBadDesc(l)) continue;
                                if (priceRegex.test(l) || priceRegex2.test(l)) continue;
                                out.push(l);
                            }
                            desc = out.join('\n').trim();
                        }

                        desc = desc
                            .replace(/^(?:Dettagli|Descrizione|Description)\s*/i, '')
                            .replace(/^Condizione\s*\n[^\n]+\n*/i, '')
                            .trim();

                        return desc;
                    }

                    const desc = extractDescription();

                    const image =
                        meta('og:image') ||
                        meta('twitter:image', 'name') ||
                        [...document.images]
                            .map(img => ({
                                src: img.currentSrc || img.src || '',
                                area: (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0)
                            }))
                            .filter(x => x.src && x.area > 40000 && !/logo|icon|avatar|sprite|profile/i.test(x.src))
                            .sort((a, b) => b.area - a.area)[0]?.src || '';

                    const url = location.href.split('?')[0];

                    const htmlString = `
                <div style="font-family:Arial,sans-serif;line-height:1.4;margin-bottom:18px;">
                  <h3 style="margin:0 0 8px 0;">${esc(title)}</h3>
                  ${image ? `<img src="${esc(image)}" style="max-width:320px;height:auto;border-radius:8px;margin:0 0 10px 0;" />` : ''}
                  ${price ? `<p style="margin:0 0 6px 0;"><strong>Prezzo:</strong> ${esc(price)}</p>` : ''}
                  ${desc ? `<p style="margin:0 0 6px 0;"><strong>Descrizione:</strong><br>${esc(desc).replace(/\n/g, '<br>')}</p>` : ''}
                  <p style="margin:0;"><strong>Link:</strong> <a href="${esc(url)}">${esc(url)}</a></p>
                  <hr style="border:0;border-top:1px solid #ccc;margin-top:12px;" />
                </div>`;
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

        }, 3500);
    }

})();
