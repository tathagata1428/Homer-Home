// ============================================================
// HOMER HOME — Chrome Extension App
// ============================================================

// Set this to your deployed Vercel URL for API endpoints (news, RSS, YouTube feeds)
// Example: "https://homer-home.vercel.app"
var API_BASE = "";

// ============================================================
// Shared Utilities
// ============================================================
function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ============================================================
// YouTube Player Shim (replaces youtube.com/iframe_api)
// Uses postMessage to control YouTube embeds without external JS
// ============================================================
function createYTPlayer(holderId, videoId, opts) {
  var holder = document.getElementById(holderId);
  if (!holder) return null;

  var iframe = document.createElement('iframe');
  iframe.width = String(opts.width || 0);
  iframe.height = String(opts.height || 0);
  iframe.style.border = 'none';
  iframe.allow = 'autoplay';

  var params = 'enablejsapi=1' +
    '&autoplay=' + (opts.playerVars && opts.playerVars.autoplay || 0) +
    '&loop=' + (opts.playerVars && opts.playerVars.loop || 0) +
    '&playlist=' + encodeURIComponent(videoId) +
    '&controls=0&modestbranding=1';

  iframe.src = 'https://www.youtube.com/embed/' + encodeURIComponent(videoId) + '?' + params;

  holder.parentNode.insertBefore(iframe, holder);
  holder.parentNode.removeChild(holder);

  var ready = false;
  var queue = [];

  function sendCmd(func, args) {
    if (!ready) { queue.push({ func: func, args: args || [] }); return; }
    try {
      iframe.contentWindow.postMessage(JSON.stringify({
        event: 'command', func: func, args: args || []
      }), '*');
    } catch (e) {}
  }

  var player = {
    playVideo: function () { sendCmd('playVideo'); },
    pauseVideo: function () { sendCmd('pauseVideo'); },
    setVolume: function (vol) { sendCmd('setVolume', [vol]); }
  };

  iframe.addEventListener('load', function () {
    setTimeout(function () {
      ready = true;
      queue.forEach(function (cmd) {
        try {
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command', func: cmd.func, args: cmd.args
          }), '*');
        } catch (e) {}
      });
      queue = [];
      if (opts.events && opts.events.onReady) {
        opts.events.onReady({ target: player });
      }
    }, 2000);
  });

  return player;
}

// ============================================================
// TradingView Widget Shim (replaces s3.tradingview.com/tv.js)
// Creates TradingView advanced chart via iframe embed
// ============================================================
function createTradingViewWidget(config) {
  var container = document.getElementById(config.container_id);
  if (!container) return;

  var widgetConfig = {
    autosize: true,
    symbol: config.symbol,
    interval: config.interval || 'D',
    timezone: config.timezone || 'Etc/UTC',
    theme: config.theme || 'dark',
    style: config.style || '1',
    locale: config.locale || 'en',
    enable_publishing: false,
    allow_symbol_change: config.allow_symbol_change !== false,
    backgroundColor: config.backgroundColor || 'rgba(15, 23, 42, 1)',
    gridColor: config.gridColor || 'rgba(255, 255, 255, 0.06)',
    hide_top_toolbar: !!config.hide_top_toolbar,
    hide_legend: !!config.hide_legend,
    hide_side_toolbar: !!config.hide_side_toolbar,
    save_image: false,
    studies: config.studies || []
  };

  var iframe = document.createElement('iframe');
  iframe.src = 'https://s.tradingview.com/embed-widget/advanced-chart/#' + JSON.stringify(widgetConfig);
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  iframe.setAttribute('allowtransparency', 'true');
  iframe.setAttribute('frameborder', '0');

  container.innerHTML = '';
  container.appendChild(iframe);
}

// ============================================================
// Password toggle handler (replaces inline onclick)
// ============================================================
document.addEventListener('click', function (e) {
  if (!e.target.classList.contains('pw-toggle')) return;
  var input = e.target.previousElementSibling;
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  e.target.textContent = input.type === 'password' ? '\u{1F441}' : '\u{1F441}\u200D\u{1F5E8}';
});

// === Script Block 1 ===

    /* 1. TABS */
    const tabBtns = [...document.querySelectorAll('.tab-btn')];
    const tabs = {
      home: document.getElementById('tab-home'),
      saved: document.getElementById('tab-saved'),
      pomodoro: document.getElementById('tab-pomodoro'),
      focuslab: document.getElementById('tab-focuslab'),
      investing: document.getElementById('tab-investing'),
      tools: document.getElementById('tab-tools'),
      links: document.getElementById('tab-links'),
      vault: document.getElementById('tab-vault'),
      news: document.getElementById('tab-news')
    };
    function showTab(name) {
      Object.entries(tabs).forEach(([k, el]) => {
        if(el) el.style.display = (k === name) ? 'block' : 'none';
      });
      tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
      
      // FIXED: Only initialize the chart AFTER the display is set to block
      if(name === 'investing') {
        setTimeout(initInvestingTab, 50);
      }
    }
    tabBtns.forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

    /* 2. CLOCK */
    function updateClock(){
      const now=new Date();
      const hh=now.getHours().toString().padStart(2,'0');
      const mm=now.getMinutes().toString().padStart(2,'0');
      const ss=now.getSeconds().toString().padStart(2,'0');
      const day=new Intl.DateTimeFormat(undefined,{weekday:'long'}).format(now);
      const date=new Intl.DateTimeFormat(undefined,{day:'2-digit',month:'long',year:'numeric'}).format(now);
      document.getElementById('clock-time').innerHTML=`${hh}:${mm}<small>${ss}</small>`;
      document.getElementById('clock-date').textContent=`${day}, ${date}`;

      const hVal = now.getHours();
      let greet = "Hello";
      if(hVal < 12) greet = "Good Morning";
      else if(hVal < 18) greet = "Good Afternoon";
      else greet = "Good Evening";
      const gEl = document.getElementById('greeting');
      if(gEl) gEl.textContent = greet;
    }
    updateClock(); setInterval(updateClock,1000);

    /* 3. WEATHER */
    const WX_CODES={0:["☀️","Clear sky"],1:["🌤️","Mainly clear"],2:["⛅","Partly cloudy"],3:["☁️","Overcast"],45:["🌫️","Fog"],48:["🌫️","Rime fog"],51:["🌦️","Light drizzle"],53:["🌦️","Drizzle"],55:["🌧️","Dense drizzle"],56:["🌧️","Freezing drizzle"],57:["🌧️","Freezing drizzle"],61:["🌦️","Light rain"],63:["🌧️","Rain"],65:["🌧️","Heavy rain"],66:["🌧️","Freezing rain"],67:["🌧️","Freezing rain"],71:["🌨️","Light snow"],73:["🌨️","Snow"],75:["❄️","Heavy snow"],77:["❄️","Snow grains"],80:["🌦️","Rain showers"],81:["🌧️","Rain showers"],82:["⛈️","Violent rain"],85:["🌨️","Snow showers"],86:["❄️","Heavy snow showers"],95:["⛈️","Thunderstorm"],96:["⛈️","Thunder + hail"],99:["⛈️","Severe thunder/hail"]};
    async function loadWeather(lat,lon,label){
      const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const res=await fetch(url,{cache:'no-store'}); const data=await res.json(); const cw=data.current_weather;
      const [icon,desc]=WX_CODES[cw.weathercode]||["⛅","Weather"];
      document.getElementById('wx-icon').textContent=icon;
      document.getElementById('wx-place').textContent=label||"Your location";
      document.getElementById('wx-desc').textContent=`${desc} • Wind ${Math.round(cw.windspeed)} km/h`;
      document.getElementById('wx-temp').textContent=`${Math.round(cw.temperature)}°`;
    }
    function detectWeather(){
      const fallback={lat:44.4268,lon:26.1025,label:"Bucharest"};
      if(!('geolocation'in navigator)) return loadWeather(fallback.lat,fallback.lon,fallback.label);
      navigator.geolocation.getCurrentPosition(
        pos=>loadWeather(pos.coords.latitude,pos.coords.longitude,"Your location"),
        _=>loadWeather(fallback.lat,fallback.lon,fallback.label),
        {enableHighAccuracy:false,timeout:8000,maximumAge:600000}
      );
    }
    detectWeather();

    /* 4. QUOTES (Hybrid Static Logic) */
    const AUTO_MS = 900_000; // 15 min
    const QUOTES_CACHE_KEY = 'homer-quotes-cache';
    const SEEN_KEY = 'homer-quotes-seen';
    const SEEN_MAX = 2; // reset seen list after this many

    const QUOTE_SOURCES = [
      "https://raw.githubusercontent.com/dwyl/quotes/main/quotes.json",
      "https://raw.githubusercontent.com/JamesFT/Database-Quotes-JSON/master/quotes.json"
    ];

    let globalQuotes = null;

    const BACKUP_MOTIVATION = [
      {t:"The impediment to action advances action. What stands in the way becomes the way.", a:"Marcus Aurelius"},
      {t:"We suffer more often in imagination than in reality.", a:"Seneca"},
      {t:"Waste no more time arguing about what a good man should be. Be one.", a:"Marcus Aurelius"},
      {t:"It is not that we have a short time to live, but that we waste a great deal of it.", a:"Seneca"},
      {t:"The happiness of your life depends upon the quality of your thoughts.", a:"Marcus Aurelius"},
      {t:"No man is free who is not master of himself.", a:"Epictetus"},
      {t:"Man is not worried by real problems so much as by his imagined anxieties about real problems.", a:"Epictetus"},
      {t:"Success is not final, failure is not fatal: it is the courage to continue that counts.", a:"Winston Churchill"},
      {t:"Life is simple. Are you happy? Yes? Keep going. No? Change something.", a:"Bogdan Radu"},
      {t:"The only way to do great work is to love what you do.", a:"Steve Jobs"},
      {t:"In the middle of difficulty lies opportunity.", a:"Albert Einstein"},
      {t:"He who has a why to live can bear almost any how.", a:"Friedrich Nietzsche"},
      {t:"The best time to plant a tree was 20 years ago. The second best time is now.", a:"Chinese Proverb"},
      {t:"What we do in life echoes in eternity.", a:"Marcus Aurelius"},
      {t:"Luck is what happens when preparation meets opportunity.", a:"Seneca"},
      {t:"First say to yourself what you would be; and then do what you have to do.", a:"Epictetus"},
      {t:"The mind is everything. What you think you become.", a:"Buddha"},
      {t:"Do not go where the path may lead, go instead where there is no path and leave a trail.", a:"Ralph Waldo Emerson"},
      {t:"It does not matter how slowly you go as long as you do not stop.", a:"Confucius"},
      {t:"Everything has beauty, but not everyone sees it.", a:"Confucius"}
    ];
    const BACKUP_HUMOR = [
      {content: "I am so clever that sometimes I don't understand a single word of what I am saying.", author: "Oscar Wilde"},
      {content: "Behind every great man is a woman rolling her eyes.", author: "Jim Carrey"}
    ];

    const els = {
      quote:document.getElementById("quote"),
      author:document.getElementById("author"),
      byline:document.getElementById("byline"),
      status:document.getElementById("status"),
      refresh:document.getElementById("refresh"),
      save:document.getElementById("save"),
      copy:document.getElementById("copy"),
      countdown:document.getElementById("countdown"),
      countdownText:document.getElementById("countdown-text"),
      savedList:document.getElementById("savedList"),
      savedEmpty:document.getElementById("savedEmpty"),
      exportSaved:document.getElementById("exportSaved"),
      clearSaved:document.getElementById("clearSaved"),
    };

    function setLoading(show){ els.status.style.display=show?"block":"none"; els.quote.style.display=show?"none":"block"; els.byline.style.display=show?"none":"block"; }
    function fadeIn(){ els.quote.classList.remove('fade-in'); els.byline.classList.remove('fade-in'); void els.quote.offsetWidth; els.quote.classList.add('fade-in'); els.byline.classList.add('fade-in'); }
    // --- Seen tracking (no repeats) ---
    function getSeenSet(){
      try{ return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)||'[]')); }catch(e){ return new Set(); }
    }
    function markSeen(hash){
      var seen = getSeenSet();
      seen.add(hash);
      if(seen.size > SEEN_MAX) seen = new Set([...seen].slice(-Math.floor(SEEN_MAX/2)));
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    }
    function quoteHash(txt){ return txt.trim().toLowerCase().replace(/\s+/g,' ').slice(0,80); }

    function pickUnseen(pool){
      var seen = getSeenSet();
      var unseen = pool.filter(function(q){
        var txt = q.t || q.content || q.quoteText || '';
        return !seen.has(quoteHash(txt));
      });
      var pick = unseen.length > 0 ? unseen : pool; // reset if all seen
      if(unseen.length === 0){
        localStorage.removeItem(SEEN_KEY); // clear seen list
      }
      var chosen = pick[Math.floor(Math.random() * pick.length)];
      var chosenTxt = chosen.t || chosen.content || chosen.quoteText || '';
      markSeen(quoteHash(chosenTxt));
      return chosen;
    }

