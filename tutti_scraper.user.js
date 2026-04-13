// ==UserScript==
// @name         Tutti.ch Multi-Page Auto-Scraper
// @namespace    http://violentmonkey.net/
// @version      1.1
// @description  Raccoglie link da più pagine e scarica i dettagli in HTML - Posizione Bottom-Right
// @match        https://www.tutti.ch/*/q/*
// @match        https://www.tutti.ch/*/vi/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const QUEUE_KEY = 'tuttiScrapeQueue';
    const RESULTS_KEY = 'tuttiScrapeResults';
    const TARGET_PAGE_KEY = 'tuttiTargetPage';
    const CURRENT_SCRAPE_STATE = 'tuttiState';

    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // --- UI PANEL ---
    function createPanel() {
        const panel = document.createElement('div');
        // MODIFICATO: bottom: 20px e right: 20px
        panel.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:10000; padding:15px; background:white; border:2px solid #ed2c28; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.2); display:flex; flex-direction:column; gap:10px; width:220px; font-family: sans-serif;";

        if (localStorage.getItem(CURRENT_SCRAPE_STATE) === 'extracting') {
            const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
            panel.innerHTML = `
                <b style="color:#ed2c28; font-size:14px;">Estrazione in corso...</b>
                <div id="scrapeStatus" style="font-size:13px;">Articoli rimanenti: <b>${queue.length}</b></div>
                <button id="stopSave" style="padding:8px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Ferma e Salva</button>
                <button id="cancelAll" style="padding:8px; background:#666; color:white; border:none; border-radius:4px; cursor:pointer; font-size:11px;">Annulla tutto</button>
            `;
            document.body.appendChild(panel);

            document.getElementById('stopSave').onclick = () => downloadResults();
            document.getElementById('cancelAll').onclick = () => {
                if (confirm("Vuoi davvero annullare lo scraping e cancellare i dati raccolti?")) {
                    localStorage.clear();
                    location.reload();
                }
            };
        } else {
            panel.innerHTML = `
                <b style="color:#ed2c28; font-size:16px;">Tutti.ch Scraper</b>
                <div style="font-size:12px; color:#555;">Scegli fino a che pagina raccogliere gli annunci:</div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <label style="font-size:13px;">Pagina max:</label>
                    <input type="number" id="targetPage" value="1" min="1" style="padding:5px; border:1px solid #ccc; width:60px; border-radius:4px;">
                </div>
                <button id="startScrape" style="padding:10px; background:#ed2c28; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; margin-top:5px;">Inizia Raccolta</button>
            `;
            document.body.appendChild(panel);

            document.getElementById('startScrape').onclick = () => {
                const target = parseInt(document.getElementById('targetPage').value);
                if (target < 1) return alert("Inserisci un numero di pagina valido");

                localStorage.setItem(TARGET_PAGE_KEY, target);
                localStorage.setItem(QUEUE_KEY, '[]');
                localStorage.setItem(RESULTS_KEY, '');
                localStorage.setItem(CURRENT_SCRAPE_STATE, 'collecting');
                startCollectingLinks();
            };
        }
    }

    // --- FASE 1: RACCOLTA LINK ---
    function startCollectingLinks() {
        const urlParams = new URLSearchParams(window.location.search);
        let currentPage = parseInt(urlParams.get('page')) || 1;
        const targetPage = parseInt(localStorage.getItem(TARGET_PAGE_KEY));

        // Estrae i link dalla griglia dei risultati
        const links = Array.from(document.querySelectorAll('a[href*="/vi/"]'))
            .map(a => a.href.split('?')[0]);
        const uniqueLinks = [...new Set(links)];

        let queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        queue = [...new Set([...queue, ...uniqueLinks])];
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

        if (currentPage < targetPage) {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('page', currentPage + 1);
            window.location.href = nextUrl.toString();
        } else {
            localStorage.setItem(CURRENT_SCRAPE_STATE, 'extracting');
            const finalQueue = JSON.parse(localStorage.getItem(QUEUE_KEY));
            if (finalQueue.length > 0) {
                window.location.href = finalQueue[0];
            } else {
                alert("Nessun annuncio trovato nelle pagine selezionate.");
                localStorage.clear();
            }
        }
    }

    // --- FASE 2: ESTRAZIONE DATI ---
    function extractDetails() {
        if (localStorage.getItem(CURRENT_SCRAPE_STATE) !== 'extracting') return;

        // Aspettiamo che la pagina sia renderizzata (React)
        setTimeout(() => {
            try {
                const title = document.querySelector('h1')?.innerText?.trim() || "Senza Titolo";
                const price = document.querySelector('h2.mui-style-1hzjccg')?.innerText?.trim() || "Prezzo non indicato";
                const descEl = document.querySelector('.mui-style-7loaky');
                const description = descEl ? descEl.innerText.trim() : "Nessuna descrizione";
                const imgEl = document.querySelector('meta[property="og:image"]');
                const image = imgEl ? imgEl.content : "";
                const url = window.location.href;

                const listingHtml = `
                    <div style="font-family:Arial, sans-serif; border-bottom:2px solid #ed2c28; padding:20px; margin-bottom:20px; max-width: 800px;">
                        <h2 style="margin-top:0;">${esc(title)}</h2>
                        ${image ? `<img src="${image}" style="max-width:400px; border-radius:8px; display:block; margin-bottom:15px;">` : ''}
                        <p style="font-size:18px; color:#ed2c28;"><b>Prezzo:</b> ${esc(price)}</p>
                        <p><b>Descrizione:</b><br><span style="white-space: pre-wrap;">${esc(description)}</span></p>
                        <p style="font-size:12px; color:#888;"><b>Fonte:</b> <a href="${url}">${url}</a></p>
                    </div>
                `;

                let results = localStorage.getItem(RESULTS_KEY) || '';
                results += listingHtml;
                localStorage.setItem(RESULTS_KEY, results);

                let queue = JSON.parse(localStorage.getItem(QUEUE_KEY));
                queue.shift();
                localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

                if (queue.length > 0) {
                    window.location.href = queue[0];
                } else {
                    downloadResults();
                }

            } catch (e) {
                console.error("Errore durante l'estrazione:", e);
                let queue = JSON.parse(localStorage.getItem(QUEUE_KEY));
                queue.shift();
                localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
                if (queue.length > 0) window.location.href = queue[0];
            }
        }, 3000); // 3 secondi per essere sicuri che tutti.ch carichi tutto
    }

    function downloadResults() {
        const results = localStorage.getItem(RESULTS_KEY);
        if (!results) {
            alert("Nessun dato raccolto.");
            localStorage.clear();
            return;
        }
        const finalHtml = `<html><head><meta charset="utf-8"><title>Export Tutti.ch</title><style>body{padding:40px; background:#f4f4f4;} div{background:white; box-shadow:0 2px 5px rgba(0,0,0,0.1);}</style></head><body>${results}</body></html>`;
        const blob = new Blob([finalHtml], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `tutti_export_${new Date().toISOString().slice(0, 10)}.html`;
        a.click();

        localStorage.clear();
        alert("Scraping terminato con successo!");
    }

    // --- INITIALIZER ---
    const currentUrl = window.location.href;

    // Mostra il pannello se siamo in una pagina di ricerca o annuncio
    if (currentUrl.includes('/q/') || currentUrl.includes('/vi/')) {
        // Delay minimo per evitare conflitti di caricamento
        setTimeout(createPanel, 500);
    }

    // Se lo stato è "raccolta", continua a raccogliere link
    if (currentUrl.includes('/q/') && localStorage.getItem(CURRENT_SCRAPE_STATE) === 'collecting') {
        startCollectingLinks();
    }

    // Se lo stato è "estrazione", estrai i dettagli
    if (currentUrl.includes('/vi/') && localStorage.getItem(CURRENT_SCRAPE_STATE) === 'extracting') {
        extractDetails();
    }

})();