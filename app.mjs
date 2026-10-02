import { places, filterPlaces, parseFavorites } from "./places.mjs";
const key = "giza-guide-favorites-v1";
const status = document.querySelector("#status");
const results = document.querySelector("#results");
let language = "ar";
let favorites = new Set();
let storageReadFailed = false;
try {
  const saved = localStorage.getItem(key);
  if (saved) favorites = parseFavorites(saved);
} catch {
  storageReadFailed = true;
  status.textContent = "تعذر قراءة قائمة الزيارة. لم تُحذف البيانات المحفوظة.";
}
const labels = {
  ar: {
    title: "دليل الجيزة",
    intro: "أربعة أماكن للتعرف عليها، بمصادر رسمية وقائمة زيارة محلية.",
    notice: "راجع المصدر الرسمي قبل الزيارة لمعرفة المواعيد والتذاكر الحالية.",
    favorites: "قائمة الزيارة فقط",
    source: "المصدر الرسمي",
    add: "أضف إلى الزيارة",
    remove: "أزل من الزيارة",
    empty: "لا توجد أماكن تطابق البحث.",
    saved: "حُفظت قائمة الزيارة.",
    unsaved: "تعذر الحفظ؛ التغيير لهذه الجلسة فقط.",
    footer:
      "المحتوى موجز بالعربية والإنجليزية، روجعت روابطه في 2 أكتوبر 2026. لا يتضمن مواعيد أو أسعارًا مفترضة. قائمة الزيارة تبقى على هذا المتصفح.",
  },
  en: {
    title: "Giza Guide",
    intro:
      "Four places to discover, with official sources and a local visit list.",
    notice:
      "Check the official source before visiting for current hours and tickets.",
    favorites: "Visit list only",
    source: "Official source",
    add: "Add to visit list",
    remove: "Remove from visit list",
    empty: "No places match these filters.",
    saved: "Visit list saved.",
    unsaved: "Saving failed; this change lasts for this session only.",
    footer:
      "Short Arabic and English descriptions; links reviewed on 2 October 2026. No assumed opening times or prices. Your visit list stays in this browser.",
  },
};
function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function render() {
  const copy = labels[language];
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = copy.title;
  for (const id of ["title", "intro", "notice", "footer"])
    document.querySelector(`#${id}`).textContent = copy[id];
  document.querySelector("#favorites-label").textContent = copy.favorites;
  document.querySelector("#language").textContent =
    language === "ar" ? "English" : "العربية";
  document
    .querySelector("#query")
    .setAttribute(
      "aria-label",
      language === "ar" ? "بحث بالأماكن" : "Search places",
    );
  const visible = filterPlaces(
    document.querySelector("#query").value,
    document.querySelector("#favorites").checked ? favorites : null,
  );
  document.querySelector("#count").textContent =
    language === "ar"
      ? `${visible.length} أماكن · ${favorites.size} في قائمة الزيارة`
      : `${visible.length} places · ${favorites.size} in visit list`;
  results.replaceChildren();
  if (!visible.length) results.append(el("p", copy.empty));
  for (const place of visible) {
    const card = el("article", "");
    card.append(
      el("h2", place[language]),
      el("p", language === "ar" ? place.areaAr : place.areaEn),
      el("p", language === "ar" ? place.arSummary : place.enSummary),
    );
    const link = el("a", copy.source);
    link.href = place.source;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(link);
    const button = el(
      "button",
      favorites.has(place.id) ? copy.remove : copy.add,
    );
    button.type = "button";
    button.setAttribute("aria-pressed", String(favorites.has(place.id)));
    button.setAttribute(
      "aria-label",
      `${button.textContent}: ${place[language]}`,
    );
    button.style.display = "block";
    button.style.marginTop = "16px";
    button.addEventListener("click", () => {
      if (favorites.has(place.id)) favorites.delete(place.id);
      else favorites.add(place.id);
      try {
        if (storageReadFailed)
          throw new Error("Unreadable prior data preserved");
        localStorage.setItem(key, JSON.stringify([...favorites]));
        status.textContent = labels[language].saved;
      } catch {
        status.textContent = labels[language].unsaved;
      }
      render();
    });
    card.append(button);
    results.append(card);
  }
}
document.querySelector("#language").addEventListener("click", () => {
  language = language === "ar" ? "en" : "ar";
  status.textContent = "";
  document.querySelector("#query-label").firstChild.textContent =
    language === "ar" ? "بحث" : "Search";
  render();
});
for (const id of ["query", "favorites"])
  document.querySelector(`#${id}`).addEventListener("input", render);
render();