function renderQuote(q) {
  let txt = q.t || q.content || q.quoteText || "Stay motivated.";
  const ath = q.a || q.author || q.quoteAuthor || "Unknown";

  txt = txt.replace(/[\uFFFD\u00E2\u0080\u0099]/g, "'")
           .replace(/[\u00E2\u0080\u009C\u00E2\u0080\u009D]/g, '"')
           .replace(/&quot;/g, '"')
           .replace(/&apos;/g, "'");

  els.quote.textContent = txt;
  els.author.textContent = ath;
  setLoading(false);
  fadeIn();
  resetCountdown();
}

    const API_HUMOR = "https://official-joke-api.appspot.com/random_joke";

    // Normalize quotes from different source formats into {t, a}
    function normalizeQuotes(arr, sourceIdx){
      return arr.map(function(q){
        if(sourceIdx === 0){
          // dwyl/quotes format: {text, author}
          return {t: q.text || q.content || '', a: q.author || 'Unknown'};
        } else {
          // JamesFT format: {quoteText, quoteAuthor}
          return {t: q.quoteText || '', a: q.quoteAuthor || 'Unknown'};
        }
      }).filter(function(q){ return q.t.length > 10 && q.t.length < 300; });
    }

    async function loadQuoteDB(){
      // No long-term cache — always fetch fresh quotes

      // Fetch from sources
      for(var i=0; i<QUOTE_SOURCES.length; i++){
        try{
          var r = await fetch(QUOTE_SOURCES[i]);
          var text = await r.text();
          if(text.trim().startsWith("<")) continue;
          var raw = JSON.parse(text);
          var normalized = normalizeQuotes(raw, i);
          if(normalized.length > 50){
            globalQuotes = normalized;
            // no cache — fresh fetch each session
            return;
          }
        }catch(e){ continue; }
      }

      // Fallback to backups
      globalQuotes = BACKUP_MOTIVATION;
    }

    async function fetchMotivation() {
      try {
        if (!globalQuotes) await loadQuoteDB();
        return pickUnseen(globalQuotes);
      } catch (e) {
        return pickUnseen(BACKUP_MOTIVATION);
      }
    }

    async function fetchHumor() {
      try {
        const r = await fetch(API_HUMOR);
        if (!r.ok) throw new Error("Humor API Failed");
        const data = await r.json();
        if(data.setup && data.punchline) return { content: `${data.setup} ... ${data.punchline}`, author: "Daily Joke" };
        throw new Error("Invalid");
      } catch (e) {
        return BACKUP_HUMOR[Math.floor(Math.random() * BACKUP_HUMOR.length)];
      }
    }

    els.refresh.addEventListener("click", async () => {
      setLoading(true);
      const statusText = document.querySelector("#status");
      if(statusText) statusText.innerHTML = '<span class="spinner"></span>Accessing library...';
      const q = await fetchMotivation();
      renderQuote(q);
    });

    const btnHumor = document.getElementById("btn-humor");
    if(btnHumor) {
      btnHumor.addEventListener("click", async () => {
        setLoading(true);
        const statusText = document.querySelector("#status");
        if(statusText) statusText.innerHTML = '<span class="spinner"></span>Fetching a laugh…';
        const q = await fetchHumor();
        renderQuote(q);
      });
    }

    let deadline = Date.now()+AUTO_MS, cdTimer=null;
    function resetCountdown(){ deadline = Date.now()+AUTO_MS; tickCountdown(); }
    function tickCountdown(){
      if(cdTimer) clearTimeout(cdTimer);
      const now=Date.now();
      let rem=Math.max(0, deadline-now);
      const mins=Math.floor(rem/60000);
      const secs=Math.floor((rem%60000)/1000);
      els.countdownText.textContent = mins>0 ? `${mins}m` : `${secs}s`;
      const pct = 100 - Math.round((rem/AUTO_MS)*100);
      els.countdown.style.setProperty('--progress', pct + '%');
      if(rem<=0){ els.refresh.click(); } else{ cdTimer=setTimeout(tickCountdown, 1000); }
    }

    els.copy.addEventListener("click",()=>{
      const txt=`"${els.quote.textContent}" — ${els.author.textContent}`;
      navigator.clipboard.writeText(txt);
      const p=els.copy.textContent; els.copy.textContent="Copied!"; setTimeout(()=>els.copy.textContent=p,1500);
    });

    const SAVED_KEY="motivator.savedQuotes.v1";
    function loadSaved(){ try{ return JSON.parse(localStorage.getItem(SAVED_KEY)||"[]"); }catch{return [];} }
    function saveSaved(list){ localStorage.setItem(SAVED_KEY,JSON.stringify(list)); }
    function addCurrentToSaved(){
      const q=els.quote.textContent.trim(), a=els.author.textContent.trim(); if(!q) return;
      const list=loadSaved();
      if(!list.some(it=>it.q===q && it.a===a)){
        list.unshift({q,a,ts:Date.now()}); saveSaved(list); renderSaved();
        const prev=els.save.textContent; els.save.textContent="Saved ✓"; setTimeout(()=>els.save.textContent=prev,1100);
      }
    }
    function deleteSaved(idx){ const list=loadSaved(); list.splice(idx,1); saveSaved(list); renderSaved(); }
    function clearAllSaved(){ saveSaved([]); renderSaved(); }
    function renderSaved(){
      const list=loadSaved(); const empty=(list.length===0);
      els.savedList.innerHTML=""; els.savedEmpty.style.display=empty?"block":"none";
      list.forEach((it,idx)=>{
        const wrap=document.createElement('div'); wrap.className="saved-item";
        wrap.innerHTML=`<div><strong>“${it.q}”</strong></div>
          <div class="saved-meta"><span>— ${it.a||"Unknown"}</span><span>${new Date(it.ts).toLocaleString()}</span></div>
          <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="copy" data-i="${idx}">Copy</button><button class="btn" data-act="del" data-i="${idx}">Delete</button></div>`;
        els.savedList.appendChild(wrap);
      });
    }
   els.savedList?.addEventListener('click', e => {
      const btn = e.target.closest('button'); 
      if(!btn) return;
      
      const idx = +btn.dataset.i; 
      
      // Handle Delete
      if(btn.dataset.act === 'del') { 
        deleteSaved(idx); 
      }
      
      // Handle Copy
      if(btn.dataset.act === 'copy') { 
        const list = loadSaved(); 
        const textToCopy = `“${list[idx].q}” — ${list[idx].a || "Unknown"}`;
        
        // 1. Try modern clipboard API (using .then instead of async/await to preserve user gesture)
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showCopiedFeedback(btn);
            }).catch(() => {
                fallbackCopy(textToCopy, btn);
            });
        } else {
            fallbackCopy(textToCopy, btn);
        }
      }
    });

    // Helper for visual feedback
    function showCopiedFeedback(btn) {
        const originalText = btn.textContent;
        btn.textContent = "Copied ✓";
        btn.style.color = "var(--accent)"; // Green text
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.color = "";
        }, 1500);
    }

    // Helper for old-school fallback copy
    function fallbackCopy(text, btn) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; // Avoid scrolling to bottom
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showCopiedFeedback(btn);
        } catch (err) {
            console.error("Fallback copy failed", err);
        }
        document.body.removeChild(textArea);
    }
    els.exportSaved?.addEventListener('click',()=>{
      const list=loadSaved(); const text=list.map(it=>`“${it.q}” — ${it.a||"Unknown"}`).join("\n\n");
      const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download='saved-quotes.txt'; a.click(); URL.revokeObjectURL(url);
    });
    els.clearSaved?.addEventListener('click',clearAllSaved); els.save.addEventListener("click",addCurrentToSaved);
    els.refresh.click(); renderSaved();

    /* 5. FOCUS LAB LOGIC */
    
    // Focus Dot (Trataka) Logic - FIXED
    const btnFocusDot = document.getElementById("btn-focus-dot");
    const focusOverlay = document.getElementById("focus-overlay");
    
    if(btnFocusDot && focusOverlay) {
      btnFocusDot.addEventListener("click", () => {
        focusOverlay.style.display = "grid";
        // Try fullscreen
        if(document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(e => console.log(e));
        }
      });
      
      focusOverlay.addEventListener("click", () => {
        focusOverlay.style.display = "none";
        // Exit fullscreen
        if(document.exitFullscreen) {
            document.exitFullscreen().catch(e => console.log(e));
        }
      });
    }

    // Zen Mode Logic - FIXED
    const zenBtn = document.getElementById("zen-btn");
    const zenExit = document.getElementById("zen-exit");
    const zenOverlay = document.getElementById("zen-overlay");
    const zenInput = document.getElementById("zen-input");
    const zenText = document.getElementById("zen-text");

    if(zenBtn && zenOverlay) {
        zenBtn.addEventListener("click", () => {
            const goal = zenInput.value.trim() || "FOCUS";
            zenText.textContent = goal;
            
            // Add class to body to hide everything else via CSS
            document.body.classList.add("zen-active");
            
            // Show overlay
            zenOverlay.style.display = "flex";
            
            // Fullscreen
            if(document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(e => console.log(e));
            }
        });

        zenExit.addEventListener("click", () => {
            // Remove class to restore everything
            document.body.classList.remove("zen-active");
            
            // Hide overlay
            zenOverlay.style.display = "none";
            
            // Exit fullscreen
            if(document.exitFullscreen) {
                document.exitFullscreen().catch(e => console.log(e));
            }
        });
    }

    // Brain Dump
    const txtDump = document.getElementById("brain-dump");
    const dumpStatus = document.getElementById("dump-status");
    if(txtDump) {
        txtDump.value = localStorage.getItem("homer-brain-dump") || "";
        txtDump.addEventListener("input", () => {
            localStorage.setItem("homer-brain-dump", txtDump.value);
            dumpStatus.textContent = "Saving...";
            setTimeout(() => dumpStatus.textContent = "Saved", 1000);
        });
    }
    // Box Breathing
    const btnBox = document.getElementById("b-toggle");
    const boxCircle = document.getElementById("b-circle");
    let bInterval = null, bStep = 0;
    if(btnBox && boxCircle) {
        btnBox.addEventListener("click", () => {
            if(bInterval) {
                clearInterval(bInterval); bInterval = null;
                btnBox.textContent = "Start Breathing";
                boxCircle.className = "breathing-circle";
                boxCircle.textContent = "Ready";
            } else {
                btnBox.textContent = "Stop";
                bStep = 0;
                const cycle = () => {
                    boxCircle.className = "breathing-circle";
                    if(bStep===0) { boxCircle.classList.add('b-inhale'); boxCircle.textContent="Inhale"; }
                    if(bStep===1) { boxCircle.classList.add('b-hold'); boxCircle.textContent="Hold"; }
                    if(bStep===2) { boxCircle.classList.add('b-exhale'); boxCircle.textContent="Exhale"; }
                    if(bStep===3) { boxCircle.classList.add('b-hold'); boxCircle.textContent="Hold"; }
                    bStep = (bStep + 1) % 4;
                };
                cycle();
                bInterval = setInterval(cycle, 4000);
            }
        });
    }

