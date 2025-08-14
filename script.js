// ---------- State ----------
let page = 1;
let currentCategory = "";
let currentQuery = "";
let fetching = false;
let featuredSet = false;
const pageSize = 12;
const shownUrls = new Set();

// ---------- Elements ----------
const grid = document.getElementById("grid");
const sentinel = document.getElementById("sentinel");
const pills = document.querySelectorAll(".pill");
const searchInput = document.getElementById("searchInput");
const toTop = document.getElementById("toTop");
const toast = document.getElementById("toast");
const tickerTrack = document.getElementById("tickerTrack");

// Hero
const hero = document.getElementById("hero");
const heroImg = document.getElementById("heroImg");
const heroTitle = document.getElementById("heroTitle");
const heroDesc = document.getElementById("heroDesc");
const heroSrc = document.getElementById("heroSrc");
const heroDate = document.getElementById("heroDate");
const heroLink = document.getElementById("heroLink");
const heroShare = document.getElementById("heroShare");

// ---------- Utils ----------
const fmtDate = (d) => new Date(d || Date.now()).toLocaleDateString();
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const showToast = (msg) => { toast.textContent = msg; toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"), 1800); };
const saveTheme = (t)=> localStorage.setItem("zynqo_theme", t);
const getTheme = ()=> localStorage.getItem("zynqo_theme") || "light";

// Theme handling
const themeToggle = document.getElementById("themeToggle");
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  document.getElementById("themeColor").setAttribute("content", t === "dark" ? "#0b1020" : "#ff5f6d");
  themeToggle.textContent = t === "dark" ? "☀️" : "🌙";
}
applyTheme(getTheme());
themeToggle.addEventListener("click", ()=>{
  const t = getTheme() === "dark" ? "light" : "dark";
  saveTheme(t); applyTheme(t);
});

// Year
document.getElementById("year").textContent = new Date().getFullYear();

// ---------- Skeletons ----------
function addSkeletons(count = 9) {
  for (let i=0;i<count;i++) grid.appendChild(el("div","skel"));
}
function clearSkeletons() {
  document.querySelectorAll(".skel").forEach(s=>s.remove());
}

// ---------- Render ----------
function cardTemplate(a) {
  const url = a.url || "#";
  if (!url || shownUrls.has(url)) return null; // avoid duplicates
  shownUrls.add(url);

  const card = el("article","card");
  const media = el("div","card-media");
  const img = el("img");
  img.loading = "lazy";
  img.alt = a.title || "story image";
  img.src = a.urlToImage || "https://picsum.photos/seed/zynqo/800/450";
  media.appendChild(img);

  const badge = el("span","card-badge");
  badge.textContent = a.source?.name || "Source";
  media.appendChild(badge);

  const body = el("div","card-body");
  const h = el("h3","card-title"); h.textContent = a.title || "Untitled";
  const p = el("p","card-desc"); p.textContent = a.description || "";
  const meta = el("div","card-meta");
  const when = el("span"); when.textContent = fmtDate(a.publishedAt);

  // Share
  const cluster = el("div","share");
  const shareBtn = el("button"); shareBtn.textContent = "Share";
  shareBtn.addEventListener("click", ()=>{
    const text = a.title || "Check this out";
    if (navigator.share) {
      navigator.share({ title: "Zynqo", text, url }).catch(()=>{});
    } else {
      const wa = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + " " + url)}`;
      window.open(wa, "_blank");
    }
  });
  const read = el("a"); read.textContent = "Read"; read.href = url; read.target = "_blank"; read.rel="noopener";

  cluster.appendChild(shareBtn);
  cluster.appendChild(read);

  meta.appendChild(when);
  meta.appendChild(cluster);

  body.appendChild(h);
  body.appendChild(p);
  body.appendChild(meta);

  card.appendChild(media);
  card.appendChild(body);
  return card;
}

// ---------- Featured / Hero ----------
function setHero(a) {
  if (!a) return;
  heroImg.src = a.urlToImage || "https://picsum.photos/seed/zynqofeature/1200/700";
  heroTitle.textContent = a.title || "";
  heroDesc.textContent = a.description || "";
  heroSrc.textContent = a.source?.name ? `Source: ${a.source.name}` : "";
  heroDate.textContent = fmtDate(a.publishedAt);
  heroLink.href = a.url || "#";
  heroShare.onclick = () => {
    const text = a.title || "Check this out";
    if (navigator.share) navigator.share({ title: "Zynqo", text, url: a.url || location.href }).catch(()=>{});
    else window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text+" "+(a.url||""))}`,"_blank");
  };
  hero.classList.remove("hidden");
}