// === Script Block 2 ===

    document.addEventListener('DOMContentLoaded', function(){
      const PKEY='pom.settings.v1', TKEY='pom.tasks.v1', SKEY='pom.state.v1';
      const elTime=document.getElementById('pom-time');
      const elRing=document.getElementById('pom-ring');
      const elMode=document.getElementById('pom-mode');
      const elCount=document.getElementById('pom-count');
      const elCycle=document.getElementById('pom-cycle');
      const elNotify=document.getElementById('pom-notify');
      const elVoice=document.getElementById('pom-voice');
      const elSfx=document.getElementById('pom-sfx');
      const elSetFocus=document.getElementById('set-focus');
      const elSetShort=document.getElementById('set-short');
      const elSetLong=document.getElementById('set-long');

      const btnStart=document.getElementById('pom-start');
      const btnPause=document.getElementById('pom-pause');
      const btnReset=document.getElementById('pom-reset');
      const btnSkip=document.getElementById('pom-skip');

      function loadJSON(k,def){ try{ return JSON.parse(localStorage.getItem(k)||JSON.stringify(def)); }catch{return def;} }
      function saveJSON(k,v){ localStorage.setItem(k,JSON.stringify(v)); }

      const settings=loadJSON(PKEY,{focus:25, short:5, long:15, longEvery:4});
      const state=loadJSON(SKEY,{mode:'focus', remaining:settings.focus*60, running:false, pomodoros:0});
      elSetFocus.value=settings.focus; elSetShort.value=settings.short; elSetLong.value=settings.long;
      elMode.textContent=cap(state.mode); updateTime(); updateRing(); updateMeta();

      function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
      function durFor(mode){ return (mode==='focus'?settings.focus:mode==='short'?settings.short:settings.long)*60; }
      function setMode(next){ state.mode=next; state.remaining=durFor(next); elMode.textContent=cap(next); updateTime(); updateRing(); save(); }
      function updateTime(){ const m=Math.floor(state.remaining/60).toString().padStart(2,'0'); const s=Math.floor(state.remaining%60).toString().padStart(2,'0'); elTime.textContent=`${m}:${s}`; }
      function updateRing(){ const total=durFor(state.mode); const progress=1-(state.remaining/total); const deg=Math.max(0,Math.min(360,progress*360)); elRing.style.setProperty('--pom-progress',`${deg}deg`); }
      // FIX: Cycle math correctly computes "1/4" when pomodoros is 0
      function updateMeta(){ elCount.textContent=state.pomodoros; elCycle.textContent=(state.pomodoros % settings.longEvery) + 1; }
      function save(){ saveJSON(SKEY,state); }

      let ac;
      function ensureAC(){ if(!ac){ ac = new (window.AudioContext||window.webkitAudioContext)(); } if(ac.state==='suspended'){ ac.resume(); } }
      function speak(text){ if(!elVoice?.checked) return; if(!('speechSynthesis' in window)) return; const u=new SpeechSynthesisUtterance(text); u.rate=1.05; u.pitch=text.includes('Woo')?1.3:0.8; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); }
      function tone(freq,dur,type='triangle',vol=0.22,when=0){ if(!elSfx?.checked) return; ensureAC(); const t=ac.currentTime+when; const o=ac.createOscillator(); const g=ac.createGain(); o.type=type; o.frequency.setValueAtTime(freq,t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); o.connect(g).connect(ac.destination); o.start(t); o.stop(t+dur+0.02); }
      function sfxWooHoo(){ speak("Woo-hoo!"); tone(880,0.12,'triangle',0.25,0); tone(1046.5,0.12,'triangle',0.22,0.10); tone(1318.5,0.18,'triangle',0.22,0.22); }
      function sfxDoh(){ speak("D’oh!"); tone(196,0.18,'sawtooth',0.25,0); tone(147,0.18,'sawtooth',0.20,0.10); }

      ['click','keydown','touchstart'].forEach(evt=>{
        window.addEventListener(evt,()=>{ try{ ensureAC(); if('speechSynthesis' in window) speechSynthesis.resume(); }catch(_){ } },{once:true, passive:true});
      });

      let tick=null;
      function start(){ 
          if(tick) return; // FIX: Check interval engine instead of text state
          state.running=true; 
          save(); 
          if(elNotify?.checked && 'Notification' in window && Notification.permission!=='granted'){ Notification.requestPermission(); } 
          ensureAC(); 
          tick=setInterval(()=>{ 
              state.remaining--; 
              if(state.remaining<=0){ advance(false); } 
              updateTime(); updateRing(); save(); 
              window.dispatchEvent(new Event('pom-tick')); 
          },1000); 
      }
      function pause(){ 
          state.running=false; 
          clearInterval(tick); 
          tick=null; // FIX: Destroy engine on pause
          save(); 
          window.dispatchEvent(new Event('pom-tick')); 
      }
      function skip(){ pause(); advance(true); } 
      function reset(){ 
          pause(); 
          state.pomodoros = 0; 
          setMode('focus'); 
          updateMeta(); 
          updateTime(); 
          updateRing(); 
          save();
          window.dispatchEvent(new Event('pom-tick'));
      }

      function advance(isSkip = false){
        if(state.mode==='focus'){
          state.pomodoros++;
          const n=state.pomodoros % settings.longEvery;
          setMode(n===0?'long':'short');
          
          if(!isSkip) {
            notify('Break time', n===0?`Long break (${settings.long}m)`:`Short break (${settings.short}m)`);
            sfxWooHoo();
          }
        }else{
          setMode('focus');
          if(!isSkip) {
            notify('Focus time', `${settings.focus} minutes — go!`);
            sfxDoh();
          }
        }
        updateMeta(); save(); if(state.running) start();
      }
      function notify(title,body){
        if(!elNotify?.checked) return;
        if('Notification' in window && Notification.permission==='granted'){
          const n=new Notification(title,{body}); setTimeout(()=>n.close(),4000);
        }
      }

      // Safe JS Event listeners that rely on CSS for the visual pop
      btnStart.addEventListener('click',start);
      btnPause.addEventListener('click',pause);
      btnReset.addEventListener('click',reset);
      btnSkip.addEventListener('click',skip);

      [elSetFocus, elSetShort, elSetLong].forEach(inp=>{
        inp.addEventListener('change',()=>{
          settings.focus=Math.max(1,parseInt(elSetFocus.value||25));
          settings.short=Math.max(1,parseInt(elSetShort.value||5));
          settings.long=Math.max(1,parseInt(elSetLong.value||15));
          saveJSON(PKEY,settings);
          if(!state.running){ state.remaining=durFor(state.mode); updateTime(); updateRing(); save(); }
        });
      });

      /* Tasks */
      const taskInput=document.getElementById('task-input');
      const taskAdd=document.getElementById('task-add');
      const taskList=document.getElementById('task-list');
      function loadTasks(){ return loadJSON(TKEY,[]); }
      function saveTasks(list){ saveJSON(TKEY,list); }
      function renderTasks(){
        const list=loadTasks();
        taskList.innerHTML='';
        list.forEach((t,i)=>{
          const li=document.createElement('li');
          li.className = t.done?'done':'';
          li.innerHTML= `<input type="checkbox" data-i="${i}" ${t.done?'checked':''}>
            <span style="flex:1">${t.text}</span>
            <button class="btn ghost" data-act="del" data-i="${i}">Delete</button>`;
          taskList.appendChild(li);
        });
        window.dispatchEvent(new Event('tasks-changed'));
      }
      function addTask(){
        const text=taskInput.value.trim(); if(!text) return;
        const list=loadTasks(); list.unshift({text,done:false,ts:Date.now()});
        saveTasks(list); taskInput.value=''; renderTasks();
      }
      taskAdd.addEventListener('click',addTask);
      taskInput.addEventListener('keydown',e=>{ if(e.key==='Enter') addTask(); });
      taskList.addEventListener('click',e=>{
        const i=e.target.dataset.i; if(i==null) return;
        const list=loadTasks();
        if(e.target.matches('input[type="checkbox"]')){ list[i].done=e.target.checked; list[i].ts=Date.now(); }
        if(e.target.dataset.act==='del'){ list.splice(i,1); }
        saveTasks(list); renderTasks();
      });

      if(state.running){ start(); }
      renderTasks();
    });

// === Script Block 3 ===

    function fmtMMSS(totalSeconds){ const s=Math.max(0,Math.floor(totalSeconds)); const m=Math.floor(s/60).toString().padStart(2,'0'); const ss=(s%60).toString().padStart(2,'0'); return `${m}:${ss}`; }
    const LS='pom.state.v1', LS_SETTINGS='pom.settings.v1', LS_TASKS='pom.tasks.v1';
    function ls(k,def){ try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(def));}catch{return def;} }
    function getOpenTasks(){ const tasks=ls(LS_TASKS,[]); return tasks.filter(t=>!t.done); }
    function getDoneTop3(){ const tasks=ls(LS_TASKS,[]); return tasks.filter(t=>t.done).sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,3); }

    function renderHomeFromPom(){
      const state=ls(LS, null);
      const settings=ls(LS_SETTINGS,{focus:25, short:5, long:15});
      const openTasks=getOpenTasks();
      const done=getDoneTop3();

      const tasksCard=document.getElementById('home-tasks-card');
      const tasksWrap=document.getElementById('home-tasks');
      const tasksEmpty=document.getElementById('home-tasks-empty');
      const doneCard=document.getElementById('home-done-card');
      const doneList=document.getElementById('home-done-list');

      tasksWrap.innerHTML='';
      if(openTasks.length===0){
        tasksCard.style.display='block'; tasksEmpty.style.display='block';
      }else{
        tasksCard.style.display='block'; tasksEmpty.style.display='none';
        
        // FIX: Calculate total seconds correctly based on the current mode (Focus vs Break)
        const mode = state ? state.mode : 'focus';
        const isFocus = mode === 'focus';
        const isRunning = state && state.running;
        
        let totalSeconds = (settings.focus || 25) * 60;
        if (mode === 'short') totalSeconds = (settings.short || 5) * 60;
        if (mode === 'long') totalSeconds = (settings.long || 15) * 60;

        const remaining = Math.max(0, (state && state.remaining != null ? state.remaining : totalSeconds));
        const progressDeg = 360 * (1 - (remaining / totalSeconds));

        openTasks.forEach((t,i)=>{
          const card=document.createElement('div'); card.className='htask-card htask';
          const circle=document.createElement('div'); circle.className='mini-circle';
          const leftSpan=document.createElement('span');
          
          /* SMART CLOCK LOGIC: Show time if running (Focus OR Break) */
          let displayContent = '▶'; 
          
          if (isRunning) {
             if (isFocus) {
                 displayContent = fmtMMSS(remaining);
             } else {
                 // Break mode running: Mug + Timer perfectly centered in the circle
                 displayContent = `<div style="display:flex; flex-direction:column; align-items:center; line-height:1.1; margin-top:-2px"><span style="font-size:0.75em;">☕</span><span style="font-size:0.85em;">${fmtMMSS(remaining)}</span></div>`;
             }
          } else {
             displayContent = isFocus ? '▶' : '☕'; 
          }

          // Apply to first task only
          if (i === 0) {
              leftSpan.innerHTML = displayContent;
          } else {
              leftSpan.textContent = (i + 1);
          }
          
          circle.appendChild(leftSpan);
          // Show progress bar if running (works for focus and breaks now)
          circle.style.setProperty('--prog',(i===0 && isRunning) ? `${progressDeg}deg` : '0deg');
          
          const meta=document.createElement('div'); meta.className='meta';
          const name=document.createElement('div'); name.className='name'; name.textContent=t.text;
          const sub=document.createElement('div'); sub.className='sub';
          
          // Subtitle Logic
          if(i===0) {
             if(isFocus) {
                sub.textContent = isRunning ? 'Focusing...' : 'Ready to Start';
             } else {
                sub.textContent = isRunning ? 'On Break ☕' : 'Break Paused ☕';
             }
          } else {
             sub.textContent = 'Queued';
          }

          meta.appendChild(name); meta.appendChild(sub);
          card.appendChild(circle); card.appendChild(meta);
          tasksWrap.appendChild(card);
        });
      }

      doneList.innerHTML='';
      if(done.length===0) doneCard.style.display='none';
      else{
        doneCard.style.display='block';
        done.forEach(t=>{ const row=document.createElement('div'); row.className='done-item'; row.innerHTML=`<span>${t.text}</span><span class="pill">${new Date(t.ts||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>`; doneList.appendChild(row); });
      }
    }

    renderHomeFromPom();
    setInterval(renderHomeFromPom,1000);
    window.addEventListener('pom-tick',renderHomeFromPom);
    window.addEventListener('tasks-changed',renderHomeFromPom);

// Block 4 (Service Worker) — removed for Chrome Extension

// === Script Block 5 ===

// 🔵 AUDIO PLAYER WITH BULLETPROOF STATE TRACKING
const tracks = {
  ocean: { id:"WHPEKLQID4U", btn:"btn-ocean", vol:"vol-ocean", labelPlay:"▶️ Play Ocean", labelPause:"⏸️ Pause Ocean", holder:"yt-ocean", isPlaying: false },
  fire:  { id:"UgHKb_7884o", btn:"btn-fire",  vol:"vol-fire",  labelPlay:"▶️ Play Fireplace", labelPause:"⏸️ Pause Fireplace", holder:"yt-fire", isPlaying: false },
  rain:  { id:"mPZkdNFkNps", btn:"btn-rain",  vol:"vol-rain",  labelPlay:"▶️ Play Rain", labelPause:"⏸️ Pause Rain", holder:"yt-rain", isPlaying: false },
  rainywindow: { id:"Dx5qFachd3A", btn:"btn-rainywindow", vol:"vol-rainywindow", labelPlay:"▶️ Play Jazz", labelPause:"⏸️ Pause Jazz", holder:"yt-rainywindow", isPlaying: false },
  cafe:  { id:"uiMXGIG_DQo", btn:"btn-cafe",  vol:"vol-cafe",  labelPlay:"▶️ Play Café", labelPause:"⏸️ Pause Café", holder:"yt-cafe", isPlaying: false },
  lofi:  { id:"Na0w3Mz46GA", btn:"btn-lofi",  vol:"vol-lofi",  labelPlay:"▶️ Play Lo-Fi", labelPause:"⏸️ Pause Lo-Fi", holder:"yt-lofi", isPlaying: false },
  wind: { id:"jYu1-CxNqks", btn:"btn-wind", vol:"vol-wind", labelPlay:"▶️ Play Wind", labelPause:"⏸️ Pause Wind", holder:"yt-wind", isPlaying: false },
  synthwave: { id:"4xDzrJKXOOY", btn:"btn-synthwave", vol:"vol-synthwave", labelPlay:"▶️ Play Synthwave", labelPause:"⏸️ Pause Synthwave", holder:"yt-synthwave", isPlaying: false },
  weightless: { id:"vYIYIVmOo3Q", btn:null, vol:null, holder:"yt-weightless", isPlaying: false } 
};

function createPlayer(k) {
  const t = tracks[k];
  if(t.player) return;
  t.player = createYTPlayer(t.holder, t.id, {
    height: "0", width: "0",
    playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: t.id, modestbranding: 1 },
    events: {
      onReady: e => {
        const volEl = t.vol ? document.getElementById(t.vol) : null;
        if(volEl) e.target.setVolume(+volEl.value);
        // FIX: If the user toggled it off before it even finished loading, pause it immediately
        if(!t.isPlaying) {
            e.target.pauseVideo();
        }
      }
    }
  });
}