// ---------- Fetch ----------
async function fetchNews() {
  if (fetching) return;
  fetching = true;
  addSkeletons(6);

  const params = new URLSearchParams({ page, pageSize });
  if (currentCategory) params.set("category", currentCategory);
  if (currentQuery) params.set("q", currentQuery);

  try {
    const res = await fetch(`/.netlify/functions/news?${params.toString()}`);
    const data = await res.json();
    clearSkeletons();

    const articles = Array.isArray(data?.articles) ? data.articles : [];

    // ticker update (first page only)
    if (page === 1 && articles.length) {
      tickerTrack.innerHTML = "";
      const snippet = articles.slice(0, 8).map(a => `<span class="ticker-item">• ${a.title}</span>`).join("");
      tickerTrack.innerHTML = snippet + snippet; // loop
    }

    // hero on first batch (skip if already set)
    if (!featuredSet && articles.length) {
      setHero(articles[0]);
      featuredSet = true;
    }

    // render cards (skip hero if same URL)
    for (let i = featuredSet ? 1 : 0; i < articles.length; i++) {
      const c = cardTemplate(articles[i]);
      if (c) grid.appendChild(c);
    }

    // first load fallback
    if (page === 1 && grid.children.length === 0) {
      grid.innerHTML = `<div class="card-body" style="grid-column:1/-1;text-align:center;color:var(--muted)">No stories found. Try another keyword.</div>`;
    }

    // cache latest batch (simple)
    try {
      if (page === 1) localStorage.setItem("zynqo_last", JSON.stringify(articles.slice(0, 20)));
    } catch {}

    document.querySelector("main")?.setAttribute("aria-busy","false");
    fetching = false;
  } catch (e) {
    clearSkeletons();
    fetching = false;
    showToast("Network error. Showing last saved stories…");
    // Offline fallback
    const saved = JSON.parse(localStorage.getItem("zynqo_last") || "[]");
    if (page === 1 && saved.length) {
      saved.forEach(a => {
        const c = cardTemplate(a);
        if (c) grid.appendChild(c);
      });
    }
  }
}

// ---------- Infinite Scroll ----------
const io = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if (entry.isIntersecting && !fetching) {
      page += 1;
      fetchNews();
    }
  });
}, { rootMargin: "400px 0px 0px 0px" });
io.observe(sentinel);

// ---------- Search (debounced) ----------
let st;
searchInput.addEventListener("input", ()=>{
  clearTimeout(st);
  st = setTimeout(()=>{
    currentQuery = searchInput.value.trim();
    page = 1; featuredSet = false; shownUrls.clear();
    grid.innerHTML = "";
    fetchNews();
  }, 450);
});

// ---------- Category pills ----------
pills.forEach(p=>{
  p.addEventListener("click", ()=>{
    pills.forEach(x=>x.classList.remove("active"));
    p.classList.add("active");
    currentCategory = p.dataset.category || "";
    page = 1; featuredSet = false; shownUrls.clear();
    grid.innerHTML = "";
    fetchNews();
  });
});

// ---------- Back to top ----------
window.addEventListener("scroll", ()=>{
  if (window.scrollY > 800) toTop.classList.add("show"); else toTop.classList.remove("show");
});
toTop.addEventListener("click", ()=> window.scrollTo({ top: 0, behavior: "smooth" }));

// ---------- Newsletter modal ----------
const subDialog = document.getElementById("subDialog");
setTimeout(()=>{
  if (!localStorage.getItem("zynqo_sub")) {
    try { subDialog.showModal(); } catch {}
  }
}, 12000);
subDialog.addEventListener("close", ()=>{
  if (subDialog.returnValue === "subscribe") {
    localStorage.setItem("zynqo_sub","1");
    showToast("Subscribed! 🎉");
  } else {
    localStorage.setItem("zynqo_sub","dismissed");
  }
});

// ---------- First load ----------
fetchNews();