function togglePlay(k) {
  const t = tracks[k];
  const btn = document.getElementById(t.btn);
  
  if (!t.player) {
    createPlayer(k);
    t.isPlaying = true;
    if(btn) btn.textContent = t.labelPause;
    return;
  }
  
  // FIX: Rely on our strict internal state, not YouTube's delayed API state
  if (t.isPlaying) {
    t.player.pauseVideo();
    t.isPlaying = false;
    if(btn) btn.textContent = t.labelPlay;
  } else {
    t.player.playVideo();
    t.isPlaying = true;
    if(btn) btn.textContent = t.labelPause;
  }
}

function setVolume(k, v) {
  const t = tracks[k];
  if (t.player && typeof t.player.setVolume === "function") t.player.setVolume(v);
}

function stopAll() {
  Object.keys(tracks).forEach(k => {
    const t = tracks[k];
    t.isPlaying = false;
    if (t.player && typeof t.player.pauseVideo === 'function') t.player.pauseVideo();
    if (t.btn) {
        const btnEl = document.getElementById(t.btn);
        if(btnEl) btnEl.textContent = t.labelPlay;
    }
  });
}

function playMix(list) {
  stopAll();
  list.forEach(item => {
    const t = tracks[item.k];
    t.isPlaying = true;
    
    // Visually update the UI Slider to match the mix
    const volEl = document.getElementById(t.vol);
    if(volEl) volEl.value = item.vol;
    
    // Visually update the UI Button to show it is playing
    const btnEl = document.getElementById(t.btn);
    if(btnEl) btnEl.textContent = t.labelPause;

    if(!t.player) {
        createPlayer(item.k);
    } else {
        setTimeout(() => {
            if(typeof t.player.setVolume === 'function') {
                t.player.setVolume(item.vol);
                t.player.playVideo();
            }
        }, 100);
    }
  });
}

document.addEventListener("click", e => {
  const id = e.target.id;
  if (id === "stop-all") stopAll();
  if (id === "mix-sleep") playMix([{k:'fire',vol:40}, {k:'rain',vol:60}]);
  if (id === "mix-rainy") playMix([{k:'rain',vol:70}, {k:'ocean',vol:40}]);
  if (id === "mix-reading") playMix([{k:'lofi',vol:50}, {k:'fire',vol:10}, {k:'wind',vol:10}, {k:'rain',vol:10}]);
  if (id === "mix-cozy") playMix([{k:'fire',vol:40}, {k:'rain',vol:40}, {k:'rainywindow',vol:30}]);
  Object.keys(tracks).forEach(k => {
    if (id === tracks[k].btn) togglePlay(k);
  });
});

document.addEventListener("input", e => {
  Object.keys(tracks).forEach(k => {
    if (e.target.id === tracks[k].vol) setVolume(k, +e.target.value);
  });
});

// === Script Block 6 ===

  let noSleep = null; // NoSleep.js removed for Chrome Extension; using native Wake Lock API only
  let wakeLockSentinel = null;
  let isKeepingAwake = false;
  const btnWake = document.getElementById('btn-wake');

  // FIX: Bulletproof Toggle for Keep Awake that won't conflict with background loops
  async function acquireWakeLock() {
      if ('wakeLock' in navigator) {
          try {
              wakeLockSentinel = await navigator.wakeLock.request('screen');
              wakeLockSentinel.addEventListener('release', () => { 
                  wakeLockSentinel = null; 
              });
          } catch (err) {}
      }
  }

  async function toggleWakeLock() {
      if (!isKeepingAwake) {
          // Turn ON
          isKeepingAwake = true;
          if (noSleep) noSleep.enable();
          await acquireWakeLock();
          
          if (btnWake) {
              btnWake.textContent = '👀 Keeping Awake...';
              btnWake.classList.remove('danger');
              btnWake.classList.add('secondary');
          }
      } else {
          // Turn OFF
          isKeepingAwake = false;
          if (noSleep) noSleep.disable();
          
          if (wakeLockSentinel) {
              try { await wakeLockSentinel.release(); } catch(e) {}
              wakeLockSentinel = null;
          }
          
          if (btnWake) {
              btnWake.textContent = '☕ Keep Awake';
              btnWake.classList.add('danger');
              btnWake.classList.remove('secondary');
          }
      }
  }

  if (btnWake) {
      btnWake.addEventListener('click', toggleWakeLock);
  }

  // Restore wake lock only if the user actively wants it kept awake
  document.addEventListener('visibilitychange', async () => {
      if (isKeepingAwake && document.visibilityState === 'visible' && !wakeLockSentinel) {
         await acquireWakeLock();
      }
  });

  setInterval(async () => {
      if (isKeepingAwake && document.visibilityState === 'visible' && !wakeLockSentinel) {
          await acquireWakeLock();
      }
  }, 10000);

// === Script Block 7 ===

    let tvWidgetCreated = false;
    let tvRotxCreated = false;

    // News sources by country
    const newsSources = {
      ro: [
        {name:'Digi24 Economie', url:'https://www.digi24.ro/rss/economie'},
        {name:'Ziarul Financiar', url:'https://www.zf.ro/rss'},
        {name:'Bursa', url:'https://www.bursa.ro/titluri-bursa.xml'},
        {name:'Economica.net', url:'https://www.economica.net/rss'},
      ],
      us: [
        {name:'Reuters Business', url:'https://www.reutersagency.com/feed/?best-topics=business-finance'},
        {name:'CNBC', url:'https://www.cnbc.com/id/100003114/device/rss/rss.html'},
        {name:'Bloomberg via Investing.com', url:'https://www.investing.com/rss/news_25.rss'},
        {name:'MarketWatch', url:'https://feeds.marketwatch.com/marketwatch/topstories/'},
        {name:'Yahoo Finance', url:'https://finance.yahoo.com/news/rssindex'},
      ],
      uk: [
        {name:'BBC Business', url:'https://feeds.bbci.co.uk/news/business/rss.xml'},
        {name:'Financial Times', url:'https://www.ft.com/rss/home/uk'},
        {name:'The Guardian Business', url:'https://www.theguardian.com/uk/business/rss'},
        {name:'Reuters UK', url:'https://www.reutersagency.com/feed/?best-topics=business-finance'},
      ],
      de: [
        {name:'Handelsblatt', url:'https://www.handelsblatt.com/contentexport/feed/top-themen'},
        {name:'Reuters', url:'https://www.reutersagency.com/feed/?best-topics=business-finance'},
      ],
      fr: [
        {name:'Les Echos', url:'https://www.lesechos.fr/rss/rss_en_continu.xml'},
        {name:'Reuters', url:'https://www.reutersagency.com/feed/?best-topics=business-finance'},
        {name:'France24 Business', url:'https://www.france24.com/en/business/rss'},
      ],
      eu: [
        {name:'ECB Press', url:'https://www.ecb.europa.eu/rss/press.html'},
        {name:'Reuters', url:'https://www.reutersagency.com/feed/?best-topics=business-finance'},
        {name:'Euronews Business', url:'https://www.euronews.com/rss?level=theme&name=business'},
      ]
    };

    const countrySelect = document.getElementById('news-country');
    const sourceSelect = document.getElementById('news-source');
    const refreshBtn = document.getElementById('news-refresh');

    function populateSources(){
      var country = countrySelect.value;
      var sources = newsSources[country] || [];
      sourceSelect.innerHTML = '';
      sources.forEach(function(s){
        var opt = document.createElement('option');
        opt.value = s.url;
        opt.textContent = s.name;
        sourceSelect.appendChild(opt);
      });
    }

    function fetchNews(){
      var rssUrl = sourceSelect.value;
      if(!rssUrl) return;
      var newsList = document.getElementById('investing-news-list');
      newsList.innerHTML = '<p class="muted"><span class="spinner"></span> Loading news...</p>';
      fetch(API_BASE + '/api/rssfeed?url=' + encodeURIComponent(rssUrl))
        .then(function(res){ return res.json(); })
        .then(function(data){
          newsList.innerHTML = '';
          if(data.error){ newsList.innerHTML = '<p class="muted">Error: ' + data.error + '</p>'; return; }
          if(!data.items || !data.items.length){
            newsList.innerHTML = '<p class="muted">No articles found from this source.</p>';
            return;
          }
          data.items.slice(0, 8).forEach(function(item){
            var div = document.createElement('div');
            div.className = 'saved-item fade-in';
            var title = item.title || 'Untitled';
            var link = item.link || '#';
            var date = item.pubDate || '';
            div.innerHTML =
              '<div style="font-weight:800; margin-bottom:4px;">' +
                '<a href="' + link.replace(/"/g,'&quot;') + '" target="_blank" style="color:var(--accent-2); text-decoration:none;">' + title.replace(/</g,'&lt;') + '</a>' +
              '</div>' +
              '<div class="saved-meta" style="margin-top:0;">' + date + '</div>';
            newsList.appendChild(div);
          });
        })
        .catch(function(){
          newsList.innerHTML = '<p class="muted">Failed to load news. Try another source.</p>';
        });
    }

    countrySelect.addEventListener('change', function(){ populateSources(); fetchNews(); });
    sourceSelect.addEventListener('change', fetchNews);
    refreshBtn.addEventListener('click', fetchNews);

    // Initialize sources
    populateSources();

    function initInvestingTab() {
      // S&P 500 Chart
      if (!tvWidgetCreated) {
        createTradingViewWidget({
          symbol: "AMEX:SPY",
          interval: "D",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          backgroundColor: "rgba(15, 23, 42, 1)",
          gridColor: "rgba(255, 255, 255, 0.06)",
          hide_top_toolbar: false,
          hide_legend: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: "tv_chart_container",
          studies: [
            "Volume@tv-basicstudies",
            "MASimple@tv-basicstudies",
            "RSI@tv-basicstudies"
          ]
        });
        tvWidgetCreated = true;
      }

      // BET ROTX Chart
      if (!tvRotxCreated) {
        createTradingViewWidget({
          symbol: "BVB:BET",
          interval: "D",
          timezone: "Europe/Bucharest",
          theme: "dark",
          style: "1",
          locale: "en",
          backgroundColor: "rgba(15, 23, 42, 1)",
          gridColor: "rgba(255, 255, 255, 0.06)",
          hide_top_toolbar: false,
          hide_legend: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: "tv_chart_rotx",
          studies: [
            "Volume@tv-basicstudies",
            "MASimple@tv-basicstudies",
            "RSI@tv-basicstudies"
          ]
        });
        tvRotxCreated = true;
      }

      // Load news on first open
      var newsList = document.getElementById('investing-news-list');
      if (newsList && newsList.innerHTML.includes('spinner')) {
        fetchNews();
      }
    }

// === Script Block 8 ===

(function(){
  const STORAGE_KEY = 'homer-links';
  const grid = document.getElementById('links-grid');
  const empty = document.getElementById('links-empty');
  const btnAdd = document.getElementById('link-add');
  const inEmoji = document.getElementById('link-emoji');
  const emojiBtn = document.getElementById('link-emoji-btn');
  const emojiPicker = document.getElementById('emoji-picker');
  const emojiGrid = document.getElementById('emoji-grid');
  const inName = document.getElementById('link-name');
  const inUrl = document.getElementById('link-url');
  const inCat = document.getElementById('link-cat');
  const catList = document.getElementById('link-cat-list');
  const useIcon = document.getElementById('link-use-icon');

  // Emoji palette
  var emojis = ['🔗','🌐','💻','📱','🎮','🎵','🎬','📺','📷','🛒','💰','📊','📈','📰','📚','📝','📧','💬','🔍','🔧','🛠️','⚙️','🏠','🚀','⭐','❤️','🔥','⚡','🎯','🧩','☁️','🗂️','📁','🖥️','🎨','🎭','🏋️','🍔','☕','🎓','🏦','🏥','✈️','🗺️','📡','🔒','🧪','🤖','👾','🕹️','📻','🎧','🪄','💡','🌍','🌙','☀️','🌈','🍿','🧠'];

  // Build emoji grid
  emojis.forEach(function(e){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = e;
    btn.style.cssText = 'font-size:1.3rem;background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;transition:background .15s;';
    btn.addEventListener('mouseenter', function(){ btn.style.background='rgba(255,255,255,.12)'; });
    btn.addEventListener('mouseleave', function(){ btn.style.background='none'; });
    btn.addEventListener('click', function(){
      inEmoji.value = e;
      emojiBtn.textContent = e;
      emojiPicker.style.display = 'none';
    });
    emojiGrid.appendChild(btn);
  });

  // Toggle picker
  emojiBtn.addEventListener('click', function(ev){
    ev.stopPropagation();
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', function(){ emojiPicker.style.display = 'none'; });
  emojiPicker.addEventListener('click', function(ev){ ev.stopPropagation(); });

  function load(){ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  function save(links){ localStorage.setItem(STORAGE_KEY, JSON.stringify(links)); }

  function getFavicon(url){
    try {
      var u = new URL(url);
      return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(u.hostname) + '&sz=64';
    } catch(e){ return ''; }
  }

  function render(){
    const links = load();
    grid.innerHTML = '';
    empty.style.display = links.length ? 'none' : 'block';

    // update datalist with existing categories
    var cats = [];
    links.forEach(function(l){ if(l.cat && cats.indexOf(l.cat)===-1) cats.push(l.cat); });
    catList.innerHTML = '';
    cats.forEach(function(c){ var o=document.createElement('option'); o.value=c; catList.appendChild(o); });

    // group by category
    var groups = {};
    links.forEach(function(lnk, i){
      var key = lnk.cat || 'Uncategorized';
      if(!groups[key]) groups[key] = [];
      groups[key].push({lnk:lnk, idx:i});
    });

    Object.keys(groups).sort().forEach(function(cat){
      var heading = document.createElement('h2');
      heading.className = 'section';
      heading.style.marginTop = '16px';
      heading.textContent = cat;
      grid.appendChild(heading);

      groups[cat].forEach(function(item){
        var lnk = item.lnk;
        var div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:8px;';

        var showFavicon = lnk.useFavicon !== false;
        var faviconUrl = getFavicon(lnk.url);
        var iconHtml;
        if(showFavicon && faviconUrl){
          iconHtml = '<img src="' + escAttr(faviconUrl) + '" alt="" style="width:22px;height:22px;border-radius:4px;background:#fff;padding:1px;flex-shrink:0;" class="favicon-img">' +
                     '<span style="display:none;font-size:1.2rem;flex-shrink:0;">' + (lnk.emoji || '🔗') + '</span>';
        } else {
          iconHtml = '<span style="font-size:1.2rem;flex-shrink:0;">' + (lnk.emoji || '🔗') + '</span>';
        }

        div.innerHTML =
          iconHtml +
          '<a href="' + escAttr(lnk.url) + '" target="_blank" rel="noopener" style="color:var(--accent-2);font-weight:700;text-decoration:none;flex:1;">' + escHtml(lnk.name) + '</a>' +
          '<span style="color:var(--muted);font-size:.85rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(lnk.url) + '</span>' +
          '<button class="link-copy btn ghost" data-url="' + escAttr(lnk.url) + '" style="padding:4px 10px;font-size:.8rem;flex-shrink:0;" title="Copy URL">📋</button>' +
          '<button class="link-del btn" data-idx="' + item.idx + '" style="padding:4px 10px;font-size:.8rem;flex-shrink:0;">✕</button>';
        // Add favicon error handler (replaces inline onerror for CSP compliance)
        var faviconImg = div.querySelector('.favicon-img');
        if (faviconImg) {
          faviconImg.addEventListener('error', function() { this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline'; });
        }
        grid.appendChild(div);
      });
    });

    grid.querySelectorAll('.link-copy').forEach(function(btn){
      btn.addEventListener('click', function(){
        navigator.clipboard.writeText(btn.dataset.url).then(function(){
          btn.textContent = '✅'; setTimeout(function(){ btn.textContent = '📋'; }, 1200);
        });
      });
    });

    grid.querySelectorAll('.link-del').forEach(function(btn){
      btn.addEventListener('click', function(){
        var links = load();
        links.splice(parseInt(btn.dataset.idx), 1);
        save(links);
        render();
      });
    });
  }

  function escHtml(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
  function escAttr(s){ return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  btnAdd.addEventListener('click', function(){
    var name = inName.value.trim();
    var url = inUrl.value.trim();
    var cat = inCat.value.trim();
    if(!name || !url) return;
    if(!/^https?:\/\//i.test(url)) url = 'https://' + url;
    var links = load();
    links.push({
      emoji: inEmoji.value.trim() || '🔗',
      name: name,
      url: url,
      cat: cat || 'Uncategorized',
      useFavicon: useIcon.checked
    });
    save(links);
    inEmoji.value = ''; inName.value = ''; inUrl.value = ''; inCat.value = '';
    emojiBtn.textContent = '🔗';
    render();
  });

  [inName, inUrl, inCat].forEach(function(el){
    el.addEventListener('keydown', function(e){ if(e.key === 'Enter') btnAdd.click(); });
  });

  render();
})();

// === Script Block 9 ===

(function(){
  // === AES-256-GCM Vault with Web Crypto API ===
  var SALT_KEY = 'homer-vault-salt';
  var HASH_KEY = 'homer-vault-hash';
  var DATA_KEY = 'homer-vault-data';

  var cryptoKey = null; // derived key for this session

  // DOM refs
  var lockScreen = document.getElementById('vault-lock');
  var content = document.getElementById('vault-content');
  var pwInput = document.getElementById('vault-pw');
  var pwConfirmWrap = document.getElementById('vault-pw-confirm-wrap');
  var pwConfirm = document.getElementById('vault-pw-confirm');
  var lockLabel = document.getElementById('vault-lock-label');
  var unlockBtn = document.getElementById('vault-unlock');
  var lockBtn = document.getElementById('vault-lock-btn');
  var changePwBtn = document.getElementById('vault-change-pw');
  var errorEl = document.getElementById('vault-error');
  var notesArea = document.getElementById('vault-notes');
  var saveNotesBtn = document.getElementById('vault-save-notes');
  var linkName = document.getElementById('vault-link-name');
  var linkUrl = document.getElementById('vault-link-url');
  var linkAddBtn = document.getElementById('vault-link-add');
  var linksList = document.getElementById('vault-links-list');
  var linksEmpty = document.getElementById('vault-links-empty');
  var credLabel = document.getElementById('vault-cred-label');
  var credUser = document.getElementById('vault-cred-user');
  var credPass = document.getElementById('vault-cred-pass');
  var credAddBtn = document.getElementById('vault-cred-add');
  var credsList = document.getElementById('vault-creds-list');
  var credsEmpty = document.getElementById('vault-creds-empty');

  // First-time setup check
  var isNew = !localStorage.getItem(HASH_KEY);
  if(isNew){
    lockLabel.textContent = 'Create a master password for your vault';
    pwConfirmWrap.style.display = 'block';
    unlockBtn.textContent = 'Create Vault';
  }

  // --- Crypto helpers ---
  function getSalt(){
    var s = localStorage.getItem(SALT_KEY);
    if(s) return base64ToBytes(s);
    var salt = crypto.getRandomValues(new Uint8Array(16));
    localStorage.setItem(SALT_KEY, bytesToBase64(salt));
    return salt;
  }

  function deriveKey(password, salt){
    return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function(base){
        return crypto.subtle.deriveKey(
          {name:'PBKDF2', salt:salt, iterations:600000, hash:'SHA-256'},
          base,
          {name:'AES-GCM', length:256},
          false,
          ['encrypt','decrypt']
        );
      });
  }

  function hashPassword(password, salt){
    return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
      .then(function(base){
        return crypto.subtle.deriveBits({name:'PBKDF2', salt:salt, iterations:600000, hash:'SHA-256'}, base, 256);
      })
      .then(function(bits){ return bytesToBase64(new Uint8Array(bits)); });
  }

  function encrypt(key, plaintext){
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({name:'AES-GCM', iv:iv}, key, new TextEncoder().encode(plaintext))
      .then(function(ct){
        var combined = new Uint8Array(iv.length + ct.byteLength);
        combined.set(iv); combined.set(new Uint8Array(ct), iv.length);
        return bytesToBase64(combined);
      });
  }

  function decrypt(key, cipherB64){
    var data = base64ToBytes(cipherB64);
    var iv = data.slice(0,12);
    var ct = data.slice(12);
    return crypto.subtle.decrypt({name:'AES-GCM', iv:iv}, key, ct)
      .then(function(pt){ return new TextDecoder().decode(pt); });
  }

  function bytesToBase64(b){ var s=''; b.forEach(function(x){s+=String.fromCharCode(x);}); return btoa(s); }
  function base64ToBytes(s){ var d=atob(s); var a=new Uint8Array(d.length); for(var i=0;i<d.length;i++) a[i]=d.charCodeAt(i); return a; }

  // --- Vault data helpers ---
  function defaultData(){ return {notes:'', links:[], creds:[]}; }

  function loadVault(){
    var stored = localStorage.getItem(DATA_KEY);
    if(!stored) return Promise.resolve(defaultData());
    return decrypt(cryptoKey, stored).then(function(json){
      try{ return JSON.parse(json); }catch(e){ return defaultData(); }
    });
  }

  function saveVault(data){
    return encrypt(cryptoKey, JSON.stringify(data)).then(function(enc){
      localStorage.setItem(DATA_KEY, enc);
    });
  }

  // --- Render unlocked vault ---
  function renderVault(){
    loadVault().then(function(data){
      notesArea.value = data.notes || '';
      renderLinks(data.links || []);
      renderCreds(data.creds || []);
    });
  }

  function renderLinks(links){
    linksList.innerHTML = '';
    linksEmpty.style.display = links.length ? 'none' : 'block';
    links.forEach(function(l, i){
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:8px;';
      div.innerHTML =
        '<a href="'+escAttr(l.url)+'" target="_blank" rel="noopener" style="color:var(--accent-2);font-weight:700;text-decoration:none;flex:1;">'+escHtml(l.name)+'</a>' +
        '<span style="color:var(--muted);font-size:.85rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escHtml(l.url)+'</span>' +
        '<button class="vault-link-del btn" data-idx="'+i+'" style="padding:4px 10px;font-size:.8rem;">✕</button>';
      linksList.appendChild(div);
    });
    linksList.querySelectorAll('.vault-link-del').forEach(function(btn){
      btn.addEventListener('click', function(){
        loadVault().then(function(data){
          data.links.splice(parseInt(btn.dataset.idx),1);
          saveVault(data).then(function(){ renderLinks(data.links); });
        });
      });
    });
  }

  function renderCreds(creds){
    credsList.innerHTML = '';
    credsEmpty.style.display = creds.length ? 'none' : 'block';
    creds.forEach(function(c, i){
      var div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:8px;flex-wrap:wrap;';
      div.innerHTML =
        '<span style="font-weight:800;flex:0 0 auto;">'+escHtml(c.label)+'</span>' +
        '<span style="color:var(--muted);flex:1;min-width:80px;">'+escHtml(c.user)+'</span>' +
        '<code class="vault-pw-hidden" style="flex:1;min-width:80px;color:var(--accent);cursor:pointer;font-size:.9rem;" title="Click to reveal">••••••••</code>' +
        '<code class="vault-pw-plain" style="flex:1;min-width:80px;color:var(--accent);cursor:pointer;font-size:.9rem;display:none;" title="Click to hide">'+escHtml(c.pass)+'</code>' +
        '<button class="vault-copy-pw btn ghost" style="padding:4px 10px;font-size:.8rem;" title="Copy password">📋</button>' +
        '<button class="vault-cred-del btn" data-idx="'+i+'" style="padding:4px 10px;font-size:.8rem;">✕</button>';
      linksList;
      credsList.appendChild(div);

      // toggle reveal
      var hidden = div.querySelector('.vault-pw-hidden');
      var plain = div.querySelector('.vault-pw-plain');
      hidden.addEventListener('click', function(){ hidden.style.display='none'; plain.style.display='inline'; });
      plain.addEventListener('click', function(){ plain.style.display='none'; hidden.style.display='inline'; });

      // copy
      div.querySelector('.vault-copy-pw').addEventListener('click', function(){
        navigator.clipboard.writeText(c.pass).then(function(){
          var b = div.querySelector('.vault-copy-pw');
          b.textContent = '✅'; setTimeout(function(){ b.textContent = '📋'; }, 1200);
        });
      });
    });
    credsList.querySelectorAll('.vault-cred-del').forEach(function(btn){
      btn.addEventListener('click', function(){
        loadVault().then(function(data){
          data.creds.splice(parseInt(btn.dataset.idx),1);
          saveVault(data).then(function(){ renderCreds(data.creds); });
        });
      });
    });
  }

  function escHtml(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
  function escAttr(s){ return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // --- Unlock / Create ---
  function showError(msg){ errorEl.textContent=msg; errorEl.style.display='block'; }
  function hideError(){ errorEl.style.display='none'; }

  unlockBtn.addEventListener('click', function(){
    hideError();
    var pw = pwInput.value;
    if(!pw){ showError('Please enter a password.'); return; }
    var salt = getSalt();

    if(isNew){
      // Creating vault
      if(pw !== pwConfirm.value){ showError('Passwords do not match.'); return; }
      if(pw.length < 4){ showError('Password must be at least 4 characters.'); return; }
      hashPassword(pw, salt).then(function(h){
        localStorage.setItem(HASH_KEY, h);
        return deriveKey(pw, salt);
      }).then(function(key){
        cryptoKey = key;
        return saveVault(defaultData());
      }).then(function(){
        unlock();
      });
    } else {
      // Verify password
      hashPassword(pw, salt).then(function(h){
        if(h !== localStorage.getItem(HASH_KEY)){
          showError('Wrong password.'); return;
        }
        return deriveKey(pw, salt).then(function(key){
          cryptoKey = key;
          unlock();
        });
      });
    }
  });

  pwInput.addEventListener('keydown', function(e){ if(e.key==='Enter') unlockBtn.click(); });
  pwConfirm.addEventListener('keydown', function(e){ if(e.key==='Enter') unlockBtn.click(); });

  function unlock(){
    pwInput.value = ''; pwConfirm.value = '';
    lockScreen.style.display = 'none';
    content.style.display = 'block';
    renderVault();
  }

  // --- Lock ---
  lockBtn.addEventListener('click', function(){
    cryptoKey = null;
    content.style.display = 'none';
    lockScreen.style.display = 'block';
    notesArea.value = '';
    linksList.innerHTML = '';
    credsList.innerHTML = '';
    isNew = false;
    lockLabel.textContent = 'Enter your master password to unlock';
    pwConfirmWrap.style.display = 'none';
    unlockBtn.textContent = 'Unlock';
  });

  // --- Change Password ---
  changePwBtn.addEventListener('click', function(){
    var newPw = prompt('Enter new master password:');
    if(!newPw || newPw.length < 4){ alert('Password must be at least 4 characters.'); return; }
    var confirmPw = prompt('Confirm new password:');
    if(newPw !== confirmPw){ alert('Passwords do not match.'); return; }
    // Re-encrypt all data with new password
    loadVault().then(function(data){
      var salt = getSalt();
      return hashPassword(newPw, salt).then(function(h){
        localStorage.setItem(HASH_KEY, h);
        return deriveKey(newPw, salt);
      }).then(function(key){
        cryptoKey = key;
        return saveVault(data);
      }).then(function(){
        alert('Password changed successfully!');
      });
    });
  });

  // --- Save Notes ---
  saveNotesBtn.addEventListener('click', function(){
    loadVault().then(function(data){
      data.notes = notesArea.value;
      saveVault(data).then(function(){
        saveNotesBtn.textContent = '✅ Saved!';
        setTimeout(function(){ saveNotesBtn.textContent = 'Save Notes'; }, 1200);
      });
    });
  });

  // --- Add Link ---
  linkAddBtn.addEventListener('click', function(){
    var name = linkName.value.trim();
    var url = linkUrl.value.trim();
    if(!name || !url) return;
    if(!/^https?:\/\//i.test(url)) url = 'https://' + url;
    loadVault().then(function(data){
      data.links.push({name:name, url:url});
      linkName.value=''; linkUrl.value='';
      saveVault(data).then(function(){ renderLinks(data.links); });
    });
  });
  [linkName, linkUrl].forEach(function(el){
    el.addEventListener('keydown', function(e){ if(e.key==='Enter') linkAddBtn.click(); });
  });

  // --- Add Credential ---
  credAddBtn.addEventListener('click', function(){
    var label = credLabel.value.trim();
    var user = credUser.value.trim();
    var pass = credPass.value.trim();
    if(!label || !pass) return;
    loadVault().then(function(data){
      data.creds.push({label:label, user:user, pass:pass});
      credLabel.value=''; credUser.value=''; credPass.value='';
      saveVault(data).then(function(){ renderCreds(data.creds); });
    });
  });
  [credLabel, credUser, credPass].forEach(function(el){
    el.addEventListener('keydown', function(e){ if(e.key==='Enter') credAddBtn.click(); });
  });

})();

// === Script Block 10 ===

(function(){
  // === NEWS TAB ===
  var newsTabSources = {
    ro: [
      {name:'Digi24', rss:'https://www.digi24.ro/rss'},
      {name:'HotNews', rss:'https://www.hotnews.ro/rss'},
      {name:'Mediafax', rss:'https://www.mediafax.ro/rss'},
      {name:'Ziarul Financiar', rss:'https://www.zf.ro/rss'},
      {name:'Adevarul', rss:'https://adevarul.ro/rss'},
      {name:'Libertatea', rss:'https://www.libertatea.ro/rss'},
      {name:'G4Media', rss:'https://www.g4media.ro/feed'},
      {name:'Economica.net', rss:'https://www.economica.net/rss'},
      {name:'Bursa', rss:'https://www.bursa.ro/titluri-bursa.xml'}
    ],
    int: [
      {name:'BBC World', rss:'https://feeds.bbci.co.uk/news/world/rss.xml'},
      {name:'Reuters', rss:'https://www.reutersagency.com/feed/?best-topics=business-finance'},
      {name:'CNN', rss:'http://rss.cnn.com/rss/edition.rss'},
      {name:'Al Jazeera', rss:'https://www.aljazeera.com/xml/rss/all.xml'},
      {name:'The Guardian', rss:'https://www.theguardian.com/world/rss'},
      {name:'France24', rss:'https://www.france24.com/en/rss'},
      {name:'NPR', rss:'https://feeds.npr.org/1001/rss.xml'},
      {name:'TechCrunch', rss:'https://techcrunch.com/feed/'},
      {name:'Ars Technica', rss:'https://feeds.arstechnica.com/arstechnica/index'}
    ]
  };

  var regionSel = document.getElementById('news-tab-region');
  var sourceSel = document.getElementById('news-tab-source');
  var refreshBtn = document.getElementById('news-tab-refresh');
  var newsList = document.getElementById('news-tab-list');

  function populateNewsSources(){
    var sources = newsTabSources[regionSel.value] || [];
    sourceSel.innerHTML = '';
    sources.forEach(function(s){
      var o = document.createElement('option');
      o.value = s.rss; o.textContent = s.name;
      sourceSel.appendChild(o);
    });
  }

  function fetchTabNews(){
    var rss = sourceSel.value;
    if(!rss) return;
    newsList.innerHTML = '<p class="muted"><span class="spinner"></span> Loading news...</p>';
    fetch(API_BASE + '/api/rssfeed?url=' + encodeURIComponent(rss))
      .then(function(r){ return r.json(); })
      .then(function(data){
        newsList.innerHTML = '';
        if(data.error){ newsList.innerHTML = '<p class="muted">Error: ' + data.error + '</p>'; return; }
        if(!data.items || !data.items.length){
          newsList.innerHTML = '<p class="muted">No articles found.</p>'; return;
        }
        data.items.slice(0,10).forEach(function(item){
          var div = document.createElement('div');
          div.className = 'saved-item fade-in';
          var thumb = item.thumbnail || '';
          div.innerHTML =
            '<div style="display:flex;gap:12px;align-items:flex-start;">' +
              (thumb ? '<img src="'+thumb.replace(/"/g,'&quot;')+'" alt="" style="width:80px;height:55px;object-fit:cover;border-radius:8px;flex-shrink:0;" class="news-thumb">' : '') +
              '<div style="flex:1;min-width:0;">' +
                '<div style="font-weight:800;margin-bottom:4px;">' +
                  '<a href="'+(item.link||'#').replace(/"/g,'&quot;')+'" target="_blank" style="color:var(--accent-2);text-decoration:none;">'+(item.title||'Untitled').replace(/</g,'&lt;')+'</a>' +
                '</div>' +
                '<div style="color:var(--muted);font-size:.85rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">'+(item.description||'')+'</div>' +
                '<div class="saved-meta" style="margin-top:4px;">'+(item.pubDate||'')+'</div>' +
              '</div>' +
            '</div>';
          // CSP-compliant image error handler
          var thumbImg = div.querySelector('.news-thumb');
          if (thumbImg) thumbImg.addEventListener('error', function(){ this.style.display='none'; });
          newsList.appendChild(div);
        });
      })
      .catch(function(){
        newsList.innerHTML = '<p class="muted">Failed to load news. Try another source.</p>';
      });
  }

  regionSel.addEventListener('change', function(){ populateNewsSources(); });
  sourceSel.addEventListener('change', function(){ fetchTabNews(); });
  refreshBtn.addEventListener('click', fetchTabNews);
  populateNewsSources();

  // === YOUTUBE CAROUSEL ===
  var ytChannels = {
    ro: [
      {name:'Digi24 HD', id:'UCbvKamSrJkwT6ed2BMMZXwg'},
      {name:'Antena 3 CNN', id:'UCw9Hc3CD8hbqP-Y9XOJS--Q'},
      {name:'Recorder', id:'UChDQ6nYN6XyRU-8IEgbym1g'},
      {name:'HotNews', id:'UC9ipWt3PNhs6sZ_niPRoYLw'},
      {name:'Stirile ProTV', id:'UCEJf5cGtkBdZS8Jh2uSW9xw'},
      {name:'Zaiafet', id:'UC23FB2BshzRIreih7VgZ0Yw'}
    ],
    int: [
      {name:'BBC News', id:'UC16niRr50-MSBwiO3YDb3RA'},
      {name:'CNN', id:'UCupvZG-5ko_eiXAupbDfxWw'},
      {name:'TED', id:'UCAuUUnT6oDeKwE6v1NGQxug'},
      {name:'Veritasium', id:'UCHnyfMqiRRG1u-2MsSQLbXA'},
      {name:'Kurzgesagt', id:'UCsXVk37bltHxD1rDPwtNM8Q'},
      {name:'Fireship', id:'UCsBjURrPoezykLs9EqgamOA'},
      {name:'MKBHD', id:'UCBJycsmduvYEL83R_U4JriQ'},
      {name:'Linus Tech Tips', id:'UCXuqSBlHAE6Xw-yeJA0Tunw'},
      {name:'Joe Rogan', id:'UCzQUP1qoWDoEbmsQxvdjxgQ'},
      {name:'Lex Fridman', id:'UCSHZKyawb77ixDdsGog4iWA'}
    ]
  };

  var ytRegion = document.getElementById('yt-region');
  var ytChSel = document.getElementById('yt-channel');
  var ytLoadBtn = document.getElementById('yt-load');
  var ytTrack = document.getElementById('yt-carousel-track');
  var ytEmpty = document.getElementById('yt-empty');

  function populateYtChannels(){
    var chs = ytChannels[ytRegion.value] || [];
    ytChSel.innerHTML = '';
    chs.forEach(function(c){
      var o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      ytChSel.appendChild(o);
    });
  }

  function loadYtVideos(){
    var channelId = ytChSel.value;
    if(!channelId) return;
    ytTrack.innerHTML = '';
    ytEmpty.textContent = 'Loading videos...';
    ytEmpty.style.display = 'block';

    // Fetch YouTube feed via our own Vercel API proxy
    var apiUrl = API_BASE + '/api/ytfeed?id=' + encodeURIComponent(channelId);
    console.log('[YT] Fetching:', apiUrl, 'channelId:', channelId);
    fetch(apiUrl)
      .then(function(r){
        console.log('[YT] Response status:', r.status, 'url:', r.url);
        if(!r.ok) throw new Error('API returned ' + r.status);
        return r.text();
      })
      .then(function(text){
        console.log('[YT] Raw response:', text.slice(0, 500));
        var data = JSON.parse(text);
        if(data.error){ ytEmpty.textContent = 'API error: ' + data.error; return; }
        var videos = data.videos || [];
        if(!videos.length){
          ytEmpty.textContent = 'No videos found. Debug: ' + text.slice(0, 200); return;
        }
        ytEmpty.style.display = 'none';

        var count = Math.min(videos.length, 15);
        for(var i = 0; i < count; i++){
          var vidId = videos[i].vidId;
          var title = videos[i].title || '';
          var date = videos[i].date || '';

          if(!vidId) continue;

          var card = document.createElement('div');
          card.style.cssText = 'flex:0 0 320px;scroll-snap-align:start;border-radius:12px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);';
          card.innerHTML =
            '<div style="position:relative;cursor:pointer;" class="yt-thumb-wrap" data-vid="'+vidId+'">' +
              '<img src="https://img.youtube.com/vi/'+vidId+'/mqdefault.jpg" alt="" style="width:100%;display:block;aspect-ratio:16/9;object-fit:cover;">' +
              '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.3);transition:background .2s;">' +
                '<div style="width:50px;height:50px;background:rgba(255,0,0,.9);border-radius:12px;display:flex;align-items:center;justify-content:center;">' +
                  '<div style="width:0;height:0;border-left:18px solid #fff;border-top:10px solid transparent;border-bottom:10px solid transparent;margin-left:4px;"></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div style="padding:10px 12px;">' +
              '<div style="font-weight:700;font-size:.9rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">'+title.replace(/</g,'&lt;')+'</div>' +
              '<div style="color:var(--muted);font-size:.8rem;margin-top:4px;">'+date+'</div>' +
            '</div>';
          ytTrack.appendChild(card);
        }

        // Click thumbnail to play inline
        ytTrack.querySelectorAll('.yt-thumb-wrap').forEach(function(wrap){
          wrap.addEventListener('click', function(){
            var id = wrap.dataset.vid;
            var iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube.com/embed/'+id+'?autoplay=1';
            iframe.style.cssText = 'width:100%;aspect-ratio:16/9;border:none;display:block;';
            iframe.allow = 'autoplay;encrypted-media';
            iframe.allowFullscreen = true;
            wrap.parentNode.replaceChild(iframe, wrap);
          });
        });
      })
      .catch(function(err){
        ytEmpty.textContent = 'Failed to load videos: ' + (err && err.message || 'Unknown error');
      });
  }

  ytRegion.addEventListener('change', function(){ populateYtChannels(); });
  ytLoadBtn.addEventListener('click', loadYtVideos);
  populateYtChannels();
})();

